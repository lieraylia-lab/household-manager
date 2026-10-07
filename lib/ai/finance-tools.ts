import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateMonthlyBudget } from "../monthly-budget-calculation";

const BILL_PERIODS = [
  "today",
  "yesterday",
  "this_week",
  "this_month",
  "last_month",
  "specific_date",
  "all_time",
] as const;

export type GetBillsArguments = {
  period: (typeof BILL_PERIODS)[number];
  status: "all" | "paid" | "unpaid";
  date: string;
};

export type GetBudgetArguments = {
  month: "current" | "previous";
};

type BillRow = {
  name: string;
  amount: number | string;
  due_date: string;
  category: string;
  paid: boolean;
};

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isGetBillsArguments(value: unknown): value is GetBillsArguments {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const args = value as Record<string, unknown>;
  return (
    typeof args.period === "string" &&
    BILL_PERIODS.includes(args.period as GetBillsArguments["period"]) &&
    (args.status === "all" || args.status === "paid" || args.status === "unpaid") &&
    typeof args.date === "string" &&
    (args.period !== "specific_date" || isDate(args.date))
  );
}

export function isGetBudgetArguments(value: unknown): value is GetBudgetArguments {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const month = (value as Record<string, unknown>).month;
  return month === "current" || month === "previous";
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

function getDateRange(
  period: GetBillsArguments["period"],
  today: string,
  timezoneOffsetMinutes: number,
  specificDate: string
) {
  if (period === "all_time") return null;

  const [year, month, day] = today.split("-").map(Number);
  const todayDate = new Date(Date.UTC(year, month - 1, day));
  if (period === "specific_date") {
    const [dateYear, dateMonth, dateDay] = specificDate.split("-").map(Number);
    return {
      start: localDateBoundary(
        dateYear,
        dateMonth - 1,
        dateDay,
        timezoneOffsetMinutes
      ),
      end: localDateBoundary(
        dateYear,
        dateMonth - 1,
        dateDay + 1,
        timezoneOffsetMinutes
      ),
      label: specificDate,
    };
  }

  if (period === "today" || period === "yesterday") {
    const offset = period === "today" ? 0 : -1;
    const date = new Date(todayDate.getTime() + offset * 86_400_000);
    return {
      start: localDateBoundary(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        timezoneOffsetMinutes
      ),
      end: localDateBoundary(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
        timezoneOffsetMinutes
      ),
      label: period,
    };
  }

  if (period === "this_week") {
    const dayOfWeek = todayDate.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(todayDate.getTime() + mondayOffset * 86_400_000);
    const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);
    return {
      start: localDateBoundary(
        monday.getUTCFullYear(),
        monday.getUTCMonth(),
        monday.getUTCDate(),
        timezoneOffsetMinutes
      ),
      end: localDateBoundary(
        nextMonday.getUTCFullYear(),
        nextMonday.getUTCMonth(),
        nextMonday.getUTCDate(),
        timezoneOffsetMinutes
      ),
      label: "this week",
    };
  }

  if (period === "this_month") {
    return {
      start: localDateBoundary(year, month - 1, 1, timezoneOffsetMinutes),
      end: localDateBoundary(year, month, 1, timezoneOffsetMinutes),
      label: "this month",
    };
  }

  return {
    start: localDateBoundary(year, month - 2, 1, timezoneOffsetMinutes),
    end: localDateBoundary(year, month - 1, 1, timezoneOffsetMinutes),
    label: "last month",
  };
}

export async function getBills(
  supabase: SupabaseClient,
  userId: string,
  args: GetBillsArguments,
  today: string,
  timezoneOffsetMinutes: number
) {
  if (
    !isDate(today) ||
    (args.period === "specific_date" && !isDate(args.date))
  ) {
    throw new Error("Invalid date supplied for bill lookup.");
  }

  const range = getDateRange(
    args.period,
    today,
    timezoneOffsetMinutes,
    args.date
  );
  const bills: Array<{
    name: string;
    amount: number;
    dueDate: string;
    category: string;
    paid: boolean;
  }> = [];
  const pageSize = 1000;
  let complete = false;

  for (let page = 0; page < 100; page += 1) {
    let query = supabase
      .from("bills")
      .select("name, amount, due_date, category, paid")
      .eq("user_id", userId)
      .order("due_date", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (range) {
      query = query.gte("due_date", range.start.slice(0, 10)).lt(
        "due_date",
        range.end.slice(0, 10)
      );
    }
    if (args.status === "paid") query = query.eq("paid", true);
    if (args.status === "unpaid") query = query.eq("paid", false);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as BillRow[];
    for (const bill of rows) {
      const amount = Number(bill.amount);
      if (!Number.isFinite(amount) || !isDate(bill.due_date)) continue;
      bills.push({
        name: bill.name,
        amount,
        dueDate: bill.due_date,
        category: bill.category,
        paid: bill.paid,
      });
    }
    if (rows.length < pageSize) {
      complete = true;
      break;
    }
  }

  const paidBills = bills.filter((bill) => bill.paid);
  const unpaidBills = bills.filter((bill) => !bill.paid);
  const periodStartDate = range
    ? new Date(
        new Date(range.start).getTime() -
          timezoneOffsetMinutes * 60_000
      )
        .toISOString()
        .slice(0, 10)
    : null;
  return {
    period: range?.label ?? "all time",
    periodStartDate,
    periodEndDateExclusive: range
      ? new Date(
          new Date(range.end).getTime() -
            timezoneOffsetMinutes * 60_000
        )
          .toISOString()
          .slice(0, 10)
      : null,
    dueDateRange: range !== null,
    dateField: "due_date",
    paidDateAvailable: false,
    status: args.status,
    complete,
    count: bills.length,
    total: bills.reduce((sum, bill) => sum + bill.amount, 0),
    paidCount: paidBills.length,
    paidTotal: paidBills.reduce((sum, bill) => sum + bill.amount, 0),
    unpaidCount: unpaidBills.length,
    unpaidTotal: unpaidBills.reduce((sum, bill) => sum + bill.amount, 0),
    bills: bills.slice(0, 20),
  };
}

export async function getBudget(
  supabase: SupabaseClient,
  userId: string,
  month: GetBudgetArguments["month"],
  today: string,
  timezoneOffsetMinutes: number
) {
  if (!isDate(today)) throw new Error("Invalid date supplied for budget lookup.");

  const [year, monthNumber] = today.split("-").map(Number);
  const periodDate = new Date(
    Date.UTC(year, monthNumber - 1 + (month === "previous" ? -1 : 0), 1)
  );
  const periodYear = periodDate.getUTCFullYear();
  const periodMonth = periodDate.getUTCMonth() + 1;
  const start = localDateBoundary(
    periodYear,
    periodMonth - 1,
    1,
    timezoneOffsetMinutes
  );
  const end = localDateBoundary(
    periodYear,
    periodMonth,
    1,
    timezoneOffsetMinutes
  );

  const snapshot = await calculateMonthlyBudget({
    supabase,
    userId,
    year: periodYear,
    month: periodMonth,
    expenseStart: start,
    expenseEnd: end,
  });
  return {
    period: month === "current" ? "this month" : "last month",
    ...snapshot,
    complete: true,
  };
}
