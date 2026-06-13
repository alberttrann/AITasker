from fastapi import HTTPException, Header
from app.config import settings


async def verify_internal_token(x_internal_token: str = Header(...)):
    """
    Lightweight guard — NestJS passes a shared secret header on every call.
    Prevents accidental direct public access to the LLM service.
    """
    if x_internal_token != settings.internal_secret:
        raise HTTPException(status_code=403, detail="Not authorised")


