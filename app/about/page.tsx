import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works | Household Manager",
  description:
    "Learn how Household Manager helps you organize bills, payment dates, bill photos, and household expenses.",
};

const features = [
  {
    number: "01",
    title: "Keep every bill in view",
    description:
      "Add bills with an amount, due date, and category, then see upcoming payments together in one list.",
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    number: "02",
    title: "Know what is paid",
    description:
      "Mark bills paid or unpaid and use the dashboard summary to get a quick view of what is coming up.",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    number: "03",
    title: "Keep bill photos handy",
    description:
      "Attach a photo to a bill and open it from the bill list when you need to check the details.",
    color: "bg-sky-100 text-sky-700",
  },
  {
    number: "04",
    title: "Track household expenses",
    description:
      "Record everyday expenses and review them alongside your household bills for a clearer overview.",
    color: "bg-amber-100 text-amber-800",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-sky-100 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/login" className="inline-flex items-center gap-3" aria-label="Household Manager">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-600/25">H</span>
            <span className="text-sm font-bold tracking-tight text-slate-900">Household Manager</span>
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 sm:px-5"
          >
            Log in
          </Link>
        </header>

        <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-[#101a30] px-6 py-12 text-white shadow-xl shadow-slate-900/10 sm:mt-12 sm:px-10 sm:py-16 lg:px-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">A little less to keep track of</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Home finances, made easier to follow.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Household Manager brings bills, payment status, bill photos, and expenses together in a simple dashboard, so it is easier to see what needs attention.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-indigo-800 shadow-lg shadow-black/10 hover:bg-indigo-50"
            >
              Get started <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className="mt-10 sm:mt-14">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">What you can do</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">The essentials, all in one place.</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Add information as you go, then use the dashboard to keep a practical overview of household spending.
            </p>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="rounded-2xl border border-white bg-white/85 p-6 shadow-sm shadow-slate-900/5 backdrop-blur"
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${feature.color}`}>
                  {feature.number}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-6 mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl border border-indigo-100 bg-white/80 p-6 shadow-sm sm:mb-0 sm:mt-12 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Ready to get organized?</h2>
            <p className="mt-1 text-sm text-slate-600">Log in or create an account to open your household dashboard.</p>
          </div>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 sm:w-auto"
          >
            Continue to Household Manager
          </Link>
        </section>

        <footer className="py-6 text-center text-xs text-slate-500">
          Household Manager · Keep home finances in view.
        </footer>
      </div>
    </main>
  );
}
