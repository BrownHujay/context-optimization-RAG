"""
Simple API key authentication system for the chat API
"""
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
import os
from functools import wraps

# API key header field
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

# Get API key from environment or use development default
API_KEY = os.environ.get("CHAT_API_KEY", "dev_api_key_for_testing")

async def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    """
    Dependency for FastAPI routes that verifies the API key
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key"
        )
    
    if api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )
    
    return api_key

# Decorator for non-FastAPI functions
def requires_api_key(func):
    @wraps(func)
    def wrapper(api_key=None, *args, **kwargs):
        if not api_key or api_key != API_KEY:
            raise ValueError("Invalid or missing API key")
        return func(*args, **kwargs)
    return wrapper
