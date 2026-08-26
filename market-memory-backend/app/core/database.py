from supabase import Client, create_client

from app.core.config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
auth_client: Client = create_client(settings.supabase_url, settings.supabase_anon_key)
