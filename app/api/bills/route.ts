import { NextResponse } from "next/server";
import { readJsonObject } from "../../../lib/request";
import { getAuthenticatedSupabase } from "../../../lib/supabase/authenticated";

const BILL_COLUMNS = "id, name, amount, due_date, category, paid, file_name";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  return NextResponse.json(
    data.map((bill) => ({
      id: bill.id,
      name: bill.name,
      amount: Number(bill.amount),
      dueDate: bill.due_date,
      category: bill.category,
      paid: bill.paid,
      fileName: bill.file_name ?? undefined,
    }))
  );
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
    })
    .select(BILL_COLUMNS)
    .single();

  if (error) {
    console.error("Unable to create bill:", error);
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
    !UUID_PATTERN.test(body.id) ||
    typeof body.paid !== "boolean"
  ) {
    return NextResponse.json(
      { error: "A bill ID and payment status are required." },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("bills")
    .update({ paid: body.paid })
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
