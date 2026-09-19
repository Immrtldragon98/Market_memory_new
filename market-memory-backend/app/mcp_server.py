"""Authenticated, read-only MCP access to a user's Market Memory data."""

from typing import Any
from datetime import date

from mcp.server import MCPServer
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import AnyHttpUrl
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.database import auth_client, supabase


class SupabaseTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> AccessToken | None:
        try:
            response = await run_in_threadpool(auth_client.auth.get_user, token)
            if not response.user:
                return None
            user_id = str(response.user.id)
            return AccessToken(token=token, client_id=user_id, subject=user_id, scopes=["market-memory:read"])
        except Exception:
            return None


def _user_id() -> str:
    access_token = get_access_token()
    if not access_token or not access_token.subject:
        raise PermissionError("An authenticated Supabase user is required")
    return access_token.subject


def _recent_rows(user_id: str, symbol: str | None, limit: int) -> list[dict[str, Any]]:
    query = (supabase.table("journal_entries")
             .select("id,symbol,title,note,confidence,entry_type,decision_action,invalidation,review_due_on,reviewed_at,lesson,created_at")
             .eq("user_id", user_id))
    if symbol:
        query = query.eq("symbol", symbol.strip().upper())
    return query.order("created_at", desc=True).limit(limit).execute().data or []


def _due_rows(user_id: str, limit: int) -> list[dict[str, Any]]:
    return (supabase.table("journal_entries")
            .select("id,symbol,title,note,review_due_on,created_at")
            .eq("user_id", user_id).is_("reviewed_at", "null")
            .lte("review_due_on", date.today().isoformat())
            .order("review_due_on").limit(limit).execute().data or [])


def build_mcp_server() -> MCPServer | None:
    if not settings.mcp_public_url:
        return None
    server = MCPServer(
        name="Market Memory",
        instructions="Read-only access to the authenticated user's investment journal.",
        token_verifier=SupabaseTokenVerifier(),
        auth=AuthSettings(
            issuer_url=AnyHttpUrl(f"{settings.supabase_url.rstrip('/')}/auth/v1"),
            resource_server_url=AnyHttpUrl(settings.mcp_public_url),
            required_scopes=["market-memory:read"],
            validate_token_resource=False,
        ),
    )

    @server.tool()
    async def list_recent_journal_entries(symbol: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        """List the current user's recent journal entries, optionally for one symbol."""
        return await run_in_threadpool(_recent_rows, _user_id(), symbol, min(max(limit, 1), 50))

    @server.tool()
    async def list_due_reviews(limit: int = 20) -> list[dict[str, Any]]:
        """List the current user's incomplete reviews in due-date order."""
        return await run_in_threadpool(_due_rows, _user_id(), min(max(limit, 1), 50))

    return server


def build_mcp_app(server: MCPServer):
    return server.streamable_http_app(
        streamable_http_path="/",
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=settings.mcp_allowed_host_list,
            allowed_origins=settings.cors_origin_list,
        ),
    )
