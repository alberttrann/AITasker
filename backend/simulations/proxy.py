#!/usr/bin/env python3
import json
import os
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import httpx

PORT = 8080
OUTPUT_FILE = "primitive_traces.jsonl"

current_flow_id = str(uuid.uuid4())
step_counter = 0

class TransparentProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def handle_error(self, status_code: int, message: str):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode("utf-8"))

    def do_request(self, method: str):
        global current_flow_id, step_counter

        # ── SỬA ĐỔI CHÍNH: Ép cổng đích về 3001 để tránh vòng lặp vô hạn ──
        # Đọc path động
        path_only = self.path
        if path_only.startswith("http://") or path_only.startswith("https://"):
            parsed_url = httpx.URL(path_only)
            path_only = parsed_url.path
            if parsed_url.query:
                path_only += f"?{parsed_url.query.decode('utf-8')}"
        
        # Luôn luôn chuyển tiếp dữ liệu đến cổng backend thực tế 3001
        target_backend_port = os.getenv("TARGET_PORT", "3001")
        full_url = f"http://localhost:{target_backend_port}{path_only}"

        # ── SMART FLOW DETECTION ─────────────────────────────────────────────
        if path_only in ["/auth/register", "/auth/login"] and method == "POST":
            current_flow_id = f"flow_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}"
            step_counter = 1
            print(f"\n[PROXY]  New Session Detected. Flow ID: {current_flow_id}")
        else:
            step_counter += 1

        content_length = int(self.headers.get("Content-Length", 0))
        req_body_bytes = self.rfile.read(content_length) if content_length > 0 else b""

        # Thiết lập Header chuyển tiếp sạch
        forward_headers = {}
        for k, v in self.headers.items():
            if k.lower() not in ["host", "proxy-connection", "connection", "content-length"]:
                forward_headers[k] = v
        # Ghi đè Host header để NestJS hiểu đúng nguồn gốc dữ liệu
        forward_headers["Host"] = f"localhost:{target_backend_port}"

        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.request(
                    method=method,
                    url=full_url,
                    headers=forward_headers,
                    content=req_body_bytes,
                )
        except Exception as exc:
            print(f"[PROXY] ✗ Failed to forward request to {full_url}: {exc}")
            self.handle_error(502, f"Bad Gateway: {exc}")
            return

        res_body_bytes = response.content

        self.send_response(response.status_code)
        for k, v in response.headers.items():
            if k.lower() not in ["transfer-encoding", "content-length", "connection"]:
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(res_body_bytes)))
        self.end_headers()
        self.wfile.write(res_body_bytes)

        self.log_transaction(method, path_only, dict(self.headers), req_body_bytes, response.status_code, res_body_bytes)

    def do_GET(self):    self.do_request("GET")
    def do_POST(self):   self.do_request("POST")
    def do_PUT(self):    self.do_request("PUT")
    def do_PATCH(self):  self.do_request("PATCH")
    def do_DELETE(self): self.do_request("DELETE")

    def log_transaction(self, method, path, req_headers, req_body, status_code, res_body):
        if path == "/health":
            return

        try: req_json = json.loads(req_body.decode("utf-8")) if req_body else None
        except: req_json = req_body.decode("utf-8", errors="ignore") if req_body else None

        try: res_json = json.loads(res_body.decode("utf-8")) if res_body else None
        except: res_json = res_body.decode("utf-8", errors="ignore") if res_body else None

        trace_step = {
            "flow_id": current_flow_id,
            "step": step_counter,
            "request": {
                "method": method,
                "path": path,
                "headers": req_headers, # REAL headers retained
                "body": req_json
            },
            "response": {
                "status_code": status_code,
                "body": res_json
            }
        }

        with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(trace_step, ensure_ascii=False) + "\n")
        print(f"[PROXY] ✓ Logged Step {step_counter}: {method} {path} → {status_code}")

if __name__ == "__main__":
    server = ThreadingHTTPServer(("localhost", PORT), TransparentProxyHandler)
    print(f"==================================================")
    print(f" Proxy listening on port {PORT}. Output: {OUTPUT_FILE}")
    print(f"==================================================")
    server.serve_forever()