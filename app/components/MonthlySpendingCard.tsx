"use client";

import { useState } from "react";

export type SpendingCategoryTotal = {
  category: string;
  amount: number;
};

type MonthlySpendingCardProps = {
  year: number;
  month: number;
  categories: SpendingCategoryTotal[];
  loading: boolean;
  error: string;
};

const categoryColors = [
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#38bdf8",
  "#c084fc",
  "#fb7185",
  "#2dd4bf",
  "#f97316",
];

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function MonthlySpendingCard({
  year,
  month,
  categories,
  loading,
  error,
}: MonthlySpendingCardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  const total = categories.reduce((sum, item) => sum + item.amount, 0);
  const circumference = 2 * Math.PI * 38;
  const activeCategory = hoveredCategory ?? selectedCategory;
  const activeItem =
    categories.find((item) => item.category === activeCategory) ?? null;

  const positiveCategories = categories.filter((item) => item.amount > 0);
  const slices = positiveCategories.map((item, index) => {
      const length = (item.amount / total) * circumference;
      const offset = positiveCategories
        .slice(0, index)
        .reduce(
          (currentOffset, previous) =>
            currentOffset + (previous.amount / total) * circumference,
          0
        );
      return {
        ...item,
        color: categoryColors[index % categoryColors.length],
        length,
        offset,
      };
    });

  return (
    <section
      aria-labelledby="monthly-spending-heading"
      className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-indigo-300/20 bg-gradient-to-br from-[#1a2946] via-[#151f35] to-[#111827] p-5 shadow-xl shadow-indigo-950/10 sm:p-6"
    >
      <div className="relative">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-300">
              How much have I spent?
            </p>
            <h2
              id="monthly-spending-heading"
              className="mt-1 text-xl font-semibold tracking-tight text-white"
            >
              Spending
            </h2>
          </div>
          <p className="text-sm text-slate-400">{monthLabel}</p>
        </div>

        {loading ? (
          <div
            role="status"
            aria-label="Loading monthly spending"
            className="mt-5 grid animate-pulse gap-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-center"
          >
            <div className="h-24 rounded-2xl bg-white/[0.04]" />
            <div className="h-36 rounded-2xl bg-white/[0.04]" />
          </div>
        ) : error ? (
          <p role="alert" className="mt-5 rounded-xl border border-rose-300/20 bg-rose-400/[0.07] p-4 text-sm text-rose-200">
            {error}
          </p>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-center">
            <div className="rounded-2xl border border-indigo-200/10 bg-slate-950/20 px-4 py-4">
              <p className="text-sm font-medium text-indigo-100/80">
                Spent this month
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {formatCurrency(total)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                From {categories.length}{" "}
                {categories.length === 1 ? "category" : "categories"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-slate-950/15 p-4">
              <h3 className="text-sm font-semibold text-slate-100">
                Spending by Category
              </h3>
              {categories.length === 0 || total <= 0 ? (
                <div className="mt-3 flex min-h-28 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
                  <p className="text-sm text-slate-400">
                    {categories.length === 0
                      ? "No expenses this month yet."
                      : "No spending amounts to chart this month."}
                  </p>
                </div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                  <div className="relative mx-auto h-36 w-36">
                    <svg
                      viewBox="0 0 100 100"
                      role="img"
                      aria-label={`Donut chart of this month's spending across ${categories.length} categories`}
                      className="h-full w-full -rotate-90"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="rgb(255 255 255 / 8%)"
                        strokeWidth="12"
                      />
                      {slices.map((slice) => (
                        <circle
                          key={slice.category}
                          cx="50"
                          cy="50"
                          r="38"
                          fill="none"
                          stroke={slice.color}
                          strokeWidth={
                            activeCategory === slice.category ? 15 : 12
                          }
                          strokeDasharray={`${slice.length} ${circumference - slice.length}`}
                          strokeDashoffset={-slice.offset}
                          className="cursor-pointer transition-[stroke-width,opacity] duration-150"
                          opacity={
                            activeCategory && activeCategory !== slice.category
                              ? 0.55
                              : 1
                          }
                          onMouseEnter={() =>
                            setHoveredCategory(slice.category)
                          }
                          onMouseLeave={() => setHoveredCategory(null)}
                          onClick={() =>
                            setSelectedCategory((current) =>
                              current === slice.category ? null : slice.category
                            )
                          }
                        />
                      ))}
                    </svg>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                      {activeItem ? (
                        <>
                          <span className="max-w-full truncate text-xs font-medium text-slate-300">
                            {activeItem.category}
                          </span>
                          <span className="mt-0.5 text-sm font-bold tabular-nums text-white">
                            {formatCurrency(activeItem.amount)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {((activeItem.amount / total) * 100).toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Total
                          </span>
                          <span className="mt-0.5 text-xs font-bold tabular-nums text-white">
                            {formatCurrency(total)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <ul className="grid gap-1.5">
                    {categories.map((item, index) => {
                      const color = categoryColors[index % categoryColors.length];
                      return (
                      <li key={item.category}>
                        <button
                          type="button"
                          aria-pressed={selectedCategory === item.category}
                          onMouseEnter={() =>
                            setHoveredCategory(item.category)
                          }
                          onMouseLeave={() => setHoveredCategory(null)}
                          onFocus={() => setHoveredCategory(item.category)}
                          onBlur={() => setHoveredCategory(null)}
                          onClick={() =>
                            setSelectedCategory((current) =>
                              current === item.category ? null : item.category
                            )
                          }
                          className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-2 py-1 text-left transition ${
                            activeCategory === item.category
                              ? "bg-white/[0.07]"
                              : "hover:bg-white/[0.04]"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="break-words text-xs font-medium text-slate-200">
                              {item.category}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-xs tabular-nums text-slate-300">
                            {formatCurrency(item.amount)}
                            <span className="ml-1 text-slate-500">
                              {((item.amount / total) * 100).toFixed(0)}%
                            </span>
                          </span>
                        </button>
                      </li>
                    )})}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
