import { NextResponse } from "next/server";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/authenticated";

const EXPENSE_CATEGORIES = [
  "Groceries",
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Other",
] as const;

type ParsedExpense = {
  amount: number;
  category: (typeof EXPENSE_CATEGORIES)[number];
  description: string;
  date: string;
};

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isParsedExpense(value: unknown): value is ParsedExpense {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.amount === "number" &&
    Number.isFinite(record.amount) &&
    record.amount > 0 &&
    typeof record.category === "string" &&
    EXPENSE_CATEGORIES.includes(
      record.category as (typeof EXPENSE_CATEGORIES)[number]
    ) &&
    typeof record.description === "string" &&
    record.description.trim().length > 0 &&
    record.description.length <= 200 &&
    typeof record.date === "string" &&
    isValidDate(record.date)
  );
}

function normalizeParsedExpenses(value: unknown): ParsedExpense[] | null {
  let candidates: unknown;
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "expenses" in value
  ) {
    candidates = value.expenses;
  } else if (Array.isArray(value)) {
    candidates = value;
  } else {
    candidates = [value];
  }

  if (
    !Array.isArray(candidates) ||
    candidates.length > 20 ||
    !candidates.every(isParsedExpense)
  ) {
    return null;
  }
  return candidates;
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI expense parsing is not configured on the server." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Enter an expense description to interpret." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Enter an expense description to interpret." },
      { status: 400 }
    );
  }

  const record = body as Record<string, unknown>;
  const input =
    typeof record.input === "string" ? record.input.trim() : "";
  const today = typeof record.today === "string" ? record.today : "";
  if (!input || input.length > 500 || !isValidDate(today)) {
    return NextResponse.json(
      {
        error: input.length > 500
          ? "Keep the expense description under 500 characters."
          : "Enter an expense description to interpret.",
      },
      { status: 400 }
    );
  }

  let groqResponse: Response;
  try {
    groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          temperature: 0,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "expense_entry",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  expenses: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        amount: { type: "number" },
                        category: {
                          type: "string",
                          enum: EXPENSE_CATEGORIES,
                        },
                        description: { type: "string" },
                        date: { type: "string" },
                      },
                      required: ["amount", "category", "description", "date"],
                    },
                  },
                },
                required: ["expenses"],
              },
            },
          },
          messages: [
            {
              role: "system",
              content: [
                "Convert the user's natural-language household expense into structured data.",
                "Identify every distinct expense explicitly described. A request may contain one or multiple expenses.",
                "Use only these exact categories: Groceries, Food, Transport, Shopping, Entertainment, Other.",
                "Use the merchant or specific item as description, not a generic category (for example Domino's, Netflix, Uber ride, Monitor).",
                `Interpret relative dates using this user's local current date: ${today}.`,
                "Use the supplied current date for expenses without an explicit date. Resolve today, yesterday, last night, and other relative dates using that date.",
                "Never invent an amount. If a distinct expense does not have a clearly stated amount, omit that expense. If no expense with a clear amount can be identified, return an empty expenses array.",
                'Return only data matching this JSON shape: {"expenses":[{"amount":number,"category":"Groceries|Food|Transport|Shopping|Entertainment|Other","description":"specific merchant or item","date":"YYYY-MM-DD"}]}.',
              ].join(" "),
            },
            { role: "user", content: input },
          ],
        }),
      }
    );
  } catch (error) {
    console.error(
      "Groq expense parsing request failed:",
      error instanceof Error ? error.message : "Unknown network error"
    );
    return NextResponse.json(
      { error: "The AI service could not be reached. Please try again." },
      { status: 502 }
    );
  }

  if (!groqResponse.ok) {
    let groqError: unknown;
    try {
      groqError = await groqResponse.json();
    } catch {
      groqError = null;
    }

    const errorRecord =
      typeof groqError === "object" &&
      groqError !== null &&
      "error" in groqError &&
      typeof groqError.error === "object" &&
      groqError.error !== null
        ? (groqError.error as Record<string, unknown>)
        : {};
    const safeDiagnostic = (value: unknown) =>
      typeof value === "string"
        ? value.replace(/[\r\n\t]/g, " ").slice(0, 400)
        : undefined;
    const type = safeDiagnostic(errorRecord.type);
    const code = safeDiagnostic(errorRecord.code);
    const param = safeDiagnostic(errorRecord.param);
    const requestId = groqResponse.headers.get("x-request-id");

    console.error("Groq expense parsing request was rejected:", {
      status: groqResponse.status,
      requestId,
      type,
      code,
      param,
    });

    const errorCode = code ?? type ?? "request_rejected";
    return NextResponse.json(
      {
        error:
          groqResponse.status === 401 || groqResponse.status === 403
            ? "Groq rejected its server credentials. Check the server-side GROQ_API_KEY configuration."
            : groqResponse.status === 429
              ? "Groq is temporarily rate limited or the account quota is unavailable. Try again later."
              : groqResponse.status === 400
                ? `Groq rejected the parsing request (${errorCode}). Check the server configuration.`
                : "Groq could not process the request. Please try again later.",
      },
      { status: 502 }
    );
  }

  let groqPayload: unknown;
  try {
    groqPayload = await groqResponse.json();
  } catch {
    console.error("Groq expense parsing returned invalid JSON.");
    return NextResponse.json(
      { error: "The AI service returned an invalid response. Please try again." },
      { status: 502 }
    );
  }

  if (typeof groqPayload !== "object" || groqPayload === null) {
    console.error("Groq expense parsing returned an unexpected response.");
    return NextResponse.json(
      { error: "The AI service returned an invalid response. Please try again." },
      { status: 502 }
    );
  }

  const choices = (groqPayload as { choices?: unknown }).choices;
  const firstChoice = Array.isArray(choices) ? choices[0] : undefined;
  const message =
    typeof firstChoice === "object" && firstChoice !== null
      ? (firstChoice as { message?: unknown }).message
      : undefined;
  const content =
    typeof message === "object" && message !== null
      ? (message as { content?: unknown }).content
      : undefined;

  if (typeof content !== "string") {
    console.error("Groq expense parsing response did not contain structured content.");
    return NextResponse.json(
      { error: "The AI could not interpret those details. Please add more information." },
      { status: 422 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("Groq expense parsing returned malformed JSON output.");
    return NextResponse.json(
      { error: "Groq returned invalid expense data. Try a clearer description." },
      { status: 422 }
    );
  }

  const parsedExpenses = normalizeParsedExpenses(parsed);
  if (parsedExpenses === null) {
    console.error("Groq expense parsing returned data outside the expected schema.");
    return NextResponse.json(
      { error: "The AI returned incomplete or invalid expense details. Try a clearer description." },
      { status: 422 }
    );
  }

  return NextResponse.json({
    expenses: parsedExpenses.map((expense) => ({
      ...expense,
      description: expense.description.trim(),
    })),
  });
}
