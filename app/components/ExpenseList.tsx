"use client";

import { useState } from "react";

export type Expense = {
  id: string;
  name: string;
  amount: number;
  category: string;
};

export type NewExpense = Omit<Expense, "id">;

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

  return (
    <div className="mt-8 rounded-xl bg-white p-6 shadow">
      <h2 className="text-xl font-semibold text-gray-900">
        Recent Expenses
      </h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          type="search"
          aria-label="Search expenses by name"
          placeholder="Search expenses..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-lg border border-gray-300 p-3 text-gray-900 placeholder:text-gray-500"
        />

        <select
          aria-label="Filter expenses by category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
        >
          <option>All</option>
          {Array.from(new Set(expenses.map((expense) => expense.category))).map(
            (category) => (
              <option key={category}>{category}</option>
            )
          )}
        </select>
      </div>

      {loading ? (
        <p role="status" className="mt-6 rounded-lg bg-gray-50 p-6 text-center text-gray-500">
          Loading expenses...
        </p>
      ) : loadError ? (
        <p role="alert" className="mt-6 rounded-lg bg-gray-50 p-6 text-center text-gray-500">
          Unable to load expenses right now.
        </p>
      ) : expenses.length === 0 ? (
        <p className="mt-6 rounded-lg bg-gray-50 p-6 text-center text-gray-500">
          No expenses yet. Add your first expense.
        </p>
      ) : filteredExpenses.length === 0 ? (
        <p className="mt-6 rounded-lg bg-gray-50 p-6 text-center text-gray-500">
          No expenses match your filters.
        </p>
      ) : (
        <>
          <section className="mt-6" aria-labelledby="expense-breakdown-heading">
            <h3
              id="expense-breakdown-heading"
              className="text-lg font-semibold text-gray-900"
            >
              Spending by Category
            </h3>
            <div className="mt-4 space-y-4">
              {categoryTotals.map(([category, amount]) => {
                const percentage =
                  largestCategoryTotal > 0
                    ? (amount / largestCategoryTotal) * 100
                    : 0;

                return (
                  <div key={category}>
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-gray-700">{category}</p>
                      <p className="font-semibold text-gray-900">
                        ₹{amount.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"
                      role="img"
                      aria-label={`${category}: ${Math.round(percentage)}% of the largest category`}
                    >
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mt-8 space-y-3">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">{expense.name}</p>
                  <p className="text-sm text-gray-500">{expense.category}</p>
                </div>

                <p className="font-semibold text-gray-900">
                  ₹{expense.amount.toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
