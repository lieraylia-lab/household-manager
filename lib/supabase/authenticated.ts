import { NextResponse } from "next/server";
import { getSupabaseConfig } from "./config";
import { createClient } from "./server";

export async function getAuthenticatedSupabase() {
  if (!getSupabaseConfig()) {
    return {
      response: NextResponse.json(
        { error: "Supabase is not configured. Add the required environment variables." },
        { status: 503 }
      ),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error && error.name !== "AuthSessionMissingError") {
    console.error("Unable to verify Supabase user:", error);
    return {
      response: NextResponse.json(
        { error: "Unable to verify the current session." },
        { status: 503 }
      ),
    };
  }

  if (!data?.user) {
    return {
      response: NextResponse.json({ error: "Authentication required." }, {
        status: 401,
      }),
    };
  }

  return { supabase, userId: data.user.id };
}
