import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not configured.');
  }

  return { anonKey, url };
}

export function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing bearer token.');
  }

  return authHeader.slice('Bearer '.length);
}

export async function getAuthenticatedServerClient(request: Request) {
  const token = getBearerToken(request);
  const { anonKey, url } = getEnv();

  const supabase = createClient<Database>(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Unauthorized request.');
  }

  return { supabase, token, user };
}

export function asApiError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export type AuthenticatedRequestContext = {
  supabase: ReturnType<typeof createClient<Database>>;
  token: string;
  user: User;
};
