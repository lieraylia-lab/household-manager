import { NextResponse } from "next/server";
import { getAuthenticatedSupabase } from "../../../lib/supabase/authenticated";

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file uploaded" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: "File received successfully",
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  });
}
