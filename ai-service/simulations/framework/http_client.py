"""
HTTP client for simulations — hits the REAL running uvicorn server.

Unlike integration tests (ASGI transport, in-process), simulations make
actual TCP connections to http://localhost:8000. This means:
  - The uvicorn console WILL show request logs
  - The full HTTP stack is exercised (headers, body serialisation, etc.)
  - The server must be running: uvicorn app.main:app --reload --port 8000

This is exactly what NestJS does in production — a real HTTP call over the
internal Railway network to the ai-service service URL.
"""

import time
import httpx


async def call(
    method:   str,
    path:     str,
    payload:  dict | None = None,
    params:   dict | None = None,
    base_url: str         = "http://localhost:8000",
    timeout:  float       = 60.0,
) -> tuple[int, dict, float]:
    """
    Make one real HTTP request to the running ai-service.

    Returns:
        (status_code, response_body_as_dict, elapsed_seconds)

    On network error: returns (0, {"_error": str(exc)}, elapsed).
    On non-JSON response: returns (status, {"_raw": text}, elapsed).
    """
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=timeout) as client:
            if method.upper() == "GET":
                response = await client.get(path, params=params)
            else:
                response = await client.post(path, json=payload)
            elapsed = time.perf_counter() - t0

            try:
                body = response.json()
            except Exception:
                body = {"_raw": response.text[:500]}

            return response.status_code, body, elapsed

    except httpx.ConnectError as exc:
        return 0, {"_error": f"Connection refused — is the server running? ({exc})"}, time.perf_counter() - t0
    except httpx.TimeoutException as exc:
        return 0, {"_error": f"Request timed out after {timeout}s ({exc})"}, time.perf_counter() - t0
    except Exception as exc:
        return 0, {"_error": str(exc)}, time.perf_counter() - t0


async def health_check(base_url: str = "http://localhost:8000") -> tuple[bool, str]:
    """
    Ping /health before running simulations.

    Returns:
        (reachable: bool, message: str)
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{base_url}/health")
            if response.status_code == 200:
                body = response.json()
                return True, f"OK — {body.get('service', '?')} at {base_url}"
            return False, f"Unexpected status {response.status_code} from /health"
    except httpx.ConnectError:
        return False, (
            f"Cannot reach {base_url} — start the server first:\n"
            "    cd ai-service && uvicorn app.main:app --reload --port 8000"
        )
    except Exception as exc:
        return False, f"Health check error: {exc}"