import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

const BASE_URL = Constants.expoConfig?.extra?.apiUrl as string | undefined;

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL) throw new Error('API URL is not configured.');

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  let token = data.session?.access_token;
  if (!token) throw new Error('Please sign in first.');

  const call = (accessToken: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    return fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
    }).finally(() => clearTimeout(timeout));
  };

  let response: Response;
  try { response = await call(token); }
  catch (requestError) {
    if (requestError instanceof Error && requestError.name === 'AbortError') throw new Error('The service took too long to respond. Please retry.');
    throw new Error('Cannot reach Market Memory right now. Check your connection and retry.');
  }

  if (response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token;
    if (!token || refreshed.error) { await supabase.auth.signOut(); throw new Error('Your session expired. Please sign in again.'); }
    response = await call(token);
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {}
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}
