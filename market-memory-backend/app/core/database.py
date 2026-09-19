from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions

from app.core.config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
auth_client: Client = create_client(settings.supabase_url, settings.supabase_anon_key)


def user_client(access_token: str) -> Client:
    """Create a request-local client whose Authorization header enforces RLS."""
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(headers={"Authorization": f"Bearer {access_token}"}),
    )


def db_for(user):
    """Production users carry an RLS client; the fallback keeps unit fakes simple."""
    return getattr(user, "db", supabase)
