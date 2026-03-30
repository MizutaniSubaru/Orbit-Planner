import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

function isSafeRedirectPath(path: string | null): path is string {
    return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const nextPath = requestUrl.searchParams.get('next');
    const redirectTarget = isSafeRedirectPath(nextPath) ? nextPath : '/';

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
        const fallback = new URL('/auth?error=config', requestUrl.origin);
        return NextResponse.redirect(fallback);
    }

    if (!code) {
        const fallback = new URL('/auth?error=missing_code', requestUrl.origin);
        return NextResponse.redirect(fallback);
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        const fallback = new URL('/auth?error=oauth_failed', requestUrl.origin);
        return NextResponse.redirect(fallback);
    }

    return NextResponse.redirect(new URL(redirectTarget, requestUrl.origin));
}
