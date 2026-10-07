import { NextResponse } from "next/server";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/authenticated";

function parseMonthBounds(
  yearValue: string | null,
  monthValue: string | null,
  startValue: string | null,
  endValue: string | null
) {
  if (
    !yearValue ||
    !monthValue ||
    !/^\d{4}$/.test(yearValue) ||
    !/^\d{1,2}$/.test(monthValue) ||
    !startValue ||
    !endValue
  ) {
    return null;
  }

  const year = Number(yearValue);
  const month = Number(monthValue);
  if (year < 2000 || year > 9999 || month < 1 || month > 12) return null;

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

  return { year, month, start: start.toISOString(), end: end.toISOString() };
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const period = parseMonthBounds(
    params.get("year"),
    params.get("month"),
    params.get("start"),
    params.get("end")
  );
  if (!period) {
    return NextResponse.json(
      { error: "Valid month boundaries are required." },
      { status: 400 }
    );
  }

  const categoryTotals = new Map<string, number>();
  let offset = 0;
  const pageSize = 1000;
  let hasMoreExpenses = true;

  while (hasMoreExpenses) {
    const {
      data: expenses,
      error,
      count,
    } = await auth.supabase
      .from("expenses")
      .select("id, amount, category", { count: "exact" })
      .eq("user_id", auth.userId)
      .gte("created_at", period.start)
      .lt("created_at", period.end)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("Unable to load monthly expense categories:", error);
      return NextResponse.json(
        { error: "Unable to load monthly spending by category." },
        { status: 500 }
      );
    }

    for (const expense of expenses ?? []) {
      const amount = Number(expense.amount);
      if (!Number.isFinite(amount)) {
        console.error("Monthly expense category contains an invalid amount.");
        return NextResponse.json(
          { error: "Unable to load monthly spending by category." },
          { status: 500 }
        );
      }
      const categoryTotal = (categoryTotals.get(expense.category) ?? 0) + amount;
      if (!Number.isFinite(categoryTotal)) {
        console.error("Monthly expense category total is not finite.");
        return NextResponse.json(
          { error: "Unable to load monthly spending by category." },
          { status: 500 }
        );
      }
      categoryTotals.set(expense.category, categoryTotal);
    }

    offset += expenses?.length ?? 0;
    hasMoreExpenses =
      count !== null
        ? offset < count
        : expenses !== null && expenses.length === pageSize;
  }

  const categories = Array.from(categoryTotals, ([category, amount]) => ({
    category,
    amount,
  })).sort((first, second) => second.amount - first.amount);

  return NextResponse.json({
    year: period.year,
    month: period.month,
    categories,
  });
}
