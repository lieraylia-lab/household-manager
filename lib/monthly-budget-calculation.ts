import type { SupabaseClient } from "@supabase/supabase-js";

type MonthlyBudgetCalculationInput = {
  supabase: SupabaseClient;
  userId: string;
  year: number;
  month: number;
  expenseStart: string;
  expenseEnd: string;
};

async function sumExpenses(
  supabase: SupabaseClient,
  userId: string,
  start: string,
  end: string
) {
  let total = 0;
  const pageSize = 1000;

  for (let page = 0; page < 100; page += 1) {
    const { data, error } = await supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", userId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;

    const rows = data ?? [];
    for (const expense of rows) total += Number(expense.amount);
    if (rows.length < pageSize) return total;
  }

  throw new Error("Monthly expenses exceeded the supported calculation limit.");
}

async function sumBills(
  supabase: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
  paid: boolean
) {
  let total = 0;
  let count = 0;
  const pageSize = 1000;

  for (let page = 0; page < 100; page += 1) {
    const { data, error } = await supabase
      .from("bills")
      .select("amount")
      .eq("user_id", userId)
      .eq("paid", paid)
      .gte("due_date", startDate)
      .lt("due_date", endDate)
      .order("due_date", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;

    const rows = data ?? [];
    for (const bill of rows) {
      total += Number(bill.amount);
      count += 1;
    }
    if (rows.length < pageSize) return { total, count };
  }

  throw new Error("Monthly bills exceeded the supported calculation limit.");
}

export async function calculateMonthlyBudget({
  supabase,
  userId,
  year,
  month,
  expenseStart,
  expenseEnd,
}: MonthlyBudgetCalculationInput) {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const nextMonthStart = `${nextMonthDate.getUTCFullYear()}-${String(
    nextMonthDate.getUTCMonth() + 1
  ).padStart(2, "0")}-01`;

  const { data: budgetRecord, error: budgetError } = await supabase
    .from("monthly_budgets")
    .select("amount")
    .eq("user_id", userId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (budgetError) throw budgetError;

  const [spent, paidBills, unpaidBills] = await Promise.all([
    sumExpenses(supabase, userId, expenseStart, expenseEnd),
    sumBills(supabase, userId, monthStart, nextMonthStart, true),
    sumBills(supabase, userId, monthStart, nextMonthStart, false),
  ]);
  const budget = budgetRecord ? Number(budgetRecord.amount) : null;
  const consumed = spent + paidBills.total;
  const remaining = budget === null ? null : budget - consumed;

  if (
    !Number.isFinite(spent) ||
    !Number.isFinite(paidBills.total) ||
    !Number.isFinite(unpaidBills.total) ||
    !Number.isFinite(consumed) ||
    (remaining !== null && !Number.isFinite(remaining))
  ) {
    throw new Error("Monthly budget calculation returned a non-finite amount.");
  }

  return {
    year,
    month,
    budget,
    spent,
    paidBills: paidBills.total,
    paidBillCount: paidBills.count,
    unpaidBills: unpaidBills.total,
    unpaidBillCount: unpaidBills.count,
    consumed,
    remaining,
  };
}
