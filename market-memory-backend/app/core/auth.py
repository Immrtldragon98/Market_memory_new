from dataclasses import dataclass

from fastapi import Header, HTTPException, status
from supabase import Client

from app.core.database import auth_client, user_client


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None
    db: Client


def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        response = auth_client.auth.get_user(token)
        user = response.user
        if not user:
            raise ValueError("No user")
        return AuthenticatedUser(id=str(user.id), email=getattr(user, "email", None), db=user_client(token))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session") from exc
