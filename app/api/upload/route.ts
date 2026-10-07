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

  const contentTypes = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
  } as const;
  const extension = contentTypes[file.type as keyof typeof contentTypes];
  if (!extension || file.size === 0 || file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Upload a non-empty PDF, JPEG, or PNG file up to 10 MB." },
      { status: 400 }
    );
  }

  const filePath = `${auth.userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await auth.supabase.storage
    .from("bill-photos")
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Unable to upload bill file:", error);
    return NextResponse.json(
      { error: "Unable to upload bill file." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    filePath,
    fileName: file.name,
  });
}
