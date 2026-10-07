"use client";

import { useState } from "react";
import type { NewExpense } from "./ExpenseList";

export default function ExpenseForm({
  onAdd,
}: {
  onAdd: (expense: NewExpense) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const addExpense = async () => {
    const parsedAmount = Number(amount);
    if (!name.trim() || !amount || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setErrorMessage("Enter an expense name and a valid amount.");
      return;
    }

    const newExpense: NewExpense = {
      name: name.trim(),
      amount: parsedAmount,
      category,
    };

    setSaving(true);
    setErrorMessage("");
    try {
      await onAdd(newExpense);
      setName("");
      setAmount("");
      setCategory("Groceries");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save expense."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="relative mt-8 overflow-hidden rounded-[1.75rem] border border-emerald-300/25 bg-gradient-to-br from-[#173b38] via-[#142d31] to-[#111d2b] p-5 shadow-xl shadow-emerald-950/15 sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-300/10 text-2xl font-light text-emerald-200 shadow-inner shadow-white/5" aria-hidden="true">
            +
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Quick entry</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Add an Expense
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Record a household purchase and keep your spending overview current.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Expense name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="dashboard-dark-field w-full rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3.5 text-white placeholder:text-slate-500 focus:border-emerald-300/60 focus:bg-slate-950/50 focus:outline-none focus:ring-4 focus:ring-emerald-300/10 sm:col-span-2"
          />

          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="dashboard-dark-field w-full rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3.5 text-white placeholder:text-slate-500 focus:border-emerald-300/60 focus:bg-slate-950/50 focus:outline-none focus:ring-4 focus:ring-emerald-300/10"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="dashboard-dark-field w-full rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3.5 text-white focus:border-emerald-300/60 focus:bg-slate-950/50 focus:outline-none focus:ring-4 focus:ring-emerald-300/10"
          >
            <option className="text-slate-900">Groceries</option>
            <option className="text-slate-900">Food</option>
            <option className="text-slate-900">Transport</option>
            <option className="text-slate-900">Shopping</option>
            <option className="text-slate-900">Entertainment</option>
            <option className="text-slate-900">Other</option>
          </select>

          {errorMessage && (
            <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200 sm:col-span-2">
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={addExpense}
            disabled={saving}
            className="group flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 font-semibold text-white shadow-lg shadow-emerald-950/30 transition duration-200 hover:-translate-y-0.5 hover:from-emerald-400 hover:to-teal-400 hover:shadow-emerald-900/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/25 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
          >
            {saving ? "Saving..." : "Add Expense"}
            {!saving && <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>}
          </button>
        </div>
      </div>
    </section>
  );
}