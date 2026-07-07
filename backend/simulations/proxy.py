import json
import os
import re
import sys
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer, ThreadingHTTPServer
import httpx

# Configuration
PORT = 8080
OUTPUT_FILE = "primitive_traces.jsonl"

# Global state to track active flows
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

        full_url = self.path
        if not full_url.startswith("http://") and not full_url.startswith("https://"):
            # Fallback for direct non-proxied calls
            host = self.headers.get("Host", "localhost:3001")
            full_url = f"http://{host}{self.path}"

        parsed_url = httpx.URL(full_url)
        path_only = parsed_url.path
        if parsed_url.query:
            path_only += f"?{parsed_url.query.decode('utf-8')}"

        if path_only == "/auth/register" and method == "POST":
            current_flow_id = f"flow_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}"
            step_counter = 1
            print(f"\n[PROXY] Detected Registration. Starting fresh Flow: {current_flow_id}")
        else:
            step_counter += 1

        # Read Request Body
        content_length = int(self.headers.get("Content-Length", 0))
        req_body_bytes = self.rfile.read(content_length) if content_length > 0 else b""

        # Prepare headers for forwarding (strip proxy-specific headers)
        forward_headers = {}
        for k, v in self.headers.items():
            if k.lower() not in ["host", "proxy-connection", "connection", "content-length"]:
                forward_headers[k] = v

        # Forward the request to the target server
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

        # Read Response Body
        res_body_bytes = response.content

        # Send response back to the client (cURL/Bash)
        self.send_response(response.status_code)
        for k, v in response.headers.items():
            if k.lower() not in ["transfer-encoding", "content-length", "connection"]:
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(res_body_bytes)))
        self.end_headers()
        self.wfile.write(res_body_bytes)

        # Log the intercepted transaction to primitive_traces.jsonl
        self.log_transaction(
            method=method,
            path=path_only,
            req_headers=dict(self.headers),
            req_body=req_body_bytes,
            status_code=response.status_code,
            res_body=res_body_bytes
        )

    def do_GET(self):    self.do_request("GET")
    def do_POST(self):   self.do_request("POST")
    def do_PUT(self):    self.do_request("PUT")
    def do_PATCH(self):  self.do_request("PATCH")
    def do_DELETE(self): self.do_request("DELETE")

    def log_transaction(
        self, method: str, path: str, req_headers: dict,
        req_body: bytes, status_code: int, res_body: bytes
    ):
        # Do not log standard health checks (too noisy)
        if path == "/health":
            return

        # Attempt to parse bodies as JSON for readability; fallback to raw string
        try:
            req_json = json.loads(req_body.decode("utf-8")) if req_body else None
        except Exception:
            req_json = req_body.decode("utf-8", errors="ignore") if req_body else None

        try:
            res_json = json.loads(res_body.decode("utf-8")) if res_body else None
        except Exception:
            res_json = res_body.decode("utf-8", errors="ignore") if res_body else None

        # Sanitize headers (remove sensitive values to prevent token leakage in prompts)
        sanitized_headers = {}
        for k, v in req_headers.items():
            if k.lower() in ["authorization", "x-sepay-signature"]:
                sanitized_headers[k] = f"<{k.upper()}_MASKED>"
            else:
                sanitized_headers[k] = v

        trace_step = {
            "flow_id": current_flow_id,
            "step": step_counter,
            "timestamp": datetime.now().isoformat(),
            "request": {
                "method": method,
                "path": path,
                "headers": sanitized_headers,
                "body": req_json
            },
            "response": {
                "status_code": status_code,
                "body": res_json
            }
        }

        # Thread-safe append to JSONL file
        with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(trace_step, ensure_ascii=False) + "\n")

        print(f"[PROXY] ✓ Logged Step {step_counter} for {current_flow_id}: {method} {path} → {status_code}")


def run_proxy():
    # Use ThreadingHTTPServer to handle rapid sequential requests from scripts safely
    server = ThreadingHTTPServer(("localhost", PORT), TransparentProxyHandler)
    print(f"==================================================")
    print(f" AITasker Transparent Proxy actively listening on port {PORT}")
    print(f" Append-logging to: {os.path.abspath(OUTPUT_FILE)}")
    print(f"==================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[PROXY] Shutting down.")
        server.shutdown()

if __name__ == "__main__":
    run_proxy()