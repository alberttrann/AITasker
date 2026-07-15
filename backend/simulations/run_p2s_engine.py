#!/usr/bin/env python3
import json
import os
import subprocess
import time
from openai import OpenAI
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# ─── CONFIGURATION ──────────────────────────────────────────────────────────
LM_STUDIO_URL = "http://192.168.1.27:1234/v1"
TEACHER_MODEL = "unsloth/Qwen3.6-27B-GGUF(IQ4_NL)" # Hoặc mã mô hình bạn đã load trong LM Studio
COMPILED_TRACES_FILE = "compiled_traces.jsonl"
GOLDEN_DATASET_FILE = "golden_dataset.jsonl"

# Kết nối hệ thống đến DB quản trị để thực hiện thao tác drop/create database template
ADMIN_DB_URL = "postgresql://postgres:postgres@localhost:5434/postgres"
ACTIVE_DB_NAME = "aitasker_active"
TEMPLATE_DB_NAME = "aitasker_snap"

# Khởi tạo OpenAI Client kết nối tới LM Studio
client = OpenAI(base_url=LM_STUDIO_URL, api_key="lm-studio")

SYSTEM_TAXONOMY_PROMPT = """You are an expert API Security and QA Architect.
You are given a "Primitive Trace" of successfully executed ocli commands.
Your task is to generate mutated, fault-seeking versions of the FINAL command.

Apply the following 15-Vector Fault Taxonomy to design your mutation:
1. Null-Byte: Inject \\x00 or %00 in strings.
2. Type Confusion: Swap string, integer, array, boolean types.
3. Integer Boundaries: Inject -1, 0, 1, 2147483647, 9223372036854775807.
4. String Extremes: Empty strings or extreme lengths (e.g. 50,000 characters).
5. Injection: SQLi (' OR 1=1--) or XSS payloads.
6. Encoding: Double-URL encoding, Right-to-Left Overrides, or 4-byte emojis.
7. Mandatory Omission: Omit required CLI flags.
8. Parameter Conflict: Send mutually exclusive parameters.
9. Token Tampering: Send malformed or expired JWT signatures.
10. Mass Assignment (OWASP API3): Inject read-only schema parameters.
11. BOLA/BFLA (OWASP API1/API5): Swap authentication tokens.
12. Business Flow Bypass (OWASP API6): Skip mandatory state prerequisite steps.
13. Replay/Idempotency: Replay identical mutating requests concurrently.
14. Context Desynchronization: Inject mismatched resource UUIDs.
15. Premature Progression: Force transitions on "DRAFT" or "PENDING" entities.

CRITICAL SYNTAX RULE:
You MUST maintain the exact ocli tool syntax.
- DO NOT use cURL-like syntax (e.g., `ocli post /path`). Use the exact command name provided in the trace (e.g., `ocli auth_register_post`).
- DO NOT use `--data` or `--body` with raw JSON strings.
- Pass ALL parameters as individual flags (e.g., `--email "test@test.com" --isAdmin true`).

OUTPUT FORMAT:
Return a JSON object containing exactly two keys:
{
  "reasoning": "A short chain of thought explaining the vulnerability vector you are targeting.",
  "mutated_command": "The complete modified ocli command."
}"""

# ─── POSTGRESQL TEMPLATE SNAPSHOTTING ────────────────────────────────────────

def run_admin_sql(sql_query):
    """Thực thi các lệnh DDL hệ thống không được chạy trong khối Transaction."""
    conn = psycopg2.connect(ADMIN_DB_URL)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    try:
        cursor.execute(sql_query)
    except Exception as e:
        print(f"[DB WARN] Query failed: {sql_query} | Error: {e}")
    finally:
        cursor.close()
        conn.close()

def force_disconnect_clients(db_name):
    """Ngắt toàn bộ kết nối hiện tại để tránh lỗi block CREATE/DROP DATABASE."""
    sql = f"""
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '{db_name}'
      AND pid <> pg_backend_pid();
    """
    run_admin_sql(sql)

def create_snapshot_template():
    """Tạo bản sao lưu trạng thái cơ sở dữ liệu hiện tại làm Template."""
    print(f"[SNAPSHOT] Creating snapshot template '{TEMPLATE_DB_NAME}' from current state...")
    force_disconnect_clients(ACTIVE_DB_NAME)
    run_admin_sql(f"DROP DATABASE IF EXISTS {TEMPLATE_DB_NAME};")
    run_admin_sql(f"CREATE DATABASE {TEMPLATE_DB_NAME} WITH TEMPLATE {ACTIVE_DB_NAME};")

def restore_from_snapshot():
    """Khôi phục nhanh cơ sở dữ liệu active về trạng thái Template (dưới 100ms)."""
    force_disconnect_clients(ACTIVE_DB_NAME)
    run_admin_sql(f"DROP DATABASE IF EXISTS {ACTIVE_DB_NAME};")
    run_admin_sql(f"CREATE DATABASE {ACTIVE_DB_NAME} WITH TEMPLATE {TEMPLATE_DB_NAME};")

# ─── CORE ORCHESTRATION PIPELINE ─────────────────────────────────────────────

def execute_ocli_command(cmd_str):
    """Thực thi lệnh ocli thông qua terminal và lấy kết quả trả về."""
    # Định hướng các cuộc gọi ocli sử dụng database sandbox cô lập trên cổng 5434
    env_vars = os.environ.copy()
    env_vars["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5434/aitasker_active?schema=public"
    
    # Thực hiện lệnh ocli thực tế
    result = subprocess.run(
        cmd_str,
        shell=True,
        capture_output=True,
        text=True,
        env=env_vars
    )
    return result.returncode, result.stdout, result.stderr

import re # Thêm import re ở đầu file cùng với json, os...

def call_teacher_llm(messages):
    """Gọi mô hình Teacher từ máy chủ LM Studio."""
    response = client.chat.completions.create(
        model=TEACHER_MODEL,
        messages=messages,
        temperature=0.2,
        # ĐÃ XÓA: response_format={"type": "json_object"} để tương thích LM Studio
    )
    raw_content = response.choices[0].message.content
    
    # ─── Robust JSON Extraction ───
    # Xử lý trường hợp mô hình trả về JSON bọc trong markdown ```json ... ```
    try:
        return json.loads(raw_content)
    except json.JSONDecodeError:
        # Tìm block markdown
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_content, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        else:
            # Quét tìm dấu ngoặc nhọn đầu tiên và cuối cùng
            start = raw_content.find('{')
            end = raw_content.rfind('}')
            if start != -1 and end != -1:
                return json.loads(raw_content[start:end+1])
            raise ValueError(f"Không thể trích xuất JSON từ phản hồi: {raw_content}")

# Thêm file lưu vết checkpoint
CHECKPOINT_FILE = "processed_flows.txt"

def load_processed_flows():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, "r") as f:
            return set(line.strip() for line in f if line.strip())
    return set()

def save_processed_flow(flow_id):
    with open(CHECKPOINT_FILE, "a") as f:
        f.write(f"{flow_id}\n")

def orchestrate_p2s():
    # 1. Đọc các flow đã hoàn thành từ trước
    processed_flows = load_processed_flows()

    flows = {}
    with open(COMPILED_TRACES_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            step = json.loads(line)
            flow_id = step["flow_id"]
            if flow_id not in flows:
                flows[flow_id] = []
            flows[flow_id].append(step)

    print(f"[INFO] Loaded {len(flows)} execution flows for fuzzying.")

    for flow_id, steps in flows.items():
        # 2. KIỂM TRA CHECKPOINT: Nếu flow này đã xử lý thành công trước đó, bỏ qua!
        if flow_id in processed_flows:
            print(f"[CHECKPOINT] Flow {flow_id} already processed. Skipping.")
            continue

        print(f"\n[FLOW] Processing Flow: {flow_id} ({len(steps)} steps)")
        
        # Bước 1: Khởi tạo lại một database trống
        run_admin_sql(f"DROP DATABASE IF EXISTS {ACTIVE_DB_NAME};")
        run_admin_sql(f"CREATE DATABASE {ACTIVE_DB_NAME};")
        # Đồng bộ hóa cấu trúc
        subprocess.run(f"DATABASE_URL=\"postgresql://postgres:postgres@localhost:5434/{ACTIVE_DB_NAME}?schema=public\" npx prisma db push --accept-data-loss", shell=True, capture_output=True)
        # Seeding
        subprocess.run(f"npx prisma db execute --file=prisma/migrations/010_seed.sql --url=\"postgresql://postgres:postgres@localhost:5434/{ACTIVE_DB_NAME}?schema=public\"", shell=True, capture_output=True)

        # Bước 2: Chạy tuần tự các bước từ 1 đến N-1 để thiết lập trạng thái chính xác
        # ─── ĐOẠN MỚI: ĐỘT BIẾN MỌI BƯỚC TRONG LUỒNG (MULTI-STEP MUTATION) ───
        for t_idx in range(len(steps)):
            target_step = steps[t_idx]
            pre_steps = steps[:t_idx]
            current_step_num = target_step["step"]
            
            print(f"  [STEP LOOP] Mutating Step {current_step_num}/{len(steps)} of Flow {flow_id}")

            # Đóng băng trạng thái DB trước bước target_step
            # Nếu là bước 1 (chưa có lịch sử), ta reset DB về trạng thái sạch ban đầu
            if len(pre_steps) == 0:
                run_admin_sql(f"DROP DATABASE IF EXISTS {ACTIVE_DB_NAME};")
                run_admin_sql(f"CREATE DATABASE {ACTIVE_DB_NAME};")
                subprocess.run(f"DATABASE_URL=\"postgresql://postgres:postgres@localhost:5434/{ACTIVE_DB_NAME}?schema=public\" npx prisma db push --accept-data-loss", shell=True, capture_output=True)
                subprocess.run(f"npx prisma db execute --file=prisma/migrations/010_seed.sql --url=\"postgresql://postgres:postgres@localhost:5434/{ACTIVE_DB_NAME}?schema=public\"", shell=True, capture_output=True)
                create_snapshot_template()
            else:
                # Nếu từ bước 2 trở đi, ta khôi phục nhanh về snapshot cũ, chạy thêm bước sát sườn, rồi tạo snapshot mới
                restore_from_snapshot()
                execute_ocli_command(pre_steps[-1]["ocli_command"])
                create_snapshot_template()

            # Thiết lập lịch sử hội thoại cho LLM
            history_str = "\n".join([f"Step {s['step']}: {s['ocli_command']}" for s in pre_steps])
            target_schema = json.dumps(target_step["request"], indent=2)
            
            prompt = f"""=== STATE HISTORY ===
{history_str if pre_steps else '(No history. This is Step 1)'}

=== TARGET ENDPOINT SCHEMA ===
{target_schema}

Generate a mutated ocli command targeting this endpoint."""

            messages = [
                {"role": "system", "content": SYSTEM_TAXONOMY_PROMPT},
                {"role": "user", "content": prompt}
            ]

            

        # Vòng lặp đột biến và tự sửa lỗi (Critic Loop)
        for attempt in range(3): # Tăng lên 3 lần thử (1 gốc + 2 lần sửa)
            print(f"[TEACHER] Requesting mutation. Attempt {attempt + 1}...")
            
            try:
                llm_output = call_teacher_llm(messages)
            except Exception as e:
                print(f"[ERROR] Failed to communicate with LM Studio: {e}")
                break

            reasoning = llm_output.get("reasoning", "")
            mutated_cmd = llm_output.get("mutated_command", "")
            print(f"[MUTANT] Target Vector: {reasoning}")
            print(f"[MUTANT] Generated Command: {mutated_cmd}")

            # Khôi phục trạng thái DB sạch từ Snapshot
            restore_from_snapshot()

            # Thực thi đột biến
            code, stdout, stderr = execute_ocli_command(mutated_cmd)
            response_indicator = stdout + stderr

            # 1. Phát hiện lỗi CÚ PHÁP của OCLI (Command failed to even reach the API)
            is_cli_syntax_error = "Unknown command" in response_indicator or "Unknown argument" in response_indicator or "Usage:" in response_indicator or "Yargs Error" in response_indicator

            # 2. Phát hiện lỗi VALIDATION của NestJS (Zod 400 Bad Request)
            is_400_error = "statusCode: 400" in response_indicator or "Bad Request" in response_indicator or "Validation failed" in response_indicator

            if is_cli_syntax_error:
                print(f"[CRITIC] OCLI Syntax Error detected. Triggering self-correction...")
                messages.append({"role": "assistant", "content": json.dumps(llm_output)})
                messages.append({
                    "role": "user", 
                    "content": f"Your command failed CLI syntax validation. Output: {response_indicator}. DO NOT use --data. Use individual flags like --isAdmin true. Fix the command."
                })
                continue # Bắt LLM làm lại

            if is_400_error:
                print(f"[CRITIC] Mutant blocked by input schema validation (400). Triggering self-correction...")
                messages.append({"role": "assistant", "content": json.dumps(llm_output)})
                messages.append({
                    "role": "user", 
                    "content": f"The execution failed with HTTP 400. Server output: {response_indicator}. Refine your mutated command to satisfy schema types or min/max lengths while maintaining the core exploit."
                })
                continue # Bắt LLM làm lại

            # 3. Phân tích kết quả thực thi thành công (Strict Oracle)
            # A true crash is ONLY a 500
            is_500_crash = ("statusCode: 500" in response_indicator) or ("Internal Server Error" in response_indicator) or (code == 500)
            
            # A true RBAC bypass is ONLY a 2xx Success when the LLM was trying to do BOLA/BFLA
            # (404 Not Found, 401 Unauthorized, 400 Bad Request are NOT bypasses)
            is_2xx_success = ("statusCode: 2" in response_indicator) or (200 <= code <= 299)
            is_rbac_bypass = is_2xx_success and ("BOLA" in reasoning or "Bypass" in reasoning)

            if is_500_crash or is_rbac_bypass:
                label = "GOLDEN_CRASH" if is_500_crash else "GOLDEN_RBAC_BYPASS"
                print(f"[SUCCESS] {label} verified! Adding to GOLDEN dataset.")
                
                golden_record = {
                    "messages": [
                        {"role": "system", "content": SYSTEM_TAXONOMY_PROMPT},
                        {"role": "user", "content": prompt},
                        {"role": "assistant", "content": f"<think>\n{reasoning}\nThis targets a deep architectural flaw. I expect this to bypass validation and hit the core logic.\n</think>\n\n```bash\n{mutated_cmd}\n```"}
                    ]
                }
                with open(GOLDEN_DATASET_FILE, "a", encoding="utf-8") as gf:
                    gf.write(json.dumps(golden_record, ensure_ascii=False) + "\n")
                break
            else:
                # Nếu bị chặn bởi 400, 401, 403, 404, 409, 422 -> Đây là khiên bảo vệ hoạt động tốt
                print("[INFO] Mutant was safely caught by the API's defensive boundary (4xx). Saving as SILVER record.")
                
                silver_record = {
                    "messages": [
                        {"role": "system", "content": SYSTEM_TAXONOMY_PROMPT},
                        {"role": "user", "content": prompt},
                        {"role": "assistant", "content": f"<think>\n{reasoning}\nThis targets a shallow framework vulnerability. I expect the API's defensive boundary (e.g., Zod validation or Role Guards) to safely reject this with a 4xx client error.\n</think>\n\n```bash\n{mutated_cmd}\n```"}
                    ]
                }
                with open("silver_dataset.jsonl", "a", encoding="utf-8") as sf:
                    sf.write(json.dumps(silver_record, ensure_ascii=False) + "\n")
                break

if __name__ == "__main__":
    orchestrate_p2s()