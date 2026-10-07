"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [updated, setUpdated] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setUpdated(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update your password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-gray-900">Choose a new password</h1>

        {updated ? (
          <>
            <p role="status" className="mt-4 text-gray-600">
              Your password has been updated.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="mt-6 w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              Continue to Household Manager
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-gray-600">
              Enter and confirm your new password.
            </p>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              <label className="block text-sm font-medium text-gray-700">
                New password
                <input
                  required
                  autoComplete="new-password"
                  minLength={8}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Confirm new password
                <input
                  required
                  autoComplete="new-password"
                  minLength={8}
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                />
              </label>

              {errorMessage && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Please wait..." : "Update password"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
