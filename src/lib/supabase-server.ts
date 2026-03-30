import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';
import { getSupabaseConfig } from '@/lib/supabase';

export async function getSupabaseServerClient() {
    const { anonKey, url } = getSupabaseConfig();

    if (!url || !anonKey) {
        return null;
    }

    const cookieStore = await cookies();

    return createServerClient<Database>(url, anonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, options, value }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Ignore immutable cookie-store contexts.
                }
            },
        },
    });
}
