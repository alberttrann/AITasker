from fastapi import HTTPException, Header
from app.config import settings


async def verify_internal_token(x_internal_token: str = Header(...)):
    """
    Lightweight guard — NestJS passes X-Internal-Token on every call so the
    ai-service is not publicly callable without the shared secret.

    Usage (in any router that needs protection):
        from app.dependencies import verify_internal_token
        from fastapi import Depends

        @router.post("/sensitive-endpoint", dependencies=[Depends(verify_internal_token)])
        async def sensitive():
            ...

    The secret is set via env var INTERNAL_SECRET (not required in dev — guard is
    disabled when the value is empty so local testing works without extra config).
    """
    secret = getattr(settings, "internal_secret", "") or ""
    if secret and x_internal_token != secret:
        raise HTTPException(status_code=403, detail="Not authorised")