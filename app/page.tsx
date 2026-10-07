"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ExpenseForm from "./components/ExpenseForm";
import ExpenseList from "./components/ExpenseList";
import type { Expense, NewExpense } from "./components/ExpenseList";
import { readApiResponse } from "../lib/api";
import { createClient } from "../lib/supabase/client";

type Bill = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  paid: boolean;
  fileName?: string;
  imageUrl?: string;
};

export default function Home() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
const [billSearch, setBillSearch] = useState("");
const [billCategoryFilter, setBillCategoryFilter] = useState("All");
const [billStatusFilter, setBillStatusFilter] = useState("All");
const [billName, setBillName] = useState("");
const [billAmount, setBillAmount] = useState("");
const [billDate, setBillDate] = useState("");
const [billCategory, setBillCategory] = useState("Electricity");
const [billFile, setBillFile] = useState<File | null>(null);
const [uploading, setUploading] = useState(false);
const [bills, setBills] = useState<Bill[]>([]);
const [selectedBillPhoto, setSelectedBillPhoto] = useState<Bill | null>(null);
const [editingBill, setEditingBill] = useState<Bill | null>(null);
const [editAmount, setEditAmount] = useState("");
const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
const [editError, setEditError] = useState("");
const [savingEdit, setSavingEdit] = useState(false);
const [failedBillPhotoIds, setFailedBillPhotoIds] = useState<Set<string>>(
  new Set()
);
const [expenses, setExpenses] = useState<Expense[]>([]);
const [loading, setLoading] = useState(true);
const [loadError, setLoadError] = useState(false);
const [dataError, setDataError] = useState("");

useEffect(() => {
  let active = true;

  const loadData = async () => {
    try {
      const [billsResponse, expensesResponse] = await Promise.all([
        fetch("/api/bills"),
        fetch("/api/expenses"),
      ]);
      const [savedBills, savedExpenses] = await Promise.all([
        readApiResponse<Bill[]>(billsResponse),
        readApiResponse<Expense[]>(expensesResponse),
      ]);

      if (active) {
        setBills(savedBills);
        setExpenses(savedExpenses);
      }
    } catch (error) {
      if (active) {
        setLoadError(true);
        setDataError(
          error instanceof Error ? error.message : "Unable to load household data."
        );
      }
    } finally {
      if (active) setLoading(false);
    }
  };

  void loadData();
  return () => {
    active = false;
  };
}, []);

const addExpense = async (expense: NewExpense) => {
  setDataError("");
  const response = await fetch("/api/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expense),
  });
  const savedExpense = await readApiResponse<Expense>(response);
  setExpenses((currentExpenses) => [savedExpense, ...currentExpenses]);
};

const saveBill = async () => {
  const amount = Number(billAmount);
  if (
    !billName.trim() ||
    !billDate ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    setDataError("Enter a bill name, valid amount, and due date.");
    return;
  }

  setUploading(true);
  setDataError("");
  try {
    let uploadedFile: { filePath: string; fileName: string } | undefined;
    if (billFile) {
      const formData = new FormData();
      formData.append("file", billFile);
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      uploadedFile = await readApiResponse<{
        filePath: string;
        fileName: string;
      }>(uploadResponse);
    }

    const response = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: billName.trim(),
        amount,
        dueDate: billDate,
        category: billCategory,
        fileName: uploadedFile?.fileName ?? "",
        filePath: uploadedFile?.filePath,
      }),
    });
    let savedBill = await readApiResponse<Bill>(response);
    if (uploadedFile) {
      const attachmentResponse = await fetch("/api/bills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: savedBill.id,
          filePath: uploadedFile.filePath,
          fileName: uploadedFile.fileName,
        }),
      });
      savedBill = await readApiResponse<Bill>(attachmentResponse);
    }

    setBills((currentBills) => [...currentBills, savedBill]);
    setShowForm(false);
    setBillName("");
    setBillAmount("");
    setBillDate("");
    setBillCategory("Electricity");
    setBillFile(null);
  } catch (error) {
    setDataError(
      error instanceof Error ? error.message : "Unable to save bill."
    );
  } finally {
    setUploading(false);
  }
};

const setBillPaid = async (bill: Bill) => {
  setDataError("");
  try {
    const response = await fetch("/api/bills", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bill.id, paid: !bill.paid }),
    });
    const updatedBill = await readApiResponse<Bill>(response);
    setBills((currentBills) =>
      currentBills.map((item) => (item.id === updatedBill.id ? updatedBill : item))
    );
  } catch (error) {
    setDataError(
      error instanceof Error ? error.message : "Unable to update bill."
    );
  }
};

const saveBillEdit = async () => {
  if (!editingBill) return;

  setSavingEdit(true);
  setEditError("");
  try {
    let replacementPhoto: { filePath: string; fileName: string } | undefined;
    if (editPhotoFile) {
      const formData = new FormData();
      formData.append("file", editPhotoFile);
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      replacementPhoto = await readApiResponse<{
        filePath: string;
        fileName: string;
      }>(uploadResponse);
    }

    const response = await fetch("/api/bills", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingBill.id,
        name: editingBill.name,
        amount: Number(editAmount),
        dueDate: editingBill.dueDate,
        category: editingBill.category,
        filePath: replacementPhoto?.filePath,
        fileName: replacementPhoto?.fileName,
      }),
    });
    const updatedBill = await readApiResponse<Bill>(response);
    setBills((currentBills) =>
      currentBills.map((bill) =>
        bill.id === updatedBill.id ? updatedBill : bill
      )
    );
    setFailedBillPhotoIds((current) => {
      const next = new Set(current);
      next.delete(updatedBill.id);
      return next;
    });
    setEditingBill(null);
    setEditPhotoFile(null);
  } catch (error) {
    setEditError(
      error instanceof Error ? error.message : "Unable to update bill."
    );
  } finally {
    setSavingEdit(false);
  }
};

const deleteBill = async (bill: Bill) => {
  setDataError("");
  try {
    const response = await fetch(`/api/bills?id=${encodeURIComponent(bill.id)}`, {
      method: "DELETE",
    });
    await readApiResponse<{ id: string }>(response);
    setBills((currentBills) =>
      currentBills.filter((item) => item.id !== bill.id)
    );
  } catch (error) {
    setDataError(
      error instanceof Error ? error.message : "Unable to delete bill."
    );
  }
};

const signOut = async () => {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setDataError(error.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  } catch (error) {
    setDataError(
      error instanceof Error ? error.message : "Unable to log out."
    );
  }
};

const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();

const totalThisMonth = bills
  .filter((bill) => {
    const date = new Date(bill.dueDate);

    return (
      date.getMonth() === currentMonth &&
      date.getFullYear() === currentYear
    );
  })
  .reduce((total, bill) => total + bill.amount, 0);

const totalExpenses = expenses.reduce(
  (total, expense) => total + expense.amount,
  0
);

const filteredBills = bills.filter((bill) => {
  const matchesName = bill.name
    .toLowerCase()
    .includes(billSearch.trim().toLowerCase());
  const matchesCategory =
    billCategoryFilter === "All" || bill.category === billCategoryFilter;
  const matchesStatus =
    billStatusFilter === "All" ||
    (billStatusFilter === "Paid" ? bill.paid : !bill.paid);

  return matchesName && matchesCategory && matchesStatus;
});

useEffect(() => {
  if (!selectedBillPhoto) return;

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") setSelectedBillPhoto(null);
  };
  window.addEventListener("keydown", closeOnEscape);
  return () => window.removeEventListener("keydown", closeOnEscape);
}, [selectedBillPhoto]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fb] px-4 py-5 text-slate-900 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
<header className="flex flex-col gap-5 rounded-3xl bg-[#101a30] px-5 py-6 text-white shadow-xl shadow-slate-900/10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
  <div className="flex items-center gap-4">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-xl font-bold text-white shadow-lg shadow-indigo-950/30">
      H
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
        Household finance
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        Household Manager
      </h1>
      <p className="mt-1 text-sm text-slate-300">
        A clear view of the money that keeps home running.
      </p>
    </div>
  </div>

  <div className="flex w-full gap-3 sm:w-auto">
    <button
      onClick={() => setShowForm(true)}
      className="flex-1 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/20 hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300/40 sm:flex-none"
    >
      + Add bill
    </button>
    <button
      onClick={signOut}
      className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
    >
      Log out
    </button>
  </div>
</header>

{dataError && (
  <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">
    {dataError}
  </p>
)}

{showForm && (
  <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex items-start justify-between gap-4">
    <div>
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">New payment</p>
    <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
      Add a bill
    </h2>
    </div>
    </div>

    <div className="mt-5 grid gap-4 sm:grid-cols-2">
<input
  type="file"
  accept=".pdf,.jpg,.jpeg,.png"
  onChange={(e) => {
    const file = e.target.files?.[0] ?? null;
    setBillFile(file);
  }}
  className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:col-span-2"
/>

{billFile && (
  <p className="text-sm text-slate-500 sm:col-span-2">
    Selected: {billFile.name}
  </p>
)}

<input
  type="text"
  required
  maxLength={200}
  placeholder="Bill name"
  value={billName}
  onChange={(e) => setBillName(e.target.value)}
  className="w-full border border-slate-200 p-3 text-slate-900 placeholder:text-slate-400"
/>

<input
  type="number"
  required
  min="0"
  placeholder="Amount"
  value={billAmount}
  onChange={(e) => setBillAmount(e.target.value)}
  className="w-full border border-slate-200 p-3 text-slate-900 placeholder:text-slate-400"
/>

<input
  type="date"
  required
  value={billDate}
  onChange={(e) => setBillDate(e.target.value)}
  className="w-full border border-slate-200 p-3 text-slate-900 sm:col-span-2"
/>

      <select
  value={billCategory}
  onChange={(e) => setBillCategory(e.target.value)}
  className="w-full border border-slate-200 bg-white p-3 text-slate-900 sm:col-span-2"
>
        <option>Electricity</option>
        <option>Internet</option>
        <option>Water</option>
        <option>Rent</option>
        <option>Other</option>
      </select>

      <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row">
  <button
  onClick={saveBill}
  disabled={uploading}
  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
>
  {uploading ? "Saving..." : "Save Bill"}
</button>

        <button
          onClick={() => setShowForm(false)}
          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
{loading && (
  <p role="status" className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm font-medium text-slate-500 shadow-sm">
    Loading your household overview...
  </p>
)}
      <section aria-label="Financial overview" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500">Due this month</h2>
            <span className="rounded-xl bg-indigo-50 px-2.5 py-2 text-xs font-bold text-indigo-600">Bills due</span>
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
  ₹{totalThisMonth.toLocaleString("en-IN")}
</p>
          <p className="mt-2 text-xs text-slate-400">Based on bill due dates</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500">Due this week</h2>
            <span className="rounded-xl bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-600">Bills due</span>
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
  ₹
  {bills
    .filter((bill) => {
      if (bill.paid) return false;

      const dueDate = new Date(bill.dueDate);
      const today = new Date();
      const sevenDaysFromNow = new Date();

      today.setHours(0, 0, 0, 0);
      sevenDaysFromNow.setDate(today.getDate() + 7);
      sevenDaysFromNow.setHours(23, 59, 59, 999);

      return dueDate >= today && dueDate <= sevenDaysFromNow;
    })
    .reduce((total, bill) => total + bill.amount, 0)}
</p>
          <p className="mt-2 text-xs text-amber-600">Upcoming unpaid bills</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500">Outstanding</h2>
            <span className="rounded-xl bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-600">Unpaid bills</span>
          </div>

          <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
    ₹
    {bills
      .filter((bill) => !bill.paid)
      .reduce((total, bill) => total + bill.amount, 0)}
  </p>
          <p className="mt-2 text-xs text-slate-400">Across all unpaid bills</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500">Total expenses</h2>
            <span className="rounded-xl bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-600">Expenses</span>
          </div>

          <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            ₹{totalExpenses.toLocaleString("en-IN")}
          </p>
          <p className="mt-2 text-xs text-slate-400">Recorded expenses</p>
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Bills & payments</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        Upcoming payments
      </h2>
    </div>
    <p className="text-sm text-slate-500">{bills.length} {bills.length === 1 ? "bill" : "bills"} tracked</p>
  </div>

  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <input
      type="search"
      aria-label="Search bills by name"
      placeholder="Search bills..."
      value={billSearch}
      onChange={(event) => setBillSearch(event.target.value)}
      className="w-full border border-slate-200 p-3 text-slate-900 placeholder:text-slate-400"
    />

    <select
      aria-label="Filter bills by category"
      value={billCategoryFilter}
      onChange={(event) => setBillCategoryFilter(event.target.value)}
      className="w-full border border-slate-200 bg-white p-3 text-slate-900"
    >
      <option>All</option>
      {Array.from(new Set(bills.map((bill) => bill.category))).map((category) => (
        <option key={category}>{category}</option>
      ))}
    </select>

    <select
      aria-label="Filter bills by payment status"
      value={billStatusFilter}
      onChange={(event) => setBillStatusFilter(event.target.value)}
      className="w-full border border-slate-200 bg-white p-3 text-slate-900 sm:col-span-2 lg:col-span-1"
    >
      <option>All</option>
      <option>Paid</option>
      <option>Unpaid</option>
    </select>
  </div>

  <div className="mt-5 divide-y divide-slate-100">
    {filteredBills.length === 0 ? (
      <p className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
  {loading
    ? "Loading bills..."
    : loadError
    ? "Unable to load bills right now."
    : bills.length === 0
    ? "No bills yet. Add your first bill."
    : "No bills match your filters."}
      </p>
    ) : filteredBills.map((bill) => (
      <div
  key={bill.id}
        className="flex flex-col gap-4 py-5 first:pt-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex min-w-0 flex-col items-start gap-3">
            <p
              className={`max-w-full rounded-xl border px-3.5 py-2 text-base font-bold tracking-tight shadow-sm sm:text-lg ${
                bill.paid
                  ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
                  : "border-indigo-100 bg-indigo-50/70 text-slate-950"
              }`}
            >
              {bill.name}
            </p>
            {bill.imageUrl && !failedBillPhotoIds.has(bill.id) && (
              <button
                type="button"
                aria-label={`View photo for ${bill.name}`}
                onClick={() => setSelectedBillPhoto(bill)}
                className="shrink-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <Image
                  src={bill.imageUrl}
                  alt=""
                  width={88}
                  height={88}
                  unoptimized
                  onError={() =>
                    setFailedBillPhotoIds((current) =>
                      new Set(current).add(bill.id)
                    )
                  }
                  className="h-22 w-22 object-cover"
                />
              </button>
            )}
          </div>

          <p           className="mt-2 text-sm text-slate-500">
            {bill.category} •{" "}
            {(() => {
              const today = new Date();
              const dueDate = new Date(bill.dueDate);

              today.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);

              const daysUntil = Math.round(
                (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              );

              if (daysUntil === 0) return "Due today";
              if (daysUntil === 1) return "Due tomorrow";
              if (daysUntil > 1) return `Due in ${daysUntil} days`;
              if (daysUntil < 0) return `Overdue by ${Math.abs(daysUntil)} days`;

              return "Due";
            })()}
          </p>

          <span
            className={`mt-3 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
              (() => {
                const today = new Date();
                const dueDate = new Date(bill.dueDate);

                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);

                const daysUntil = Math.round(
                  (dueDate.getTime() - today.getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                if (daysUntil < 0) return "bg-red-100 text-red-700";
                if (daysUntil === 0) return "bg-yellow-100 text-yellow-700";
                return "bg-green-100 text-green-700";
              })()
            }`}
          >
            {(() => {
              const today = new Date();
              const dueDate = new Date(bill.dueDate);

              today.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);

              const daysUntil = Math.round(
                (dueDate.getTime() - today.getTime()) /
                  (1000 * 60 * 60 * 24)
              );

              if (daysUntil < 0) return "Overdue";
              if (daysUntil === 0) return "Due Today";
              return "Upcoming";
            })()}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <p className="font-semibold text-gray-900">
            ₹{bill.amount.toLocaleString("en-IN")}
          </p>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <button
              onClick={() => {
                setEditingBill({ ...bill });
                setEditAmount(String(bill.amount));
                setEditPhotoFile(null);
                setEditError("");
              }}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 sm:text-sm"
            >
              Edit
            </button>

            <button
              onClick={() => void setBillPaid(bill)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-semibold sm:text-sm ${
                bill.paid
                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100"
              }`}
            >
              {bill.paid ? "Mark Unpaid" : "Mark Paid"}
            </button>

            <button
              onClick={() => {
                const confirmed = window.confirm(
                  `Delete ${bill.name}?`
                );

                if (!confirmed) return;
                void deleteBill(bill);
              }}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 hover:border-rose-300 hover:bg-rose-100 sm:text-sm"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    ))}
  </div>
</section>

{editingBill && (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-bill-heading"
    onClick={() => setEditingBill(null)}
    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6"
  >
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void saveBillEdit();
      }}
      onClick={(event) => event.stopPropagation()}
      className="my-auto w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
    >
      <h2 id="edit-bill-heading" className="text-xl font-semibold text-gray-900">
        Edit Bill
      </h2>
      <label className="block text-sm font-medium text-gray-700">
        Replace bill photo
        <input
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          onChange={(event) =>
            setEditPhotoFile(event.target.files?.[0] ?? null)
          }
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
        />
      </label>
      {editPhotoFile && (
        <p className="text-sm text-gray-600">
          New photo: {editPhotoFile.name}
        </p>
      )}
      <label className="block text-sm font-medium text-gray-700">
        Bill name
        <input
          required
          maxLength={200}
          value={editingBill.name}
          onChange={(event) =>
            setEditingBill({ ...editingBill, name: event.target.value })
          }
          className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900"
        />
      </label>
      <label className="block text-sm font-medium text-gray-700">
        Amount
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={editAmount}
          onChange={(event) => setEditAmount(event.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900"
        />
      </label>
      <label className="block text-sm font-medium text-gray-700">
        Due date
        <input
          required
          type="date"
          value={editingBill.dueDate}
          onChange={(event) =>
            setEditingBill({ ...editingBill, dueDate: event.target.value })
          }
          className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900"
        />
      </label>
      <label className="block text-sm font-medium text-gray-700">
        Category
        <select
          value={editingBill.category}
          onChange={(event) =>
            setEditingBill({ ...editingBill, category: event.target.value })
          }
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
        >
          {!["Electricity", "Internet", "Water", "Rent", "Other"].includes(
            editingBill.category
          ) && <option>{editingBill.category}</option>}
          <option>Electricity</option>
          <option>Internet</option>
          <option>Water</option>
          <option>Rent</option>
          <option>Other</option>
        </select>
      </label>
      {editError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {editError}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={savingEdit}
          className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {savingEdit ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingBill(null);
            setEditPhotoFile(null);
          }}
          className="rounded-lg border px-5 py-3 font-medium text-gray-900"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
)}

{selectedBillPhoto?.imageUrl && (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={`${selectedBillPhoto.name} bill photo`}
    onClick={() => setSelectedBillPhoto(null)}
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm sm:p-6"
  >
    <div
      className="relative max-h-full max-w-full"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Close image"
        onClick={() => setSelectedBillPhoto(null)}
        className="absolute right-2 top-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg hover:bg-indigo-50"
      >
        Close
      </button>
      <Image
        src={selectedBillPhoto.imageUrl}
        alt={`Bill photo for ${selectedBillPhoto.name}`}
        width={1200}
        height={900}
        unoptimized
        onError={() => {
          setFailedBillPhotoIds((current) =>
            new Set(current).add(selectedBillPhoto.id)
          );
          setSelectedBillPhoto(null);
        }}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
      />
    </div>
  </div>
)}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Spending overview</p>
  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
    Outstanding by category
  </h2>

  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from(
      new Set(bills.map((bill) => bill.category))
    ).map((category) => {
      const total = bills
        .filter((bill) => bill.category === category && !bill.paid)
        .reduce((sum, bill) => sum + bill.amount, 0);

      return (
        <div
          key={category}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
        >
          <p className="font-medium text-slate-700">
            {category}
          </p>

          <p className="font-semibold text-slate-900">
            ₹{total.toLocaleString("en-IN")}
          </p>
        </div>
      );
    })}
  </div>
</section>

<ExpenseForm onAdd={addExpense} />
<ExpenseList expenses={expenses} loading={loading} loadError={loadError} />
      </div>
    </main>
  );
}