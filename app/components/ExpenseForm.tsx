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
    <div className="mt-8 rounded-xl bg-white p-6 shadow">
      <h2 className="text-xl font-semibold text-gray-900">
        Add an Expense
      </h2>

      <div className="mt-4 grid gap-4">
        <input
          type="text"
          placeholder="Expense name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-gray-300 p-3 text-gray-900"
        />

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border border-gray-300 p-3 text-gray-900"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-300 p-3 text-gray-900"
        >
          <option>Groceries</option>
          <option>Food</option>
          <option>Transport</option>
          <option>Shopping</option>
          <option>Entertainment</option>
          <option>Other</option>
        </select>

        {errorMessage && (
          <p role="alert" className="text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={addExpense}
          disabled={saving}
          className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
        >
          {saving ? "Saving..." : "Add Expense"}
        </button>
      </div>
    </div>
  );
}