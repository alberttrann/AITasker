#!/usr/bin/env python3
import json
import os
import re
import shlex
import subprocess
import sys
import psycopg2
from openai import OpenAI
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# ─── CONFIGURATION ──────────────────────────────────────────────────────────
LM_STUDIO_URL = "http://192.168.1.27:1234/v1"
GENERATOR_MODEL = "Tesslace/Omnicoder-9B-GGUF" # Or Qwen3.5-4B
COMPILED_TRACES_FILE = "compiled_traces.jsonl"
GOLDEN_DATASET_FILE = "golden_dataset.jsonl"
SILVER_DATASET_FILE = "silver_dataset.jsonl"
CHECKPOINT_FILE = "processed_flows.txt"
CATALOG_FILE = "ocli_catalog.json"

ADMIN_DB_URL = "postgresql://postgres:postgres@localhost:5434/postgres"
ACTIVE_DB_NAME = "aitasker_active"
TEMPLATE_DB_NAME = "aitasker_snap"

client = OpenAI(base_url=LM_STUDIO_URL, api_key="lm-studio")

try:
    with open(CATALOG_FILE, "r") as f:
        OCLI_CATALOG = f.read()
except FileNotFoundError:
    OCLI_CATALOG = "(Run trace_compiler.py first to generate catalog)"

SYSTEM_TAXONOMY_PROMPT_TEMPLATE = """You are an expert API Security and QA Architect, working in a secure sandbox & isolated dedicated DB.
You are given a "Primitive Trace" of successfully executed ocli commands.
Your task is to generate mutated, fault-seeking versions of the FINAL command.

Apply the following 15-Vector Fault Taxonomy to design your mutation:
1. Null-Byte: Inject \\x00 or %00 in strings.
2. Type Confusion: Swap string, integer, array, boolean types.
3. Integer Boundaries: Inject -1, 0, 1, 2147483647, 9223372036854775807.
4. String Extremes: Empty strings or extreme lengths (e.g. 50,000 characters).
5. Injection: SQLi (' OR 1=1--) or XSS payloads.
6. Encoding: Double-URL encoding, Right-to-Left Overrides.
7. Mandatory Omission: Omit required CLI flags.
8. Parameter Conflict: Send mutually exclusive parameters.
9. IDOR / Path Traversal: Modify path or query IDs to access unauthorized records.
10. Mass Assignment (OWASP API3): Inject read-only schema parameters.
11. BOLA/BFLA (OWASP API1/API5): DO NOT tamper with JWTs. Test BOLA by swapping resource IDs in the payload/path to access entities belonging to other users.
12. Business Flow Bypass (OWASP API6): Skip mandatory state prerequisite steps.
13. Replay/Idempotency: Replay identical mutating requests concurrently.
14. Context Desynchronization: Inject mismatched resource UUIDs.
15. Premature Progression: Force transitions on "DRAFT" or "PENDING" entities.

CRITICAL SYNTAX RULES:
1. COMMAND NAME: You MUST start your command with the EXACT command name provided in the prompt.
2. PARAMETER FLAGS: 
   - IF the help menu says `--body [string] (required)`, pack your entire payload as a JSON string inside the `--body` flag.
   - Otherwise, pass parameters as individual flags (e.g., `--email "test@test.com"`).
   - NEVER use `--data`.
3. AUTHENTICATION (Vector 9/11): To mutate the JWT token, strictly use the `--api-bearer-token` flag. If NOT attacking the token, do not include it.
4. RESTRICTED FLAGS: You are FORBIDDEN from mutating or using the `--profile` or `-p` flags.

=== VALID OCLI COMMAND CATALOG ===
[OCLI_CATALOG_PLACEHOLDER]

OUTPUT FORMAT:
You must return a VALID JSON object. DO NOT output markdown outside the JSON. Return ONLY the raw JSON containing exactly two keys:
{
  "reasoning": "A short chain of thought explaining the vulnerability vector you are targeting.",
  "mutated_command": "The complete modified ocli command."
}"""

SYSTEM_TAXONOMY_PROMPT = SYSTEM_TAXONOMY_PROMPT_TEMPLATE.replace("[OCLI_CATALOG_PLACEHOLDER]", OCLI_CATALOG)

# ─── POSTGRESQL TEMPLATE SNAPSHOTTING ────────────────────────────────────────

def run_admin_sql(sql_query):
    conn = psycopg2.connect(ADMIN_DB_URL)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    try: cursor.execute(sql_query)
    except Exception as e: print(f"[DB WARN] Query failed: {sql_query} | Error: {e}")
    finally:
        cursor.close()
        conn.close()

def force_disconnect_clients(db_name):
    sql = f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{db_name}' AND pid <> pg_backend_pid();"
    run_admin_sql(sql)

def create_snapshot_template():
    print(f"[SNAPSHOT] Creating snapshot template '{TEMPLATE_DB_NAME}' from current state...")
    force_disconnect_clients(ACTIVE_DB_NAME)
    run_admin_sql(f"DROP DATABASE IF EXISTS {TEMPLATE_DB_NAME};")
    run_admin_sql(f"CREATE DATABASE {TEMPLATE_DB_NAME} WITH TEMPLATE {ACTIVE_DB_NAME};")

def restore_from_snapshot():
    force_disconnect_clients(ACTIVE_DB_NAME)
    run_admin_sql(f"DROP DATABASE IF EXISTS {ACTIVE_DB_NAME};")
    run_admin_sql(f"CREATE DATABASE {ACTIVE_DB_NAME} WITH TEMPLATE {TEMPLATE_DB_NAME};")

# ─── CORE ORCHESTRATION PIPELINE ─────────────────────────────────────────────

def execute_ocli_command(cmd_str, valid_token=None):
    """Thực thi lệnh an toàn (Safe POSIX execution)."""
    if not cmd_str or str(cmd_str).strip().lower() in ["none", "null", ""]:
        return 1, "", "Error: Executed command is empty or null"
        
    cmd_str = str(cmd_str).strip()
    
    # Vá lỗi gõ nhầm dấu ngoặc nhọn } của AI ở ngoài chuỗi đơn
    if cmd_str.endswith("'}"):
        cmd_str = cmd_str[:-1]
    elif cmd_str.endswith('"}'):
        cmd_str = cmd_str[:-1]

    # ─── BẢN VÁ 3: TỰ ĐỘNG KHỬ DẤU ESCAPE NGƯỢC CỦA AI BÊN TRONG NHÁY ĐƠN ───
    # Nếu AI viết ocli --body '{\\"key\\": \\"val\\"}' -> Dịch lại thành '{"key": "val"}' để JSON.parse không bị lỗi
    body_match = re.search(r"--body\s+'(.*?)'", cmd_str)
    if body_match:
        raw_body_content = body_match.group(1)
        # Gỡ bỏ các dấu gạch chéo ngược escape nháy kép dư thừa
        clean_body_content = raw_body_content.replace('\\"', '"')
        cmd_str = cmd_str.replace(raw_body_content, clean_body_content)
    # ───────────────────────────────────────────────────────────────────────

    env_vars = os.environ.copy()
    env_vars["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5434/aitasker_active?schema=public"
    
    # Auto-inject valid token if the LLM didn't actively mutate it
    if valid_token and "--api-bearer-token" not in cmd_str:
        cmd_str += f" --api-bearer-token {shlex.quote(valid_token)}"
            
    if "--profile" not in cmd_str and "ocli " in cmd_str:
        cmd_str += " --profile aitasker"

    # Bản vá Null-byte tránh crash Windows subprocess
    cmd_str = cmd_str.replace('\x00', '\\x00')

    if sys.platform == "win32":
        shell_exec = None
        for p in [r"C:\Program Files\Git\bin\bash.exe", r"C:\Program Files\Git\usr\bin\bash.exe", os.path.expanduser(r"~\AppData\Local\Programs\Git\bin\bash.exe")]:
            if os.path.exists(p):
                shell_exec = p
                break
        
        if shell_exec:
            try:
                result = subprocess.run([shell_exec, "-c", cmd_str], capture_output=True, text=True, env=env_vars, timeout=15)
                return result.returncode, result.stdout, result.stderr
            except subprocess.TimeoutExpired:
                return 504, "", "Request timed out"

    try:
        result = subprocess.run(cmd_str, shell=True, capture_output=True, text=True, env=env_vars, timeout=15)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 504, "", "Request timed out"

def call_generator_llm(messages, attempt):
    temp = 0.1 if attempt == 0 else 0.4
    response = client.chat.completions.create(
        model=GENERATOR_MODEL,
        messages=messages,
        temperature=temp,
    )
    raw_content = response.choices[0].message.content
    try:
        return json.loads(raw_content, strict=False)
    except json.JSONDecodeError:
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_content, re.DOTALL)
        if match: return json.loads(match.group(1), strict=False)
        start = raw_content.find('{')
        end = raw_content.rfind('}')
        if start != -1 and end != -1: return json.loads(raw_content[start:end+1], strict=False)
        raise ValueError(f"Không thể trích xuất JSON: {raw_content[:100]}...")

def clean_error_message(indicator_str):
    axios_match = re.search(r'status code \d\d\d', indicator_str, re.IGNORECASE)
    if axios_match: return axios_match.group(0).upper()
    
    zod_match = re.search(r'message:.*?[}\n]', indicator_str, re.IGNORECASE)
    if zod_match: return zod_match.group(0)
    
    ocli_match = re.search(r'missing required.*', indicator_str, re.IGNORECASE)
    if ocli_match: return ocli_match.group(0)
        
    return indicator_str[:200].strip()

def load_processed_flows():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, "r") as f:
            return set(line.strip() for line in f if line.strip())
    return set()

def save_processed_flow(flow_id):
    with open(CHECKPOINT_FILE, "a") as f:
        f.write(f"{flow_id}\n")

def orchestrate_p2s():
    processed_flows = load_processed_flows()

    flows = {}
    with open(COMPILED_TRACES_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            step = json.loads(line)
            flows.setdefault(step["flow_id"], []).append(step)

    print(f"[INFO] Loaded {len(flows)} execution flows for fuzzer processing.")

    for flow_id, steps in flows.items():
        if flow_id in processed_flows:
            print(f"[CHECKPOINT] Flow {flow_id} already processed. Skipping.")
            continue

        print(f"\n[FLOW] Processing Flow: {flow_id} ({len(steps)} steps)")
        
        for t_idx in range(len(steps)):
            target_step = steps[t_idx]
            pre_steps = steps[:t_idx]
            current_step_num = target_step["step"]
            
            print(f"  [STEP LOOP] Mutating Step {current_step_num}/{len(steps)} of Flow {flow_id}")

            if len(pre_steps) == 0:
                force_disconnect_clients(ACTIVE_DB_NAME)
                run_admin_sql(f"DROP DATABASE IF EXISTS {ACTIVE_DB_NAME};")
                run_admin_sql(f"CREATE DATABASE {ACTIVE_DB_NAME};")
                subprocess.run(f"DATABASE_URL=\"postgresql://postgres:postgres@localhost:5434/{ACTIVE_DB_NAME}?schema=public\" npx prisma db push --accept-data-loss", shell=True, capture_output=True)
                subprocess.run(f"npx prisma db execute --file=prisma/migrations/010_seed.sql --url=\"postgresql://postgres:postgres@localhost:5434/{ACTIVE_DB_NAME}?schema=public\"", shell=True, capture_output=True)
                create_snapshot_template()
            else:
                restore_from_snapshot()
                execute_ocli_command(pre_steps[-1]["ocli_command"])
                create_snapshot_template()

            history_str = "\n".join([f"Step {s['step']}: {s['ocli_command']}" for s in pre_steps])
            
            # Extract Bearer token dynamically to preserve test workflow context
            valid_token = None
            req_headers = target_step["request"].get("headers", {})
            for k, v in req_headers.items():
                if k.lower() == 'authorization' and str(v).lower().startswith('bearer '):
                    valid_token = str(v)[7:].strip()
            
            req_data = target_step["request"].copy()
            if "headers" in req_data:
                req_data["headers"] = {k: v for k, v in req_data["headers"].items() if k.lower() not in ['host', 'user-agent', 'accept', 'content-length', 'content-type', 'authorization']}
            target_original_request = json.dumps(req_data, indent=2)
            
            cmd_parts = target_step.get("ocli_command", "").strip().split(" ")
            exact_ocli_command_name = f"{cmd_parts[0]} {cmd_parts[1]}" if len(cmd_parts) >= 2 else "ocli"
            
            _, help_stdout, help_stderr = execute_ocli_command(f"{exact_ocli_command_name} --help")
            cli_help_text = help_stdout.strip() if help_stdout.strip() else help_stderr.strip()
            
            # VỆ SINH HELP MENU: Ẩn các cờ hệ thống khỏi tầm mắt của LLM
            cli_help_text = re.sub(r'--profile\s+string.*?\n', '', cli_help_text, flags=re.IGNORECASE)
            cli_help_text = re.sub(r'-p,\s+--profile\s+string.*?\n', '', cli_help_text, flags=re.IGNORECASE)
            
            # ─── BẢN VÁ 2: CẤY CỜ AUTH THÀNH PHẦN VÀO HELP MENU ───────────────
            # Nếu endpoint yêu cầu bảo mật và có Token hợp lệ từ trace, hiển thị cờ này ra
            if valid_token:
                cli_help_text += "\n  --api-bearer-token                    string    (optional) Overrides the default profile JWT authorization token."
            # ───────────────────────────────────────────────────────────────────

            if not cli_help_text.strip():
                cli_help_text = "(No help output available. Stick to the schema keys.)"

            safe_history_str = history_str.replace('\\', '\\\\')
            safe_target_req = target_original_request.replace('\\', '\\\\')
            safe_help_text = cli_help_text.replace('\\', '\\\\')

            prompt = f"""=== STATE HISTORY ===
{safe_history_str if pre_steps else '(No history. This is Step 1)'}

=== TARGET ENDPOINT ORIGINAL REQUEST (For value reference) ===
{safe_target_req}

=== AVAILABLE CLI FLAGS (FROM OCLI HELP) ===
{safe_help_text}

=== EXACT CLI COMMAND TO USE ===
{exact_ocli_command_name}

Generate a mutated ocli command targeting this endpoint. You MUST start your command with `{exact_ocli_command_name}`."""

            # Initialize conversation context for the generator
            messages = [
                {"role": "system", "content": SYSTEM_TAXONOMY_PROMPT},
                {"role": "user", "content": prompt}
            ]

            # ─── DYNAMIC PARAMETERS & STATE EXPLORATION ───────────────────
            MAX_ATTEMPTS = 6
            # ──────────────────────────────────────────────────────────────

            for attempt in range(MAX_ATTEMPTS):
                print(f"    [TEACHER] Requesting mutation. Attempt {attempt + 1}/{MAX_ATTEMPTS}...")
                try: 
                    llm_output = call_generator_llm(messages, attempt)
                except Exception as e:
                    print(f"    [ERROR] Failed to communicate with LM Studio: {e}")
                    break

                reasoning = llm_output.get("reasoning")
                if not reasoning:
                    obs = llm_output.get("observation", "")
                    plan = llm_output.get("correction_plan", "")
                    reasoning = f"{obs}\n{plan}".strip()
                
                mutated_cmd = llm_output.get("mutated_command", "")
                print(f"    [MUTANT] Target Vector: {reasoning[:150]}...")
                print(f"    [MUTANT] Generated Command: {mutated_cmd}")

                restore_from_snapshot()
                
                # Execute mutated CLI command against sandboxed environment
                code, stdout, stderr = execute_ocli_command(mutated_cmd, valid_token=valid_token)
                response_indicator = (stdout + stderr).lower()

                is_network_down = "econnrefused" in response_indicator or "connect" in response_indicator or "api-base-url" in response_indicator
                if is_network_down:
                    print(f"\n[SYSTEM ERROR] ✗ Cannot connect to NestJS on port 3001! Ensure server is running on Sandbox 5434.")
                    sys.exit(1)

                # Strict classification of CLI tool syntax failures vs. actual API responses
                is_cli_syntax_error = (code != 0) and ("status code" not in response_indicator) and ("timed out" not in response_indicator)
                is_api_response = "status code" in response_indicator
                is_500_crash = ("status code 500" in response_indicator) or ("internal server error" in response_indicator) or (code == 500)
                is_2xx_success = (code == 0)

                core_error_message = clean_error_message(stdout + stderr)

                # 1. HARD CLI SYNTAX ERROR (Critic self-correction loop)
                if is_cli_syntax_error:
                    if attempt < (MAX_ATTEMPTS - 1):
                        print(f"    [CRITIC] OCLI Syntax Error: '{core_error_message}'. Triggering self-correction...")
                        
                        # Serialize previous output to structured assistant json to avoid context format pollution
                        critic_assistant_json = {
                            "reasoning": f"My previous command failed CLI validation: {core_error_message}",
                            "mutated_command": mutated_cmd
                        }
                        messages.append({"role": "assistant", "content": json.dumps(critic_assistant_json, ensure_ascii=False)})
                        messages.append({
                            "role": "user",
                            "content": f"Execution Error: {core_error_message}\n\nWARNING: You are strictly FORBIDDEN from generating that exact command again. Generate a corrected ocli command using ONLY valid flags from the AVAILABLE CLI FLAGS."
                        })
                        continue
                    else:
                        print("    [FAIL] CLI Syntax error persisted until final attempt. Discarded.")
                        break

                # 2. VALID API CONNECTIONS (Exploits vs. Mapped Boundaries)
                if is_api_response or is_2xx_success:
                    is_security_attack = bool(re.search(r'bola|bfla|bypass|escalation|mass assignment|unauthorized|idor', reasoning, re.IGNORECASE))
                    is_rbac_bypass = is_2xx_success and is_security_attack

                    # A. Perfect Exploit (GOLDEN) -> Save immediately and terminate exploration
                    if is_500_crash or is_rbac_bypass:
                        label = "GOLDEN_CRASH" if is_500_crash else "GOLDEN_RBAC_BYPASS"
                        print(f"    [SUCCESS] {label} verified! Saving directly to GOLDEN dataset.")
                        golden_record = {
                            "messages": [
                                {"role": "system", "content": SYSTEM_TAXONOMY_PROMPT},
                                {"role": "user", "content": prompt},
                                {"role": "assistant", "content": f"<think>\n{reasoning}\nThis targets a deep architectural flaw. I expect this to bypass validation and hit the core logic.\n</think>\n\n```bash\n{mutated_cmd}\n```\n# ASSERT: status == {201 if is_rbac_bypass else 500}"}
                            ]
                        }
                        with open(GOLDEN_DATASET_FILE, "a", encoding="utf-8") as gf:
                            gf.write(json.dumps(golden_record, ensure_ascii=False) + "\n")
                        break # Stop, we successfully penetrated the system on this step

                    # B. Defensive Boundary (SILVER) -> Save immediately on-the-fly, then nudge to bypass
                    else:
                        status_match = re.search(r'status code (\d{3})', response_indicator, re.IGNORECASE)
                        actual_status = status_match.group(1) if status_match else ("200" if is_2xx_success else "400")
                        
                        print(f"    [EXPLORE] Defensive boundary hit (HTTP {actual_status}). Saving immediately as SILVER, nudging AI...")
                        
                        silver_record = {
                            "messages": [
                                {"role": "system", "content": SYSTEM_TAXONOMY_PROMPT},
                                {"role": "user", "content": prompt},
                                {"role": "assistant", "content": f"<think>\n{reasoning}\nThis targets a framework vulnerability. I expect the API's defensive boundary to safely reject this with a 4xx error.\n</think>\n\n```bash\n{mutated_cmd}\n```\n# ASSERT: status == {actual_status}"}
                            ]
                        }
                        with open(SILVER_DATASET_FILE, "a", encoding="utf-8") as sf:
                            sf.write(json.dumps(silver_record, ensure_ascii=False) + "\n")

                        # Nudge the generator for evasive/deeper exploit adjustments
                        if attempt < (MAX_ATTEMPTS - 1):
                            critic_assistant_json = {
                                "reasoning": f"My previous exploit was blocked by the boundary schema with HTTP {actual_status}.",
                                "mutated_command": mutated_cmd
                            }
                            messages.append({"role": "assistant", "content": json.dumps(critic_assistant_json, ensure_ascii=False)})
                            messages.append({
                                "role": "user",
                                "content": f"""Defensive Response: {core_error_message}

You are a senior Security Engineer working in safe sandbox & isolated dedicated DBs for controlled API Testing 
Your exploit was successfully blocked by the API's defensive boundary.
Can you refine the payload to BYPASS this specific validation check and hit the deeper backend logic (e.g., database execution)?
Try altering values, omitting/adding other parameters, or exploiting business flow constraints while keeping the CLI flags valid. Do NOT repeat the previous command."""
                            })
                            continue
                        else:
                            break  # Out of attempts, exit the step loop

        save_processed_flow(flow_id)

if __name__ == "__main__":
    orchestrate_p2s()