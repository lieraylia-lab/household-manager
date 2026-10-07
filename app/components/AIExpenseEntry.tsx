"use client";

import { useState, type FormEvent } from "react";
import { readApiResponse } from "../../lib/api";

type ParsedExpense = {
  amount: number;
  category: string;
  description: string;
  date: string;
};

type ParsedExpenseResult = {
  expenses: ParsedExpense[];
};

const EXPENSE_CATEGORIES = [
  "Groceries",
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Other",
];

function isParsedExpense(value: unknown): value is ParsedExpense {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const expense = value as Record<string, unknown>;
  const date =
    typeof expense.date === "string" ? new Date(`${expense.date}T00:00:00.000Z`) : null;
  return (
    typeof expense.amount === "number" &&
    Number.isFinite(expense.amount) &&
    expense.amount > 0 &&
    typeof expense.category === "string" &&
    EXPENSE_CATEGORIES.includes(expense.category) &&
    typeof expense.description === "string" &&
    expense.description.trim().length > 0 &&
    typeof expense.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(expense.date) &&
    date !== null &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === expense.date
  );
}

function isParsedExpenseResult(value: unknown): value is ParsedExpenseResult {
  if (typeof value !== "object" || value === null || !("expenses" in value)) {
    return false;
  }
  const expenses = value.expenses;
  return (
    Array.isArray(expenses) &&
    expenses.length <= 20 &&
    expenses.every(isParsedExpense)
  );
}

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function AIExpenseEntry() {
  const [input, setInput] = useState("");
  const [interpretation, setInterpretation] = useState<ParsedExpenseResult | null>(
    null
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const reviewedExpenses = isParsedExpenseResult(interpretation)
    ? interpretation.expenses
    : null;
  const malformedInterpretation =
    interpretation !== null && reviewedExpenses === null;

  const interpretExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      setError("Describe an expense first.");
      setInterpretation(null);
      return;
    }

    setLoading(true);
    setError("");
    setInterpretation(null);
    try {
      const today = new Date();
      const response = await fetch("/api/ai/parse-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: trimmedInput,
          today: [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, "0"),
            String(today.getDate()).padStart(2, "0"),
          ].join("-"),
        }),
      });
      const result = await readApiResponse<ParsedExpenseResult>(
        response
      );
      if (!isParsedExpenseResult(result)) {
        throw new Error(
          "The AI returned an invalid interpretation. Please try again."
        );
      }
      setInterpretation(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to interpret this expense. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="ai-expense-entry-heading"
      className="relative mt-8 overflow-hidden rounded-[1.6rem] border border-indigo-300/20 bg-gradient-to-br from-[#1b2b49] via-[#151f35] to-[#111827] p-5 shadow-lg shadow-indigo-950/10 sm:p-6"
    >
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-300">
          Try AI expense entry
        </p>
        <h2
          id="ai-expense-entry-heading"
          className="mt-1 text-lg font-semibold tracking-tight text-white"
        >
          Describe a purchase in your own words
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          AI will suggest the details for you to review. Nothing is saved.
        </p>

        <form onSubmit={interpretExpense} className="mt-4">
          <label htmlFor="ai-expense-description" className="sr-only">
            Describe your expense
          </label>
          <textarea
            id="ai-expense-description"
            maxLength={500}
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="For example: Spent ₹850 at Domino's"
            className="dashboard-dark-field w-full resize-y rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-300/60 focus:outline-none focus:ring-4 focus:ring-indigo-300/10"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={loading}
              className="min-h-11 rounded-xl border border-indigo-200/20 bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-950/20 transition hover:from-indigo-400 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Interpreting..." : "Interpret expense"}
            </button>
            <span className="text-xs text-slate-500">
              Uses existing categories: Groceries, Food, Transport, Shopping,
              Entertainment, Other
            </span>
          </div>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </p>
        )}

        {malformedInterpretation && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
          >
            The AI returned an invalid interpretation. Please try again.
          </p>
        )}

        {reviewedExpenses && (
          <div
            aria-live="polite"
            className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.05] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-emerald-100">
                  {reviewedExpenses.length}{" "}
                  {reviewedExpenses.length === 1
                    ? "expense"
                    : "expenses"}{" "}
                  detected
                </h3>
                {reviewedExpenses.length > 0 && (
                  <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                    Total:{" "}
                    {formatCurrency(
                      reviewedExpenses.reduce(
                        (total, expense) => total + expense.amount,
                        0
                      )
                    )}
                  </p>
                )}
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-2.5 py-1 text-xs font-semibold text-emerald-200">
                Review only · Not saved
              </span>
            </div>
            {reviewedExpenses.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-white/10 bg-slate-950/20 px-4 py-3 text-sm text-slate-300">
                No expenses with a clear amount were identified. Add an amount
                and try again.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {reviewedExpenses.map((expense, index) => (
                  <li
                    key={`${expense.date}-${expense.category}-${expense.description}-${index}`}
                    className="rounded-xl border border-white/[0.08] bg-slate-950/25 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-lg font-semibold tabular-nums text-white">
                        {formatCurrency(expense.amount)}
                      </p>
                      <span className="shrink-0 rounded-full border border-indigo-200/15 bg-indigo-300/[0.07] px-2.5 py-1 text-xs font-medium text-indigo-100">
                        {expense.category}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-sm font-medium text-slate-100">
                      {expense.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Intl.DateTimeFormat("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(`${expense.date}T00:00:00.000Z`))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
