import type { SupabaseClient } from "@supabase/supabase-js";

const EXPENSE_CATEGORIES = [
  "Groceries",
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Other",
] as const;

const PERIODS = [
  "today",
  "yesterday",
  "this_week",
  "this_month",
  "last_month",
  "specific_date",
  "all_time",
] as const;

type ExpensePeriod = (typeof PERIODS)[number];
type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type GetExpensesArguments = {
  period: ExpensePeriod;
  category: ExpenseCategory | "all";
  sort_by: "largest" | "recent";
  date: string;
};

type ExpenseRow = {
  name: string;
  amount: number | string;
  category: string;
  created_at: string;
};

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isGetExpensesArguments(
  value: unknown
): value is GetExpensesArguments {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const args = value as Record<string, unknown>;
  return (
    typeof args.period === "string" &&
    PERIODS.includes(args.period as ExpensePeriod) &&
    (args.category === "all" ||
      (typeof args.category === "string" &&
        EXPENSE_CATEGORIES.includes(args.category as ExpenseCategory))) &&
    (args.sort_by === "largest" || args.sort_by === "recent") &&
    typeof args.date === "string" &&
    (args.period !== "specific_date" || isDate(args.date))
  );
}

function localDateBoundary(
  year: number,
  month: number,
  day: number,
  timezoneOffsetMinutes: number
) {
  return new Date(
    Date.UTC(year, month, day) + timezoneOffsetMinutes * 60_000
  ).toISOString();
}

function getPeriodRange(
  period: ExpensePeriod,
  today: string,
  timezoneOffsetMinutes: number,
  specificDate: string
) {
  if (period === "all_time") return null;

  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  let start: string;
  let end: string;
  let label: string;

  if (period === "specific_date") {
    const [specificYear, specificMonth, specificDay] = specificDate
      .split("-")
      .map(Number);
    start = localDateBoundary(
      specificYear,
      specificMonth - 1,
      specificDay,
      timezoneOffsetMinutes
    );
    end = localDateBoundary(
      specificYear,
      specificMonth - 1,
      specificDay + 1,
      timezoneOffsetMinutes
    );
    label = specificDate;
  } else if (period === "today" || period === "yesterday") {
    const dayDelta = period === "today" ? 0 : -1;
    const periodDate = new Date(date.getTime() + dayDelta * 86_400_000);
    const startYear = periodDate.getUTCFullYear();
    const startMonth = periodDate.getUTCMonth();
    const startDay = periodDate.getUTCDate();
    start = localDateBoundary(
      startYear,
      startMonth,
      startDay,
      timezoneOffsetMinutes
    );
    end = localDateBoundary(
      startYear,
      startMonth,
      startDay + 1,
      timezoneOffsetMinutes
    );
    label = period === "today" ? "today" : "yesterday";
  } else if (period === "this_week") {
    const dayOfWeek = date.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(date.getTime() + mondayOffset * 86_400_000);
    const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);
    start = localDateBoundary(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
      timezoneOffsetMinutes
    );
    end = localDateBoundary(
      nextMonday.getUTCFullYear(),
      nextMonday.getUTCMonth(),
      nextMonday.getUTCDate(),
      timezoneOffsetMinutes
    );
    label = "this week";
  } else if (period === "this_month") {
    start = localDateBoundary(year, month - 1, 1, timezoneOffsetMinutes);
    end = localDateBoundary(year, month, 1, timezoneOffsetMinutes);
    label = "this month";
  } else {
    start = localDateBoundary(year, month - 2, 1, timezoneOffsetMinutes);
    end = localDateBoundary(year, month - 1, 1, timezoneOffsetMinutes);
    label = "last month";
  }

  return { start, end, label };
}

function getLocalDate(timestamp: string, timezoneOffsetMinutes: number) {
  const timestampValue = new Date(timestamp).getTime();
  if (!Number.isFinite(timestampValue)) return null;
  return new Date(timestampValue - timezoneOffsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

export async function getExpenses(
  supabase: SupabaseClient,
  userId: string,
  args: GetExpensesArguments,
  today: string,
  timezoneOffsetMinutes: number
) {
  if (!isDate(today)) {
    throw new Error("Invalid local date supplied for expense lookup.");
  }

  if (args.period === "specific_date" && !isDate(args.date)) {
    throw new Error("Invalid specific date supplied for expense lookup.");
  }
  const range = getPeriodRange(
    args.period,
    today,
    timezoneOffsetMinutes,
    args.date
  );
  const records: Array<{
    name: string;
    amount: number;
    category: string;
    date: string;
  }> = [];
  const pageSize = 1000;
  const maximumPages = 100;
  let complete = false;

  for (let page = 0; page < maximumPages; page += 1) {
    let query = supabase
      .from("expenses")
      .select("name, amount, category, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (range) {
      query = query.gte("created_at", range.start).lt("created_at", range.end);
    }
    if (args.category !== "all") {
      query = query.eq("category", args.category);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as ExpenseRow[];
    for (const row of rows) {
      const amount = Number(row.amount);
      const localDate = getLocalDate(row.created_at, timezoneOffsetMinutes);
      if (!Number.isFinite(amount) || localDate === null) continue;
      records.push({
        name: row.name,
        amount,
        category: row.category,
        date: localDate,
      });
    }

    if (rows.length < pageSize) {
      complete = true;
      break;
    }
  }

  const totalSpent = records.reduce((sum, expense) => sum + expense.amount, 0);
  const categoryTotals = Array.from(
    records.reduce((totals, expense) => {
      totals.set(
        expense.category,
        (totals.get(expense.category) ?? 0) + expense.amount
      );
      return totals;
    }, new Map<string, number>())
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((first, second) => second.amount - first.amount);
  const topExpenses = [...records]
    .sort((first, second) =>
      args.sort_by === "largest"
        ? second.amount - first.amount
        : second.date.localeCompare(first.date)
    )
    .slice(0, 10);
  const presentableExpenses = topExpenses.map((expense) => ({
    ...expense,
    name: isSpecificDescription(expense.name, expense.category)
      ? expense.name
      : null,
  }));
  const largestExpense = [...records].sort(
    (first, second) => second.amount - first.amount
  )[0];
  const periodStartDate = range
    ? getLocalDate(range.start, timezoneOffsetMinutes)
    : null;

  return {
    period: range?.label ?? "all time",
    periodStartDate,
    periodEndDateExclusive: range
      ? getLocalDate(range.end, timezoneOffsetMinutes)
      : null,
    requestedCategory: args.category === "all" ? null : args.category,
    complete,
    expenseCount: records.length,
    totalSpent,
    categoryTotals,
    largestExpense: largestExpense
      ? {
          ...largestExpense,
          name: isSpecificDescription(
            largestExpense.name,
            largestExpense.category
          )
            ? largestExpense.name
            : null,
        }
      : null,
    expenses: presentableExpenses,
  };
}

function isSpecificDescription(name: string, category: string) {
  const normalizedName = name.trim().toLowerCase();
  return (
    normalizedName.length > 0 &&
    !["expense", "purchase", "spending", "unknown", "other"].includes(
      normalizedName
    ) &&
    normalizedName !== category.trim().toLowerCase()
  );
}
