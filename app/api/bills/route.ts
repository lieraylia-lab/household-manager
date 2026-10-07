import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readJsonObject } from "../../../lib/request";
import { getAuthenticatedSupabase } from "../../../lib/supabase/authenticated";

const BILL_COLUMNS =
  "id, name, amount, due_date, category, paid, file_name, file_path";
const UUID_SEGMENT =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_PATTERN =
  new RegExp(`^${UUID_SEGMENT}$`, "i");
const IMAGE_PATH_PATTERN = new RegExp(
  `^${UUID_SEGMENT}/${UUID_SEGMENT}\\.(?:jpg|png)$`,
  "i"
);
const FILE_PATH_PATTERN = new RegExp(
  `^${UUID_SEGMENT}/${UUID_SEGMENT}\\.(?:pdf|jpg|png)$`,
  "i"
);

export async function GET() {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from("bills")
    .select(BILL_COLUMNS)
    .eq("user_id", auth.userId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Unable to load bills:", error);
    return NextResponse.json({ error: "Unable to load bills." }, { status: 500 });
  }

  const bills = await Promise.all(
    data.map(async (bill) => ({
      id: bill.id,
      name: bill.name,
      amount: Number(bill.amount),
      dueDate: bill.due_date,
      category: bill.category,
      paid: bill.paid,
      fileName: bill.file_name ?? undefined,
      imageUrl: await createImageUrl(auth.supabase, bill.file_path),
    }))
  );

  return NextResponse.json(bills);
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "A JSON bill is required." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const dueDate = typeof body.dueDate === "string" ? body.dueDate : "";
  const amount = body.amount;
  const fileName = typeof body.fileName === "string" ? body.fileName : null;
  const filePath =
    typeof body.filePath === "string" ? body.filePath : null;
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    ? new Date(`${dueDate}T00:00:00.000Z`)
    : null;

  if (
    !name ||
    name.length > 200 ||
    !category ||
    category.length > 100 ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    (body.filePath !== undefined &&
      body.filePath !== null &&
      typeof body.filePath !== "string") ||
    (filePath !== null &&
      (!FILE_PATH_PATTERN.test(filePath) ||
        !filePath.startsWith(`${auth.userId}/`))) ||
    !parsedDate ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== dueDate
  ) {
    return NextResponse.json({ error: "Bill details are invalid." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("bills")
    .insert({
      user_id: auth.userId,
      name,
      amount,
      due_date: dueDate,
      category,
      file_name: fileName,
      file_path: filePath,
    })
    .select(BILL_COLUMNS)
    .single();

  if (error) {
    console.error("Unable to create bill:", error);
    if (filePath) {
      const { error: cleanupError } = await auth.supabase.storage
        .from("bill-photos")
        .remove([filePath]);
      if (cleanupError) {
        console.error("Unable to clean up unattached bill file:", cleanupError);
      }
    }
    return NextResponse.json({ error: "Unable to save bill." }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: data.id,
      name: data.name,
      amount: Number(data.amount),
      dueDate: data.due_date,
      category: data.category,
      paid: data.paid,
      fileName: data.file_name ?? undefined,
      imageUrl: await createImageUrl(auth.supabase, data.file_path),
    },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const body = await readJsonObject(request);
  if (
    !body ||
    typeof body.id !== "string" ||
    !UUID_PATTERN.test(body.id)
  ) {
    return NextResponse.json(
      { error: "A valid bill ID is required." },
      { status: 400 }
    );
  }

  let update: {
    paid?: boolean;
    file_name?: string;
    file_path?: string;
    name?: string;
    amount?: number;
    due_date?: string;
    category?: string;
  };
  if (typeof body.paid === "boolean") {
    update = { paid: body.paid };
  } else if (
    typeof body.name === "string" ||
    typeof body.amount === "number" ||
    typeof body.dueDate === "string" ||
    typeof body.category === "string"
  ) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const category =
      typeof body.category === "string" ? body.category.trim() : "";
    const dueDate = typeof body.dueDate === "string" ? body.dueDate : "";
    const amount = body.amount;
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
      ? new Date(`${dueDate}T00:00:00.000Z`)
      : null;

    if (
      !name ||
      name.length > 200 ||
      !category ||
      category.length > 100 ||
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !parsedDate ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== dueDate
    ) {
      return NextResponse.json(
        { error: "Bill details are invalid." },
        { status: 400 }
      );
    }

    update = { name, amount, due_date: dueDate, category };
    if (body.filePath !== undefined || body.fileName !== undefined) {
      const filePath =
        typeof body.filePath === "string" ? body.filePath : "";
      const fileName =
        typeof body.fileName === "string" ? body.fileName : "";

      if (
        !IMAGE_PATH_PATTERN.test(filePath) ||
        !filePath.startsWith(`${auth.userId}/`) ||
        !fileName
      ) {
        return NextResponse.json(
          { error: "A valid replacement photo path and name are required." },
          { status: 400 }
        );
      }

      update.file_path = filePath;
      update.file_name = fileName;
    }
  } else {
    const filePath =
      typeof body.filePath === "string" ? body.filePath : "";
    const fileName =
      typeof body.fileName === "string" ? body.fileName : "";

    if (
      !FILE_PATH_PATTERN.test(filePath) ||
      !filePath.startsWith(`${auth.userId}/`) ||
      !fileName
    ) {
      return NextResponse.json(
        { error: "A valid bill file path and name are required." },
        { status: 400 }
      );
    }

    update = { file_name: fileName, file_path: filePath };
  }

  const { data, error } = await auth.supabase
    .from("bills")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", auth.userId)
    .select(BILL_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("Unable to update bill:", error);
    return NextResponse.json({ error: "Unable to update bill." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    amount: Number(data.amount),
    dueDate: data.due_date,
    category: data.category,
    paid: data.paid,
    fileName: data.file_name ?? undefined,
    imageUrl: await createImageUrl(auth.supabase, data.file_path),
  });
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "A bill ID is required." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("bills")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to delete bill:", error);
    return NextResponse.json({ error: "Unable to delete bill." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  }

  return NextResponse.json({ id: data.id });
}

async function createImageUrl(
  supabase: SupabaseClient,
  filePath: string | null
) {
  if (!filePath || !IMAGE_PATH_PATTERN.test(filePath)) return undefined;

  try {
    const { data, error } = await supabase.storage
      .from("bill-photos")
      .createSignedUrl(filePath, 60 * 60 * 24);

    if (error) {
      console.error("Unable to create bill photo URL:", error);
      return undefined;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Unable to create bill photo URL:", error);
    return undefined;
  }
}
