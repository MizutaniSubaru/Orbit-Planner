import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

function isAssetPath(pathname: string) {
    return (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/.test(pathname)
    );
}

function isSafeRedirectPath(path: string | null): path is string {
    return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

export async function middleware(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || isAssetPath(request.nextUrl.pathname)) {
        return NextResponse.next();
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => {
                    request.cookies.set(name, value);
                });

                response = NextResponse.next({ request });

                cookiesToSet.forEach(({ name, options, value }) => {
                    response.cookies.set(name, value, options);
                });
            },
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const isAuthRoute = pathname === '/auth' || pathname.startsWith('/auth/');
    const isApiRoute = pathname.startsWith('/api/');

    if (!user && !isAuthRoute && !isApiRoute) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/auth';
        redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
        return NextResponse.redirect(redirectUrl);
    }

    if (user && pathname === '/auth') {
        const requestedNext = request.nextUrl.searchParams.get('next');
        const redirectTarget = isSafeRedirectPath(requestedNext) ? requestedNext : '/';
        return NextResponse.redirect(new URL(redirectTarget, request.url));
    }

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
