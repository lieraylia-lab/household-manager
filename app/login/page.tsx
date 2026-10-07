"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setNotice("");
    setSubmitting(true);

    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        if (!data.session) {
          setNotice("Account created. Check your email to confirm your address.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete authentication."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-slate-50 to-sky-100 px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 top-[-8rem] h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-sky-200/60 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 shadow-2xl shadow-indigo-950/10 backdrop-blur sm:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between bg-gradient-to-br from-white/80 to-indigo-50/80 p-7 sm:p-10 lg:p-14">
          <div>
            <Link href="/login" className="inline-flex items-center gap-3" aria-label="Household Manager home">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-600/25">H</span>
              <span className="text-sm font-bold tracking-tight text-slate-900">Household Manager</span>
            </Link>

            <div className="mt-10 max-w-xl sm:mt-16">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">A calmer way to manage home</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl">
                Your household finances, <span className="text-indigo-600">in one clear place.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
                Keep bills, due dates, payment status, and day-to-day expenses organized without the mental juggling.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:mt-10">
              <div className="flex items-start gap-4 rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700" aria-hidden="true">↗</span>
                <div>
                  <h2 className="font-semibold text-slate-900">See what’s coming</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">Keep bill due dates and payment status easy to find.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700" aria-hidden="true">✓</span>
                <div>
                  <h2 className="font-semibold text-slate-900">Keep the details together</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">Add bill photos and record household expenses alongside your bills.</p>
                </div>
              </div>
            </div>
          </div>

          <Link href="/about" className="mt-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
            See how it works <span aria-hidden="true">→</span>
          </Link>
        </section>

        <section className="flex items-center justify-center bg-white p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <div className="mb-7">
              <p className="text-sm font-semibold text-indigo-600">{mode === "login" ? "Welcome back" : "Get started"}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {mode === "login" ? "Log in to your account" : "Create your account"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === "login"
                  ? "Pick up right where your household left off."
                  : "Start bringing your household finances together."}
              </p>
            </div>

            <form className="space-y-5" onSubmit={submit}>
              <label className="block text-sm font-semibold text-slate-700">
                Email address
                <input
                  required
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Password
                <input
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={8}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
                />
              </label>

              {mode === "login" && (
                <div className="-mt-2 text-right text-sm">
                  <Link href="/forgot-password" className="font-semibold text-indigo-700 hover:text-indigo-900">
                    Forgot password?
                  </Link>
                </div>
              )}

              {errorMessage && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Please wait..."
                  : mode === "login"
                    ? "Log in"
                    : "Create account"}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-600">
              {mode === "login" ? "New to Household Manager?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setErrorMessage("");
                  setNotice("");
                }}
                className="font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4 hover:text-indigo-900"
              >
                {mode === "login" ? "Sign up" : "Log in"}
              </button>
            </p>
            <p className="mt-6 text-center text-xs text-slate-400">
              Your household, organized one bill at a time.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
