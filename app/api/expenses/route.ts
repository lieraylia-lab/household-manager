import { NextResponse } from "next/server";
import { readJsonObject } from "../../../lib/request";
import { getAuthenticatedSupabase } from "../../../lib/supabase/authenticated";

export async function GET() {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from("expenses")
    .select("id, name, amount, category")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load expenses:", error);
    return NextResponse.json(
      { error: "Unable to load expenses." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    data.map((expense) => ({
      id: expense.id,
      name: expense.name,
      amount: Number(expense.amount),
      category: expense.category,
    }))
  );
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json(
      { error: "A JSON expense is required." },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const amount = body.amount;

  if (
    !name ||
    name.length > 200 ||
    !category ||
    category.length > 100 ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return NextResponse.json(
      { error: "Expense details are invalid." },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("expenses")
    .insert({
      user_id: auth.userId,
      name,
      amount,
      category,
    })
    .select("id, name, amount, category")
    .single();

  if (error) {
    console.error("Unable to create expense:", error);
    return NextResponse.json(
      { error: "Unable to save expense." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      id: data.id,
      name: data.name,
      amount: Number(data.amount),
      category: data.category,
    },
    { status: 201 }
  );
}
