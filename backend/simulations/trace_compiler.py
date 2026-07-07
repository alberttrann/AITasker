#!/usr/bin/env python3
import json
import re
import shlex
import urllib.parse
import sys
import os

# --- ABSOLUTE PATH RESOLUTION ---
# Automatically finds the 'backend' folder regardless of where you run the script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)

SWAGGER_FILE = os.path.join(BACKEND_DIR, "swagger.json")
INPUT_TRACE_FILE = os.path.join(BACKEND_DIR, "primitive_traces.jsonl")
OUTPUT_TRACE_FILE = os.path.join(BACKEND_DIR, "compiled_traces.jsonl")
# --------------------------------



class TraceCompiler:
    def __init__(self, swagger_path):
        self.openapi_spec = self._load_json(swagger_path)
        self.routes = self._build_regex_router()

    def _load_json(self, path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"[LỖI] Không tìm thấy file {path}. Hãy chạy: curl -o swagger.json http://localhost:3001/api-json")
            sys.exit(1)

    def _build_regex_router(self):
        """
        Đọc tất cả các paths từ Swagger và chuyển {param} thành Regex.
        Ví dụ: /projects/{id}/artifact-b -> ^/projects/(?P<id>[^/]+)/artifact-b$
        """
        routes = []
        paths = self.openapi_spec.get('paths', {})
        for openapi_path, methods in paths.items():
            # Thay thế {var_name} bằng named regex group (?P<var_name>[^/]+)
            regex_str = re.sub(r'\{([^}]+)\}', r'(?P<\1>[^/]+)', openapi_path)
            regex_pattern = re.compile(f"^{regex_str}$")
            
            for method, details in methods.items():
                routes.append({
                    "openapi_path": openapi_path,
                    "method": method.upper(),
                    "regex": regex_pattern,
                })
        return routes

    def _get_ocli_command_name(self, openapi_path, method):
        """
        Chuyển OpenAPI path thành tên lệnh ocli chuẩn.
        /elicitation/sessions/{id}/stage1 + PUT -> elicitation_sessions_id_stage1_put
        """
        clean_path = openapi_path.strip('/')
        # Bỏ dấu {} bao quanh biến
        clean_path = re.sub(r'\{([^}]+)\}', r'\1', clean_path)
        # Thay / bằng _
        cmd_base = clean_path.replace('/', '_')
        return f"ocli {cmd_base}_{method.lower()}"

    def compile_step(self, trace_step):
        request = trace_step.get('request', {})
        method = request.get('method', '').upper()
        raw_path = request.get('path', '')

        # Tách path và query string
        parsed_url = urllib.parse.urlsplit(raw_path)
        actual_path = parsed_url.path
        query_dict = dict(urllib.parse.parse_qsl(parsed_url.query))

        # Bỏ qua health check
        if actual_path == "/health":
            return None

        # 1. Tìm OpenAPI Path khớp với URL thực tế
        matched_route = None
        path_params = {}
        for route in self.routes:
            if route['method'] == method:
                match = route['regex'].match(actual_path)
                if match:
                    matched_route = route
                    path_params = match.groupdict() # Lấy được {id: "1234"}
                    break
        
        if not matched_route:
            print(f"[BỎ QUA] Không tìm thấy route map cho: {method} {actual_path}")
            return None

        openapi_path = matched_route['openapi_path']
        
        # 2. Sinh tên lệnh ocli
        ocli_cmd = self._get_ocli_command_name(openapi_path, method)

        # 3. Gom tham số (Path, Query, Body) thành Bash Flags
        flags = []
        
        # Thêm Path params
        for k, v in path_params.items():
            flags.append(f"--{k} {shlex.quote(str(v))}")
            
        # Thêm Query params
        for k, v in query_dict.items():
            flags.append(f"--{k} {shlex.quote(str(v))}")
            
        # Thêm Body params
        body = request.get('body')
        if body and isinstance(body, dict):
            for k, v in body.items():
                if isinstance(v, (dict, list, bool)) or v is None:
                    # Nếu là JSON nested, mảng, hoặc bool, cần dump ra chuỗi JSON
                    val_str = json.dumps(v)
                else:
                    val_str = str(v)
                flags.append(f"--{k} {shlex.quote(val_str)}")

        # Lắp ráp command hoàn chỉnh
        compiled_command = f"{ocli_cmd} {' '.join(flags)}".strip()

        # Cập nhật object JSON
        trace_step['ocli_command'] = compiled_command
        trace_step['openapi_path'] = openapi_path
        
        return trace_step

    def run(self):
        print("Đang tải Swagger Router...")
        compiled_traces = []
        
        with open(INPUT_TRACE_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): continue
                trace_step = json.loads(line)
                
                compiled_step = self.compile_step(trace_step)
                if compiled_step:
                    compiled_traces.append(compiled_step)
        
        # Ghi đè vào file output
        with open(OUTPUT_TRACE_FILE, 'w', encoding='utf-8') as f:
            for step in compiled_traces:
                f.write(json.dumps(step, ensure_ascii=False) + '\n')
                
        print(f" Đã biên dịch {len(compiled_traces)} requests thô sang ocli CLI!")
        print(f" Lưu tại: {OUTPUT_TRACE_FILE}")

if __name__ == "__main__":
    compiler = TraceCompiler(SWAGGER_FILE)
    compiler.run()