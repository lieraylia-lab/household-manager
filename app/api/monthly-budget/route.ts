import { NextResponse } from "next/server";
import { readJsonObject } from "../../../lib/request";
import { getAuthenticatedSupabase } from "../../../lib/supabase/authenticated";
import { calculateMonthlyBudget } from "../../../lib/monthly-budget-calculation";

const MAX_BUDGET_AMOUNT = 9_999_999_999.99;

function parsePeriod(yearValue: string | null, monthValue: string | null) {
  if (!yearValue || !monthValue || !/^\d{4}$/.test(yearValue) || !/^\d{1,2}$/.test(monthValue)) {
    return null;
  }

  const year = Number(yearValue);
  const month = Number(monthValue);
  if (year < 2000 || year > 9999 || month < 1 || month > 12) return null;
  return { year, month };
}

function parseMonthBounds(
  year: number,
  month: number,
  startValue: string | null,
  endValue: string | null
) {
  if (!startValue || !endValue) return null;
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start >= end
  ) {
    return null;
  }

  const monthStart = Date.UTC(year, month - 1, 1);
  const nextMonthStart = Date.UTC(year, month, 1);
  const allowance = 24 * 60 * 60 * 1000;
  if (
    start.getTime() < monthStart - allowance ||
    start.getTime() > monthStart + allowance ||
    end.getTime() < nextMonthStart - allowance ||
    end.getTime() > nextMonthStart + allowance
  ) {
    return null;
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const period = parsePeriod(params.get("year"), params.get("month"));
  if (!period) {
    return NextResponse.json({ error: "A valid budget month is required." }, { status: 400 });
  }

  const bounds = parseMonthBounds(
    period.year,
    period.month,
    params.get("start"),
    params.get("end")
  );
  if (!bounds) {
    return NextResponse.json({ error: "Valid month boundaries are required." }, { status: 400 });
  }

  try {
    const snapshot = await calculateMonthlyBudget({
      supabase: auth.supabase,
      userId: auth.userId,
      year: period.year,
      month: period.month,
      expenseStart: bounds.start,
      expenseEnd: bounds.end,
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Unable to calculate monthly budget:", error);
    return NextResponse.json(
      { error: "Unable to load monthly budget." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "A budget is required." }, { status: 400 });
  }

  const year = body.year;
  const month = body.month;
  const amount = body.amount;
  if (
    typeof year !== "number" ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 9999 ||
    typeof month !== "number" ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > MAX_BUDGET_AMOUNT
  ) {
    return NextResponse.json({ error: "Budget details are invalid." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("monthly_budgets")
    .upsert(
      {
        user_id: auth.userId,
        year,
        month,
        amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,year,month" }
    )
    .select("amount")
    .single();

  if (error) {
    console.error("Unable to save monthly budget:", error);
    return NextResponse.json({ error: "Unable to save monthly budget." }, { status: 500 });
  }

  return NextResponse.json({ year, month, budget: Number(data.amount) });
}
