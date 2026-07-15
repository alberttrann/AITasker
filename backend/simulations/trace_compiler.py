#!/usr/bin/env python3
import json
import re
import shlex
import urllib.parse
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
SWAGGER_FILE = os.path.join(BACKEND_DIR, "swagger.json")
INPUT_TRACE_FILE = os.path.join(BACKEND_DIR, "primitive_traces.jsonl")
OUTPUT_TRACE_FILE = os.path.join(BACKEND_DIR, "compiled_traces.jsonl")

class TraceCompiler:
    def __init__(self, swagger_path):
        self.openapi_spec = self._load_json(swagger_path)
        self.routes, self.methods_by_path = self._build_router_and_method_map()

    def _load_json(self, path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"[ERROR] Could not find {path}. Run: npm run swagger:gen")
            sys.exit(1)

    def _build_router_and_method_map(self):
        routes = []
        methods_by_path = {}
        paths = self.openapi_spec.get('paths', {})
        
        for openapi_path, methods in paths.items():
            methods_by_path[openapi_path] = list(methods.keys())
            
            # Map {id} to regex group (?P<id>[^/]+)
            regex_str = re.sub(r'\{([^}]+)\}', r'(?P<\1>[^/]+)', openapi_path)
            regex_pattern = re.compile(f"^{regex_str}$")
            
            for method, details in methods.items():
                routes.append({
                    "openapi_path": openapi_path,
                    "method": method.upper(),
                    "regex": regex_pattern,
                    "details": details
                })
        return routes, methods_by_path

    def _get_ocli_command_name(self, openapi_path, method):
        """
        Perfectly replicates openapi-to-cli naming logic.
        If a path has multiple methods, append _post / _get. Otherwise, omit it.
        """
        clean_path = openapi_path.strip('/')
        clean_path = re.sub(r'\{([^}]+)\}', r'\1', clean_path)
        cmd_base = clean_path.replace('/', '_')
        
        all_methods = self.methods_by_path.get(openapi_path, [])
        if len(all_methods) > 1:
            return f"ocli {cmd_base}_{method.lower()}"
        else:
            return f"ocli {cmd_base}"

    def compile_step(self, trace_step):
        request = trace_step.get('request', {})
        method = request.get('method', '').upper()
        raw_path = request.get('path', '')

        parsed_url = urllib.parse.urlsplit(raw_path)
        actual_path = parsed_url.path
        query_dict = dict(urllib.parse.parse_qsl(parsed_url.query))

        if actual_path == "/health":
            return None

        # 1. Match Route
        matched_route = None
        path_params = {}
        for route in self.routes:
            if route['method'] == method:
                match = route['regex'].match(actual_path)
                if match:
                    matched_route = route
                    path_params = match.groupdict()
                    break
        
        if not matched_route:
            print(f"[SKIP] Unknown route: {method} {actual_path}")
            return None

        openapi_path = matched_route['openapi_path']
        route_details = matched_route['details']
        
        # 2. Get accurate CLI Command name
        ocli_cmd = self._get_ocli_command_name(openapi_path, method)

        flags = []
        
        # 3. Path & Query parameters
        for k, v in path_params.items():
            flags.append(f"--{k} {shlex.quote(str(v))}")
        for k, v in query_dict.items():
            flags.append(f"--{k} {shlex.quote(str(v))}")

        # 4. JSON Body parameters
        body = request.get('body')
        if body and isinstance(body, dict):
            for k, v in body.items():
                val_str = json.dumps(v) if isinstance(v, (dict, list, bool)) or v is None else str(v)
                flags.append(f"--{k} {shlex.quote(val_str)}")

        # 5. Header parameters (CRITICAL for SePay webhooks)
        defined_params = route_details.get('parameters', [])
        req_headers = request.get('headers', {})
        for param in defined_params:
            if param.get('in') == 'header':
                header_name = param.get('name')
                # Case-insensitive lookup in intercepted headers
                for req_h_key, req_h_val in req_headers.items():
                    if req_h_key.lower() == header_name.lower():
                        flags.append(f"--{header_name} {shlex.quote(str(req_h_val))}")

        # Final Assembly
        trace_step['ocli_command'] = f"{ocli_cmd} {' '.join(flags)}".strip()
        trace_step['openapi_path'] = openapi_path
        
        return trace_step

    def run(self):
        print("Loading Swagger Router...")
        compiled_traces = []
        
        with open(INPUT_TRACE_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): continue
                trace_step = json.loads(line)
                compiled_step = self.compile_step(trace_step)
                if compiled_step:
                    compiled_traces.append(compiled_step)
        
        with open(OUTPUT_TRACE_FILE, 'w', encoding='utf-8') as f:
            for step in compiled_traces:
                f.write(json.dumps(step, ensure_ascii=False) + '\n')
                
        print(f" Compiled {len(compiled_traces)} raw requests to OCLI syntax!")

if __name__ == "__main__":
    compiler = TraceCompiler(SWAGGER_FILE)
    compiler.run()