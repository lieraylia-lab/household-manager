# Household Manager

A household bill and expense tracker built with Next.js, Supabase Auth, and
Supabase PostgreSQL. Each account can access only its own bills and expenses.

## Getting Started

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the project URL and
   publishable key from the Supabase project settings.
3. Apply
   [`supabase/migrations/20261006000000_create_household_data.sql`](./supabase/migrations/20261006000000_create_household_data.sql)
   using the Supabase SQL Editor.
4. In Supabase Authentication settings, add
   `http://localhost:3000/auth/callback` as an allowed redirect URL.
5. Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up or log in.
If email confirmation is enabled for the Supabase project, confirm the email
before logging in.

## Data and security

Bills and expenses are loaded from the authenticated API and stored in the
Supabase tables created by the migration. Row-level security policies restrict
records to their owning user. Existing browser `localStorage` records are not
automatically imported.
