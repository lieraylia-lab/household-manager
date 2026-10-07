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
const [showQuickExpense, setShowQuickExpense] = useState(false);
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
const [toast, setToast] = useState<{ message: string } | null>(null);

const showToast = (message: string) => {
  setToast({ message });
};

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

useEffect(() => {
  if (!toast) return;
  const timeout = window.setTimeout(() => setToast(null), 3500);
  return () => window.clearTimeout(timeout);
}, [toast]);

const addExpense = async (expense: NewExpense) => {
  setDataError("");
  const response = await fetch("/api/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expense),
  });
  const savedExpense = await readApiResponse<Expense>(response);
  setExpenses((currentExpenses) => [savedExpense, ...currentExpenses]);
  showToast("Expense added successfully.");
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
    showToast("Bill added successfully.");
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
    showToast(bill.paid ? "Bill marked as unpaid." : "Bill marked as paid.");
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
    showToast("Bill updated successfully.");
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
    showToast("Bill deleted successfully.");
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
      !bill.paid &&
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

const displayedBillsTotal = filteredBills.reduce(
  (total, bill) => total + bill.amount,
  0
);
const displayedBillsLabel =
  billStatusFilter === "Paid"
    ? "Paid total"
    : billStatusFilter === "Unpaid"
      ? "Unpaid total"
      : "Bills total";

useEffect(() => {
  if (!selectedBillPhoto) return;

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") setSelectedBillPhoto(null);
  };
  window.addEventListener("keydown", closeOnEscape);
  return () => window.removeEventListener("keydown", closeOnEscape);
}, [selectedBillPhoto]);

useEffect(() => {
  if (!showQuickExpense) return;

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") setShowQuickExpense(false);
  };
  window.addEventListener("keydown", closeOnEscape);
  return () => window.removeEventListener("keydown", closeOnEscape);
}, [showQuickExpense]);

const currentHour = new Date().getHours();
const greeting =
  currentHour < 12
    ? "Good morning"
    : currentHour < 18
      ? "Good afternoon"
      : "Good evening";

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(ellipse_at_top,_rgba(49,73,125,0.28),_transparent_42%),linear-gradient(145deg,#080e19_0%,#0d1728_48%,#14213a_100%)] px-4 py-5 text-slate-100 sm:px-6 sm:py-8 lg:px-10">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-emerald-300/25 bg-[#142d2d] px-4 py-3 text-sm font-medium text-emerald-100 shadow-2xl shadow-black/30 sm:right-6 sm:top-6"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300" aria-hidden="true">✓</span>
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
            className="ml-1 rounded-lg px-2 py-1 text-emerald-100/70 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
      <div className="mx-auto max-w-7xl">
<header className="relative isolate flex flex-col gap-5 overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-[#1b2a49]/95 via-[#121d32]/95 to-[#101827]/95 px-5 py-6 text-white shadow-2xl shadow-black/25 ring-1 ring-inset ring-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:px-8">
  <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-32 -z-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
  <div aria-hidden="true" className="pointer-events-none absolute bottom-[-8rem] left-[35%] -z-10 h-48 w-72 rounded-full bg-sky-400/[0.08] blur-3xl" />
  <div className="flex items-center gap-4">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-200/20 bg-gradient-to-br from-indigo-400 to-indigo-700 text-xl font-bold text-white shadow-lg shadow-indigo-950/40 ring-1 ring-inset ring-white/20">
      H
    </div>
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-200">
        {greeting}<span className="mx-2 text-indigo-400/70">/</span>Household finance
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
        Household Manager
      </h1>
      <p className="mt-1 text-sm text-slate-300/90">
        A clear view of the money that keeps home running.
      </p>
    </div>
  </div>

  <div className="flex w-full gap-3 sm:w-auto">
    <button
      onClick={() => setShowForm(true)}
      className="flex-1 rounded-xl border border-indigo-300/30 bg-gradient-to-b from-indigo-400 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/35 ring-1 ring-inset ring-white/15 transition hover:-translate-y-0.5 hover:from-indigo-300 hover:to-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300/40 sm:flex-none"
    >
      + Add bill
    </button>
    <button
      onClick={signOut}
      className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 shadow-inner shadow-white/[0.03] hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
    >
      Log out
    </button>
  </div>
</header>

{dataError && (
  <p role="alert" className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-950/45 p-4 text-sm font-medium text-rose-100 shadow-lg shadow-black/10">
    {dataError}
  </p>
)}

{showForm && (
  <div className="relative mt-6 overflow-hidden rounded-[1.6rem] border border-indigo-300/20 bg-gradient-to-br from-[#182742] via-[#121d31] to-[#101827] p-5 shadow-2xl shadow-black/20 sm:p-7">
    <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 h-56 w-56 rounded-full bg-indigo-400/10 blur-3xl" />
    <div className="relative">
    <div className="flex items-start justify-between gap-4">
    <div>
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">New payment</p>
    <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
      Add a bill
    </h2>
    <p className="mt-1 text-sm text-slate-400">Add the details and attach a photo or document if you have one.</p>
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
  className="dashboard-dark-field min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-200 sm:col-span-2"
/>

{billFile && (
  <p className="text-sm text-indigo-200 sm:col-span-2">
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
  className="dashboard-dark-field w-full rounded-xl border border-white/10 bg-slate-950/35 p-3 text-slate-100 placeholder:text-slate-500"
/>

<input
  type="number"
  required
  min="0"
  placeholder="Amount"
  value={billAmount}
  onChange={(e) => setBillAmount(e.target.value)}
  className="dashboard-dark-field w-full rounded-xl border border-white/10 bg-slate-950/35 p-3 text-slate-100 placeholder:text-slate-500"
/>

<input
  type="date"
  required
  value={billDate}
  onChange={(e) => setBillDate(e.target.value)}
  className="dashboard-dark-field w-full rounded-xl border border-white/10 bg-slate-950/35 p-3 text-slate-100 sm:col-span-2"
/>

      <select
  value={billCategory}
  onChange={(e) => setBillCategory(e.target.value)}
  className="dashboard-dark-field w-full rounded-xl border border-white/10 bg-slate-950/35 p-3 text-slate-100 sm:col-span-2"
>
        <option className="text-slate-900">Electricity</option>
        <option className="text-slate-900">Internet</option>
        <option className="text-slate-900">Water</option>
        <option className="text-slate-900">Rent</option>
        <option className="text-slate-900">Other</option>
      </select>

      <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row">
  <button
  onClick={saveBill}
  disabled={uploading}
  className="rounded-xl border border-indigo-300/25 bg-gradient-to-b from-indigo-400 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 ring-1 ring-inset ring-white/10 hover:from-indigo-300 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
>
  {uploading ? "Saving..." : "Save Bill"}
</button>

        <button
          onClick={() => setShowForm(false)}
          className="rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.08]"
        >
          Cancel
        </button>
      </div>
    </div>
    </div>
  </div>
)}
{loading && (
  <div role="status" aria-label="Loading household overview" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {[0, 1, 2, 3].map((item) => (
      <div key={item} className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="h-3 w-28 rounded-full bg-white/10" />
        <div className="mt-6 h-9 w-36 rounded-lg bg-white/10" />
        <div className="mt-3 h-3 w-32 rounded-full bg-white/[0.06]" />
      </div>
    ))}
  </div>
)}
      <section aria-label="Financial overview" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="group relative overflow-hidden rounded-2xl border border-indigo-300/25 bg-gradient-to-br from-[#202d4d] via-[#17233c] to-[#121b2e] p-5 shadow-lg shadow-black/15 ring-1 ring-inset ring-white/[0.04] transition duration-200 hover:-translate-y-1 hover:border-indigo-200/40 hover:shadow-xl hover:shadow-indigo-950/20 sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-indigo-400/10 blur-2xl transition group-hover:bg-indigo-300/15" />
          <div className="relative">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-300">Due this month</h2>
            <span className="rounded-lg border border-indigo-300/20 bg-indigo-400/10 px-2.5 py-1.5 text-[11px] font-bold text-indigo-200">Bills due</span>
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
  ₹{totalThisMonth.toLocaleString("en-IN")}
</p>
          <p className="mt-2 text-xs text-slate-400">Based on bill due dates</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-[#352c36] via-[#242437] to-[#171e2e] p-5 shadow-lg shadow-black/15 ring-1 ring-inset ring-white/[0.04] transition duration-200 hover:-translate-y-1 hover:border-amber-200/40 hover:shadow-xl hover:shadow-amber-950/20 sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl transition group-hover:bg-amber-300/15" />
          <div className="relative">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-300">Due this week</h2>
            <span className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-200">Bills due</span>
          </div>
          <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
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
          <p className="mt-2 text-xs text-amber-200/75">Upcoming unpaid bills</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-rose-300/25 bg-gradient-to-br from-[#382b3c] via-[#252237] to-[#171b2c] p-5 shadow-lg shadow-black/15 ring-1 ring-inset ring-white/[0.04] transition duration-200 hover:-translate-y-1 hover:border-rose-200/40 hover:shadow-xl hover:shadow-rose-950/20 sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-rose-400/10 blur-2xl transition group-hover:bg-rose-300/15" />
          <div className="relative">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-300">Outstanding</h2>
            <span className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-200">Unpaid bills</span>
          </div>

          <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
    ₹
    {bills
      .filter((bill) => !bill.paid)
      .reduce((total, bill) => total + bill.amount, 0)}
  </p>
          <p className="mt-2 text-xs text-rose-100/60">Across all unpaid bills</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-[#1c383a] via-[#172c35] to-[#121d2d] p-5 shadow-lg shadow-black/15 ring-1 ring-inset ring-white/[0.04] transition duration-200 hover:-translate-y-1 hover:border-emerald-200/40 hover:shadow-xl hover:shadow-emerald-950/20 sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl transition group-hover:bg-emerald-300/15" />
          <div className="relative">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-300">Total expenses</h2>
            <span className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200">Expenses</span>
          </div>

          <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            ₹{totalExpenses.toLocaleString("en-IN")}
          </p>
          <p className="mt-2 text-xs text-emerald-100/60">Recorded expenses</p>
          </div>
        </div>
      </section>
      <section aria-labelledby="upcoming-payments-heading" className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-amber-300/25 bg-gradient-to-br from-[#29243a] via-[#171e31] to-[#111827] p-5 shadow-xl shadow-slate-950/15 sm:p-7">
  <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
  <div className="relative">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Bills & payments</p>
      <h2 id="upcoming-payments-heading" className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        Upcoming payments
      </h2>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">{displayedBillsLabel}</p>
        <p className="mt-0.5 text-lg font-bold tabular-nums text-white">₹{displayedBillsTotal.toLocaleString("en-IN")}</p>
      </div>
      <p className="w-fit rounded-full border border-amber-300/20 bg-slate-950/25 px-3 py-1.5 text-sm font-medium text-amber-100">{filteredBills.length} {filteredBills.length === 1 ? "bill" : "bills"} {billStatusFilter === "All" ? "shown" : billStatusFilter.toLowerCase()}</p>
    </div>
  </div>

  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <input
      type="search"
      aria-label="Search bills by name"
      placeholder="Search bills..."
      value={billSearch}
      onChange={(event) => setBillSearch(event.target.value)}
      className="dashboard-dark-field w-full border border-white/10 bg-slate-950/30 p-3 text-slate-100 placeholder:text-slate-500"
    />

    <select
      aria-label="Filter bills by category"
      value={billCategoryFilter}
      onChange={(event) => setBillCategoryFilter(event.target.value)}
      className="dashboard-dark-field w-full border border-white/10 bg-slate-950/30 p-3 text-slate-100"
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
      className="dashboard-dark-field w-full border border-white/10 bg-slate-950/30 p-3 text-slate-100 sm:col-span-2 lg:col-span-1"
    >
      <option>All</option>
      <option>Paid</option>
      <option>Unpaid</option>
    </select>
  </div>

  <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
    {loading ? (
      <div role="status" aria-label="Loading bills" className="space-y-3 py-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex animate-pulse items-center justify-between gap-4 rounded-xl bg-white/[0.03] p-4">
            <div className="flex-1">
              <div className="h-4 w-40 max-w-full rounded-full bg-white/10" />
              <div className="mt-3 h-3 w-28 rounded-full bg-white/[0.07]" />
            </div>
            <div className="h-8 w-24 rounded-lg bg-white/10" />
          </div>
        ))}
      </div>
    ) : loadError ? (
      <div role="alert" className="my-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-5 py-8 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-400/10 text-lg font-semibold text-rose-200" aria-hidden="true">!</span>
        <p className="mt-3 font-semibold text-white">Bills couldn’t be loaded</p>
        <p className="mt-1 text-sm text-rose-100/75">Please refresh and try again.</p>
      </div>
    ) : filteredBills.length === 0 ? (
      <div className="my-4 rounded-2xl border border-dashed border-amber-200/20 bg-slate-950/20 px-5 py-9 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300/10 text-xl text-amber-200" aria-hidden="true">
          {bills.length === 0 ? "＋" : "⌕"}
        </span>
        <p className="mt-3 font-semibold text-white">
          {bills.length === 0 ? "No bills added yet" : "No bills match these filters"}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {bills.length === 0 ? "Add a bill to start tracking upcoming payments." : "Try adjusting your search or filters."}
        </p>
        {bills.length === 0 && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            Add your first bill
          </button>
        )}
      </div>
    ) : filteredBills.map((bill) => (
      <div
  key={bill.id}
        className="group flex flex-col gap-4 rounded-xl px-3 py-5 transition-colors hover:bg-white/[0.03] first:pt-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex min-w-0 flex-col items-start gap-3">
            <p
              className={`max-w-full rounded-xl border px-3.5 py-2 text-base font-bold tracking-tight shadow-sm sm:text-lg ${
                bill.paid
                  ? "border-white/10 bg-white/[0.04] text-slate-400 line-through"
                  : "border-indigo-300/20 bg-indigo-400/10 text-indigo-50"
              }`}
            >
              {bill.name}
            </p>
            {bill.imageUrl && !failedBillPhotoIds.has(bill.id) && (
              <button
                type="button"
                aria-label={`View photo for ${bill.name}`}
                onClick={() => setSelectedBillPhoto(bill)}
                className="shrink-0 overflow-hidden rounded-xl border border-white/15 shadow-lg shadow-black/20 transition hover:border-indigo-200/50 hover:shadow-indigo-950/30 focus:outline-none focus:ring-2 focus:ring-indigo-300"
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

          <p           className="mt-2 text-sm text-slate-400">
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

          <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
              (() => {
                const today = new Date();
                const dueDate = new Date(bill.dueDate);

                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);

                const daysUntil = Math.round(
                  (dueDate.getTime() - today.getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                if (daysUntil < 0) return "border border-rose-300/25 bg-rose-400/10 text-rose-200";
                if (daysUntil === 0) return "border border-amber-300/25 bg-amber-400/10 text-amber-100";
                return "border border-sky-300/25 bg-sky-400/10 text-sky-100";
              })()
            }`}
          >
            <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
              (() => {
                const today = new Date();
                const dueDate = new Date(bill.dueDate);
                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.round(
                  (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
                if (daysUntil < 0) return "bg-rose-300";
                if (daysUntil === 0) return "bg-amber-200";
                return "bg-sky-200";
              })()
            }`} aria-hidden="true" />
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
          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
            bill.paid
              ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
              : "border border-amber-300/20 bg-amber-400/10 text-amber-100"
          }`}>
            {bill.paid ? "Paid" : "Unpaid"}
          </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-lg font-bold tabular-nums text-white">
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
              className="rounded-xl border border-indigo-300/20 bg-indigo-400/10 px-3 py-2.5 text-xs font-semibold text-indigo-100 transition hover:border-indigo-200/40 hover:bg-indigo-400/20 sm:text-sm"
            >
              Edit
            </button>

            <button
              onClick={() => void setBillPaid(bill)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-semibold sm:text-sm ${
                bill.paid
                  ? "border-amber-300/20 bg-amber-400/10 text-amber-100 hover:border-amber-200/35 hover:bg-amber-400/20"
                  : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100 hover:border-emerald-200/35 hover:bg-emerald-400/20"
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
              className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2.5 text-xs font-semibold text-rose-100 transition hover:border-rose-200/35 hover:bg-rose-400/20 sm:text-sm"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    ))}
  </div>
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

      <section aria-labelledby="spending-overview-heading" className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-indigo-300/25 bg-gradient-to-br from-[#1a2a4a] via-[#121d34] to-[#101827] p-5 shadow-xl shadow-indigo-950/15 sm:p-7">
  <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
  <div className="relative">
  <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Spending overview</p>
      <h2 id="spending-overview-heading" className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        Outstanding by category
      </h2>
      <p className="mt-1 text-sm text-slate-400">Unpaid bills grouped by category</p>
    </div>
    <div className="rounded-2xl border border-indigo-300/20 bg-indigo-400/10 px-5 py-4 shadow-inner shadow-white/5">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Total outstanding</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        ₹{bills.filter((bill) => !bill.paid).reduce((sum, bill) => sum + bill.amount, 0).toLocaleString("en-IN")}
      </p>
    </div>
  </div>

  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from(
      new Set(bills.map((bill) => bill.category))
    ).map((category) => {
      const total = bills
        .filter((bill) => bill.category === category && !bill.paid)
        .reduce((sum, bill) => sum + bill.amount, 0);
      const outstandingTotal = bills
        .filter((bill) => !bill.paid)
        .reduce((sum, bill) => sum + bill.amount, 0);
      const share = outstandingTotal > 0 ? (total / outstandingTotal) * 100 : 0;

      return (
        <div
          key={category}
          className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 shadow-inner shadow-white/[0.03] transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300/30 hover:bg-slate-900/60"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-300 shadow-[0_0_12px_rgb(165_180_252/55%)]" />
              <p className="truncate font-medium text-slate-200">{category}</p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums text-white">
              ₹{total.toLocaleString("en-IN")}
            </p>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700/80"
            role="img"
            aria-label={`${category}: ${Math.round(share)}% of outstanding bills`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-sky-300 transition-[width] duration-500"
              style={{ width: `${share}%` }}
            />
          </div>
        </div>
      );
    })}
  </div>
  </div>
</section>

<ExpenseForm onAdd={addExpense} />
<ExpenseList expenses={expenses} loading={loading} loadError={loadError} />
      </div>

      {showQuickExpense && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-expense-heading"
          onClick={() => setShowQuickExpense(false)}
          className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:items-center sm:p-6"
        >
          <div
            className="my-auto w-full max-w-xl [&>section]:mt-0"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-[#111d2d] px-4 py-3 shadow-xl shadow-black/20">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Quick entry</p>
                <h2 id="quick-expense-heading" className="mt-0.5 text-sm font-semibold text-white">Add an expense</h2>
              </div>
              <button
                type="button"
                aria-label="Close add expense dialog"
                onClick={() => setShowQuickExpense(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
              >
                ×
              </button>
            </div>
            <ExpenseForm
              onAdd={async (expense) => {
                await addExpense(expense);
                setShowQuickExpense(false);
              }}
            />
          </div>
        </div>
      )}

      {!showQuickExpense && (
        <button
          type="button"
          aria-label="Add expense"
          title="Add expense"
          onClick={() => setShowQuickExpense(true)}
          className="group fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200/30 bg-gradient-to-br from-emerald-400 to-teal-600 text-3xl font-light leading-none text-white shadow-xl shadow-emerald-950/50 ring-1 ring-inset ring-white/20 transition duration-200 hover:-translate-y-1 hover:scale-105 hover:from-emerald-300 hover:to-teal-500 hover:shadow-2xl hover:shadow-emerald-900/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200/50 active:scale-95 sm:bottom-7 sm:right-7"
        >
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:rotate-90">+</span>
          <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Add expense
          </span>
        </button>
      )}
    </main>
  );
}