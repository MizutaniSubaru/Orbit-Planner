import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseConfig() {
  return {
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  };
}

export function isSupabaseConfigured() {
  const { anonKey, url } = getSupabaseConfig();
  return Boolean(anonKey && url);
}

export function getSupabaseClient() {
  const { anonKey, url } = getSupabaseConfig();

  if (!url || !anonKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient<Database>(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
  }

  return supabaseClient;
}
