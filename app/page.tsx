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
    <main className="min-h-screen bg-gray-100 p-8">
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-4xl font-bold text-gray-900">
      Household Manager
    </h1>

    <p className="mt-2 text-gray-600">
      Keep track of your bills and never miss a payment.
    </p>
  </div>

  <div className="flex items-center gap-3">
    <button
      onClick={() => setShowForm(true)}
      className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
    >
      + Add Bill
    </button>
    <button
      onClick={signOut}
      className="rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-white"
    >
      Log out
    </button>
  </div>
</div>

{dataError && (
  <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
    {dataError}
  </p>
)}

{showForm && (
  <div className="mt-8 rounded-xl bg-white p-6 shadow">
    <h2 className="text-xl font-semibold text-gray-900">
      Add a Bill
    </h2>

    <div className="mt-4 grid gap-4">
<input
  type="file"
  accept=".pdf,.jpg,.jpeg,.png"
  onChange={(e) => {
    const file = e.target.files?.[0] ?? null;
    setBillFile(file);
  }}
  className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
/>

{billFile && (
  <p className="text-sm text-gray-600">
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
  className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder:text-gray-500"
/>

<input
  type="number"
  required
  min="0"
  placeholder="Amount"
  value={billAmount}
  onChange={(e) => setBillAmount(e.target.value)}
  className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder:text-gray-500"
/>

<input
  type="date"
  required
  value={billDate}
  onChange={(e) => setBillDate(e.target.value)}
  className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
/>

      <select
  value={billCategory}
  onChange={(e) => setBillCategory(e.target.value)}
  className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
>
        <option>Electricity</option>
        <option>Internet</option>
        <option>Water</option>
        <option>Rent</option>
        <option>Other</option>
      </select>

      <div className="flex gap-3">
  <button
  onClick={saveBill}
  disabled={uploading}
  className="rounded-lg bg-black px-5 py-3 font-medium text-white disabled:opacity-60"
>
  {uploading ? "Saving..." : "Save Bill"}
</button>

        <button
          onClick={() => setShowForm(false)}
          className="rounded-lg border px-5 py-3 font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
{loading && (
  <p role="status" className="mt-8 text-center text-gray-500">
    Loading your household data...
  </p>
)}
      <div className="mt-8 grid gap-6 md:grid-cols-4">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">This Month</h2>
          <p className="mt-2 text-3xl font-bold text-gray-900">
  ₹{totalThisMonth}
</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Due This Week</h2>
          <p className="mt-2 text-3xl font-bold text-gray-900">
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
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">
            Total Outstanding
          </h2>

          <p className="mt-2 text-3xl font-bold text-gray-900">
    ₹
    {bills
      .filter((bill) => !bill.paid)
      .reduce((total, bill) => total + bill.amount, 0)}
  </p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">
            Total Expenses
          </h2>

          <p className="mt-2 text-3xl font-bold text-gray-900">
            ₹{totalExpenses}
          </p>
        </div>
      </div>
      <div className="mt-8 rounded-xl bg-white p-6 shadow">
  <h2 className="text-xl font-semibold text-gray-900">
    Upcoming Payments
  </h2>

  <div className="mt-4 grid gap-3 sm:grid-cols-3">
    <input
      type="search"
      aria-label="Search bills by name"
      placeholder="Search bills..."
      value={billSearch}
      onChange={(event) => setBillSearch(event.target.value)}
      className="rounded-lg border border-gray-300 p-3 text-gray-900 placeholder:text-gray-500"
    />

    <select
      aria-label="Filter bills by category"
      value={billCategoryFilter}
      onChange={(event) => setBillCategoryFilter(event.target.value)}
      className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
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
      className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
    >
      <option>All</option>
      <option>Paid</option>
      <option>Unpaid</option>
    </select>
  </div>

  <div className="mt-4 space-y-4">
    {filteredBills.length === 0 ? (
      <p className="py-4 text-center text-gray-500">
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
        className={`flex items-center justify-between border-b pb-4 ${
          bill.paid ? "opacity-50" : ""
        }`}
      >
        <div>
          <div className="flex items-center gap-3">
            <p
              className={`font-medium ${
                bill.paid
                  ? "text-gray-500 line-through"
                  : "text-gray-900"
              }`}
            >
              {bill.name}
            </p>
            {bill.imageUrl && !failedBillPhotoIds.has(bill.id) && (
              <button
                type="button"
                aria-label={`View photo for ${bill.name}`}
                onClick={() => setSelectedBillPhoto(bill)}
                className="overflow-hidden rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <Image
                  src={bill.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  onError={() =>
                    setFailedBillPhotoIds((current) =>
                      new Set(current).add(bill.id)
                    )
                  }
                  className="h-12 w-12 object-cover"
                />
              </button>
            )}
          </div>

          <p className="text-sm text-gray-500">
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
            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
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
            ₹{bill.amount}
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setEditingBill({ ...bill });
                setEditAmount(String(bill.amount));
                setEditPhotoFile(null);
                setEditError("");
              }}
              className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
            >
              Edit
            </button>

            <button
              onClick={() => void setBillPaid(bill)}
              className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
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
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>

{editingBill && (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-bill-heading"
    onClick={() => setEditingBill(null)}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
  >
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void saveBillEdit();
      }}
      onClick={(event) => event.stopPropagation()}
      className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow"
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
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
  >
    <div
      className="relative max-h-full max-w-full"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Close image"
        onClick={() => setSelectedBillPhoto(null)}
        className="absolute right-2 top-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow hover:bg-gray-100"
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

      <div className="mt-8 rounded-xl bg-white p-6 shadow">
  <h2 className="text-xl font-semibold text-gray-900">
    Spending by Category
  </h2>

  <div className="mt-4 space-y-3">
    {Array.from(
      new Set(bills.map((bill) => bill.category))
    ).map((category) => {
      const total = bills
        .filter((bill) => bill.category === category && !bill.paid)
        .reduce((sum, bill) => sum + bill.amount, 0);

      return (
        <div
          key={category}
          className="flex items-center justify-between border-b pb-3"
        >
          <p className="font-medium text-gray-900">
            {category}
          </p>

          <p className="font-semibold text-gray-900">
            ₹{total}
          </p>
        </div>
      );
    })}
  </div>
</div>

<ExpenseForm onAdd={addExpense} />
<ExpenseList expenses={expenses} loading={loading} loadError={loadError} />
    </main>
  );
}