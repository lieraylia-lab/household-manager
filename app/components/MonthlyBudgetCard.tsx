"use client";

import { useState, type FormEvent } from "react";

type MonthlyBudgetCardProps = {
  year: number;
  month: number;
  budget: number | null;
  spent: number;
  paidBills: number;
  daysRemaining: number;
  loading: boolean;
  saving: boolean;
  error: string;
  onSave: (amount: number) => Promise<void>;
};

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function MonthlyBudgetCard({
  year,
  month,
  budget,
  spent,
  paidBills,
  daysRemaining,
  loading,
  saving,
  error,
  onSave,
}: MonthlyBudgetCardProps) {
  const [amount, setAmount] = useState(budget === null ? "" : String(budget));
  const [editing, setEditing] = useState(false);
  const [inputError, setInputError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setInputError("Enter a valid budget amount of zero or more.");
      return;
    }

    setInputError("");
    try {
      await onSave(parsedAmount);
      setEditing(false);
    } catch (error) {
      setInputError(
        error instanceof Error ? error.message : "Unable to save monthly budget."
      );
    }
  };

  const consumed = spent + paidBills;
  const remaining = budget === null ? null : budget - consumed;
  const remainingAmount = remaining ?? 0;
  const overBudget = remaining !== null && remaining < 0;
  const rawPercentUsed =
    budget !== null && budget > 0 ? (consumed / budget) * 100 : 0;
  const percentUsed = Number.isFinite(rawPercentUsed) ? rawPercentUsed : 100;
  const progressWidth =
    budget === 0 ? (consumed > 0 ? 100 : 0) : Math.min(100, Math.max(0, percentUsed));
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  const dailyAllowance =
    remaining !== null && remaining > 0 && daysRemaining > 0
      ? remaining / daysRemaining
      : 0;
  const progressTone =
    overBudget || (budget !== null && percentUsed >= 90)
      ? "from-rose-400 to-red-500"
      : percentUsed >= 70
        ? "from-amber-300 to-orange-400"
        : "from-emerald-300 to-teal-400";
  const progressText =
    overBudget || (budget !== null && percentUsed >= 90)
      ? "text-rose-200"
      : percentUsed >= 70
        ? "text-amber-200"
        : "text-emerald-200";

  return (
    <section
      aria-labelledby="monthly-budget-heading"
      className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-sky-300/20 bg-gradient-to-br from-[#172946] via-[#142238] to-[#101827] p-5 shadow-xl shadow-sky-950/15 sm:p-7"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl"
      />
      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-sky-300">
              <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-sky-200/15 bg-sky-300/[0.08] text-sm font-semibold">
                ₹
              </span>
              How much can I spend?
            </p>
            <h2
              id="monthly-budget-heading"
              className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl"
            >
              Monthly Budget
            </h2>
            <p className="mt-1 text-sm text-slate-400">{monthLabel}</p>
          </div>

          {budget !== null && !editing && (
            <button
              type="button"
              onClick={() => {
                setAmount(String(budget));
                setInputError("");
                setEditing(true);
              }}
              className="w-fit rounded-xl border border-sky-200/15 bg-sky-300/[0.07] px-3.5 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-200/30 hover:bg-sky-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
            >
              Edit budget
            </button>
          )}
        </div>

        {loading ? (
          <div role="status" aria-label="Loading monthly budget" className="mt-6 animate-pulse">
            <div className="h-10 w-48 rounded-lg bg-white/10" />
            <div className="mt-5 h-3 rounded-full bg-white/[0.07]" />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-16 rounded-xl bg-white/[0.05]" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {budget === null || editing ? (
              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] lg:items-end">
                <div className="rounded-2xl border border-white/[0.08] bg-slate-950/20 p-4 sm:p-5">
                  <p className="text-sm font-medium text-slate-200">
                    {budget === null ? "Set your monthly budget" : "Update this month's budget"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Give your monthly spending a target. Your expenses will be counted automatically.
                  </p>
                  {budget === null && (
                    <p className="mt-4 text-xs font-medium text-slate-400">
                      Spent so far this month{" "}
                      <span className="ml-1 text-base font-semibold tabular-nums text-white">
                        {formatCurrency(spent)}
                      </span>
                    </p>
                  )}
                </div>

                <form onSubmit={submit} className="space-y-3">
                  <label
                    htmlFor="monthly-budget-amount"
                    className="block text-xs font-semibold uppercase tracking-wider text-sky-100/80"
                  >
                    Budget amount
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                        ₹
                      </span>
                      <input
                        id="monthly-budget-amount"
                        type="number"
                        min="0"
                        max="9999999999.99"
                        step="0.01"
                        inputMode="decimal"
                        required
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="30,000"
                        className="dashboard-dark-field w-full rounded-xl border border-white/10 bg-slate-950/35 py-3.5 pl-9 pr-4 text-white placeholder:text-slate-500 focus:border-sky-300/50 focus:bg-slate-950/50 focus:outline-none focus:ring-4 focus:ring-sky-300/10"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="min-h-12 rounded-xl border border-sky-200/25 bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:-translate-y-0.5 hover:from-sky-400 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Saving..." : budget === null ? "Set Budget" : "Save Budget"}
                    </button>
                  </div>
                  {inputError && (
                    <p role="alert" className="text-sm text-rose-200">{inputError}</p>
                  )}
                  {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
                  {budget !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmount(String(budget));
                        setInputError("");
                        setEditing(false);
                      }}
                      className="text-sm font-medium text-slate-400 underline decoration-white/20 underline-offset-4 hover:text-white"
                    >
                      Cancel
                    </button>
                  )}
                </form>
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-sky-200/15 bg-sky-300/[0.06] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-sky-100/80">
                      Monthly budget
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {formatCurrency(budget)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-indigo-200/15 bg-indigo-300/[0.06] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-100/80">
                      Spent this month
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {formatCurrency(spent)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Paid bills: {formatCurrency(paidBills)}
                    </p>
                  </div>
                  <div className={`rounded-2xl border px-4 py-4 ${
                    overBudget
                      ? "border-rose-300/20 bg-rose-400/[0.07]"
                      : "border-emerald-300/15 bg-emerald-400/[0.06]"
                  }`}>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${
                      overBudget ? "text-rose-100/80" : "text-emerald-100/80"
                    }`}>
                      {overBudget ? "Over budget" : "Left to spend"}
                    </p>
                    <p className={`mt-2 text-2xl font-semibold tracking-tight sm:text-3xl ${
                      overBudget ? "text-rose-200" : "text-emerald-100"
                    }`}>
                      {formatCurrency(Math.abs(remainingAmount))}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className={`text-sm font-semibold ${progressText}`}>
                      {budget > 0
                        ? `${percentUsed.toFixed(1)}% used`
                        : consumed > 0
                          ? "Over budget (zero budget)"
                          : "0% used"}
                    </span>
                    {overBudget && (
                      <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-200">
                        Over budget by {formatCurrency(Math.abs(remainingAmount))}
                      </span>
                    )}
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full border border-white/[0.06] bg-slate-950/50 p-[2px]"
                    role="progressbar"
                    aria-label="Monthly budget used"
                    aria-valuemin={0}
                    aria-valuemax={budget || 1}
                    aria-valuenow={Math.min(consumed, budget || 1)}
                    aria-valuetext={
                      budget > 0
                        ? `${percentUsed.toFixed(1)} percent used`
                        : consumed > 0
                          ? `Consumed ${formatCurrency(consumed)} with a zero budget`
                          : "No spending against a zero budget"
                    }
                  >
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${progressTone} transition-[width] duration-700 ease-out`}
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-sky-200/10 bg-sky-300/[0.05] px-4 py-3">
                    <p className="text-xs font-medium text-slate-400">Available to spend per day</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-sky-100">
                      {dailyAllowance > 0 ? `${formatCurrency(dailyAllowance)}/day` : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                    <p className="text-xs font-medium text-slate-400">Days remaining</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                      {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
                    </p>
                  </div>
                </div>
                {error && <p role="alert" className="mt-4 text-sm text-rose-200">{error}</p>}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
