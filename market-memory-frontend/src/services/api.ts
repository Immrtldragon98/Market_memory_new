import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

const BASE_URL = Constants.expoConfig?.extra?.apiUrl as string | undefined;

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL) throw new Error('API URL is not configured.');

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in first.');

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

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
