import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { getSupabaseConfig } from "../../../lib/supabase/config";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!getSupabaseConfig() || !code) {
    return redirectWithoutCaching(request, "/login?error=confirmation");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectWithoutCaching(request, "/login?error=confirmation");
  }

  const next = requestUrl.searchParams.get("next");
  return redirectWithoutCaching(
    request,
    next === "/reset-password" ? next : "/"
  );
}

function redirectWithoutCaching(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0"
  );
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
