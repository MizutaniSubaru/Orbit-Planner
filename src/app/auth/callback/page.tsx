'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const supabase = getSupabaseClient();
  const code =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('code');

  useEffect(() => {
    if (!supabase || !code) {
      return;
    }

    void supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          throw error;
        }

        router.replace('/');
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'Sign-in failed.');
      });
  }, [code, router, supabase]);

  return (
    <main className="callback-shell">
      <section className="callback-card">
        <p>{message ?? (!supabase || !code ? 'Missing Supabase configuration or auth code.' : 'Finishing Google sign-in...')}</p>
      </section>
    </main>
  );
}
