import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function isPublicRoute(pathname: string): boolean {
  return pathname.startsWith('/login') || pathname.startsWith('/auth');
}

function createRedirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

function createSupabaseClientWithCookies(
  request: NextRequest,
  getResponse: () => NextResponse,
  setResponse: (res: NextResponse) => void,
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          setResponse(NextResponse.next({ request }));
          cookiesToSet.forEach(({ name, value, options }) =>
            getResponse().cookies.set(name, value, options),
          );
        },
      },
    },
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createSupabaseClientWithCookies(
    request,
    () => supabaseResponse,
    (r) => (supabaseResponse = r),
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute(request.nextUrl.pathname)) {
    return createRedirectToLogin(request);
  }

  return supabaseResponse;
}
