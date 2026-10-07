import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./lib/supabase/config";

export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  if (error && error.name !== "AuthSessionMissingError") {
    throw new Error(`Unable to verify Supabase session: ${error.message}`);
  }

  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/login";
  const isAuthCallback = pathname.startsWith("/auth/");
  const isApi = pathname.startsWith("/api/");

  const hasClaims = Boolean(data?.claims);
  if (!hasClaims && !isLogin && !isAuthCallback && !isApi) {
    return redirectWithCookies(request, "/login", response);
  }

  if (hasClaims && isLogin) {
    return redirectWithCookies(request, "/", response);
  }

  return response;
}

function redirectWithCookies(
  request: NextRequest,
  pathname: string,
  response: NextResponse
) {
  const redirect = NextResponse.redirect(new URL(pathname, request.url));

  response.cookies.getAll().forEach(({ name, value, ...options }) => {
    redirect.cookies.set(name, value, options);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }

  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
