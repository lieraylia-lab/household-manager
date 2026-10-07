"use client";

import { useState } from "react";

export type Expense = {
  id: string;
  name: string;
  amount: number;
  category: string;
};

export type NewExpense = Omit<Expense, "id">;

const categoryAccents: Record<string, string> = {
  Groceries: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  Food: "border-orange-300/20 bg-orange-400/10 text-orange-200",
  Transport: "border-sky-300/20 bg-sky-400/10 text-sky-200",
  Shopping: "border-pink-300/20 bg-pink-400/10 text-pink-200",
  Entertainment: "border-violet-300/20 bg-violet-400/10 text-violet-200",
  Other: "border-slate-300/20 bg-slate-400/10 text-slate-200",
};

const categoryIcons: Record<string, string> = {
  Groceries: "🛒",
  Food: "🍽️",
  Transport: "🚗",
  Shopping: "🛍️",
  Entertainment: "🎬",
  Other: "✦",
};

export default function ExpenseList({
  expenses,
  loading,
  loadError,
}: {
  expenses: Expense[];
  loading: boolean;
  loadError: boolean;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const filteredExpenses = expenses.filter((expense) => {
    const matchesName = expense.name
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesCategory =
      categoryFilter === "All" || expense.category === categoryFilter;

    return matchesName && matchesCategory;
  });

  const categoryTotals = Array.from(
    filteredExpenses.reduce((totals, expense) => {
      totals.set(
        expense.category,
        (totals.get(expense.category) ?? 0) + expense.amount
      );
      return totals;
    }, new Map<string, number>())
  ).sort(([, firstAmount], [, secondAmount]) => secondAmount - firstAmount);
  const largestCategoryTotal = Math.max(
    0,
    ...categoryTotals.map(([, amount]) => amount)
  );
  const filteredTotal = filteredExpenses.reduce(
    (total, expense) => total + expense.amount,
    0
  );

  return (
    <section aria-labelledby="recent-expenses-heading" className="relative mt-8 overflow-hidden rounded-[1.75rem] border border-violet-300/25 bg-gradient-to-br from-[#292346] via-[#1b1d35] to-[#111827] p-5 shadow-xl shadow-violet-950/15 sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-violet-500/12 blur-3xl" />
      <div className="relative">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Expense activity</p>
          <h2 id="recent-expenses-heading" className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Recent Expenses
          </h2>
          <p className="mt-1 text-sm text-slate-400">Review your recorded household spending</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-white/10 bg-slate-950/25 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Showing</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{filteredExpenses.length} {filteredExpenses.length === 1 ? "expense" : "expenses"}</p>
          </div>
          <div className="rounded-xl border border-violet-300/20 bg-violet-400/10 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-200">Filtered total</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-white">₹{filteredTotal.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <input
          type="search"
          aria-label="Search expenses by name"
          placeholder="Search expenses..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="dashboard-dark-field w-full rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3.5 text-white placeholder:text-slate-500 focus:border-violet-300/50 focus:bg-slate-950/50 focus:outline-none focus:ring-4 focus:ring-violet-300/10"
        />

        <select
          aria-label="Filter expenses by category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="dashboard-dark-field w-full rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3.5 text-white focus:border-violet-300/50 focus:bg-slate-950/50 focus:outline-none focus:ring-4 focus:ring-violet-300/10"
        >
          <option>All</option>
          {Array.from(new Set(expenses.map((expense) => expense.category))).map(
            (category) => (
              <option key={category} className="text-slate-900">{category}</option>
            )
          )}
        </select>
      </div>

      {loading ? (
        <div role="status" aria-label="Loading expenses" className="mt-6 space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex animate-pulse items-center gap-3 rounded-2xl border border-white/[0.07] bg-slate-950/25 p-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-white/10" />
              <div className="flex-1">
                <div className="h-3 w-36 max-w-full rounded-full bg-white/10" />
                <div className="mt-2 h-2.5 w-20 rounded-full bg-white/[0.06]" />
              </div>
              <div className="h-4 w-20 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <p role="alert" className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-8 text-center text-sm text-rose-200">
          Unable to load expenses right now.
        </p>
      ) : expenses.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-violet-300/25 bg-slate-950/20 px-5 py-10 text-center">
          <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/10 text-2xl text-violet-200">＋</span>
          <p className="mt-4 font-semibold text-white">No expenses yet</p>
          <p className="mt-1 text-sm text-slate-400">Add your first expense to start building your activity list.</p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-8 text-center text-sm text-slate-300">
          No expenses match your filters.
        </p>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/25 p-4 sm:p-5" aria-labelledby="expense-breakdown-heading">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-300">Breakdown</p>
                <h3 id="expense-breakdown-heading" className="mt-1 text-base font-semibold text-white">
                  Spending by category
                </h3>
              </div>
              <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-200">
                {categoryTotals.length} {categoryTotals.length === 1 ? "category" : "categories"}
              </span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {categoryTotals.map(([category, amount]) => {
                const percentage =
                  largestCategoryTotal > 0
                    ? (amount / largestCategoryTotal) * 100
                    : 0;
                const accent = categoryAccents[category] ?? categoryAccents.Other;

                return (
                  <div key={category} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-semibold ${accent}`}>
                        <span aria-hidden="true">{categoryIcons[category] ?? categoryIcons.Other}</span>
                        {category}
                      </span>
                      <p className="font-semibold tabular-nums text-white">
                        ₹{amount.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700/80"
                      role="img"
                      aria-label={`${category}: ${Math.round(percentage)}% of the largest category`}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-300 transition-[width] duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mt-5 space-y-2.5">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-slate-950/25 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/20 hover:bg-white/[0.05] sm:px-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-base ${categoryAccents[expense.category] ?? categoryAccents.Other}`} aria-hidden="true">
                    {categoryIcons[expense.category] ?? categoryIcons.Other}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{expense.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{expense.category}</p>
                  </div>
                </div>

                <p className="shrink-0 text-base font-bold tabular-nums text-white">
                  ₹{expense.amount.toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
      </div>
    </section>
  );
}
