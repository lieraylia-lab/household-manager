import { NextResponse } from "next/server";
import {
  getExpenses,
  isGetExpensesArguments,
} from "../../../../lib/ai/expense-tools";
import {
  getBills,
  getBudget,
  isGetBillsArguments,
  isGetBudgetArguments,
} from "../../../../lib/ai/finance-tools";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/authenticated";

const MODEL = "openai/gpt-oss-20b";
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_LENGTH = 8000;
const MAX_TOOL_CALLS = 3;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ToolCall = {
  id: string;
  name: "getExpenses" | "getBills" | "getBudget";
  arguments: string;
};

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseHistory(value: unknown): ChatMessage[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_HISTORY_MESSAGES
  ) {
    return null;
  }

  let totalLength = 0;
  const messages: ChatMessage[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return null;
    }
    const message = entry as Record<string, unknown>;
    if (
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > MAX_MESSAGE_LENGTH
    ) {
      return null;
    }
    totalLength += message.content.length;
    if (totalLength > MAX_HISTORY_LENGTH) return null;
    messages.push({
      role: message.role,
      content: message.content.trim(),
    });
  }

  return messages[messages.length - 1]?.role === "user" ? messages : null;
}

function getToolCalls(message: unknown): ToolCall[] | null {
  if (typeof message !== "object" || message === null) return null;
  const rawCalls = (message as { tool_calls?: unknown }).tool_calls;
  if (rawCalls === undefined) return [];
  if (!Array.isArray(rawCalls) || rawCalls.length > MAX_TOOL_CALLS) return null;

  const calls: ToolCall[] = [];
  for (const rawCall of rawCalls) {
    if (typeof rawCall !== "object" || rawCall === null) return null;
    const call = rawCall as Record<string, unknown>;
    const fn = call.function;
    if (typeof fn !== "object" || fn === null) return null;
    const fnRecord = fn as Record<string, unknown>;
    if (
      typeof call.id !== "string" ||
      (fnRecord.name !== "getExpenses" &&
        fnRecord.name !== "getBills" &&
        fnRecord.name !== "getBudget") ||
      typeof fnRecord.arguments !== "string"
    ) {
      return null;
    }
    calls.push({
      id: call.id,
      name: fnRecord.name,
      arguments: fnRecord.arguments,
    });
  }
  return calls;
}

function getChoiceMessage(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const choice = choices[0];
  if (typeof choice !== "object" || choice === null) return null;
  const message = (choice as { message?: unknown }).message;
  return typeof message === "object" && message !== null ? message : null;
}

function normalizeMarkdown(answer: string) {
  return answer
    .replace(/&#x20;|&#32;|&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\\([*_`])/g, "$1")
    .trim();
}

function hasUnambiguousPaidContext(messages: ChatMessage[]) {
  const priorUserMessages = messages
    .slice(0, -1)
    .filter((message) => message.role === "user")
    .reverse();
  for (const message of priorUserMessages) {
    const text = message.content.toLowerCase();
    if (/\b(bills?|payments?|unpaid|owe|due)\b/.test(text)) return true;
    if (
      /\b(spend|spent|expenses?|purchases?|groceries|food|transport|shopping)\b/.test(
        text
      )
    ) {
      return true;
    }
  }
  return false;
}

const tools = [
  {
    type: "function",
    function: {
      name: "getExpenses",
      description:
        "Read authenticated-user expenses, totals, categories, and largest expenses. Use for spending questions, not bills or budget questions. 'Bills' is never an expense category. Preserve category and intent from follow-ups.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          period: {
            type: "string",
            enum: [
              "today",
              "yesterday",
              "this_week",
              "this_month",
              "last_month",
              "specific_date",
              "all_time",
            ],
          },
          category: {
            type: "string",
            enum: [
              "all",
              "Groceries",
              "Food",
              "Transport",
              "Shopping",
              "Entertainment",
              "Other",
            ],
          },
          sort_by: { type: "string", enum: ["largest", "recent"] },
          date: { type: "string" },
        },
        required: ["period", "category", "sort_by", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getBills",
      description:
        "Read the authenticated user's bills, totals, paid/unpaid status and due dates. Use for bill, payment, owe, due, paid-bill, or unpaid-bill questions. Do not treat 'bills' as an expense category. Bills have due dates and a current paid flag, but no payment date.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          period: {
            type: "string",
            enum: [
              "today",
              "yesterday",
              "this_week",
              "this_month",
              "last_month",
              "specific_date",
              "all_time",
            ],
          },
          status: { type: "string", enum: ["all", "paid", "unpaid"] },
          date: { type: "string" },
        },
        required: ["period", "status", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getBudget",
      description:
        "Read the authenticated user's monthly budget, regular expenses, paid bills, total consumed, remaining amount, and unpaid bill summary for the current or previous month. Remaining is budget minus expenses minus paid bills. Unpaid bills are not deducted. Use for budget and amount-left questions. This tool never changes a budget.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { month: { type: "string", enum: ["current", "previous"] } },
        required: ["month"],
      },
    },
  },
];

function systemPrompt(today: string) {
  return [
    "You are Household AI, a concise, warm, practical household-finance assistant.",
    "Use only the read-only tool data for personal financial facts. Never invent or estimate amounts, bills, categories, dates, budgets, or counts.",
    `The user's local date is ${today}. Interpret relative dates from this date. The tools support today, yesterday, this week (Monday through Sunday), this month, last month, a specific calendar date, or all time.`,
    "Intent routing: expenses/spending/purchases and expense categories use getExpenses. Bills, bills paid, unpaid, due, payment, or owing use getBills. Budget, how much can I spend, left to spend, or over budget use getBudget. 'Bills' is a separate concept, never an expense category.",
    "If a question says only 'how much have I paid' and there is no clear bill/expense context in conversation, do not call a tool; ask briefly: 'Do you mean bills you've paid or your recorded expenses?' Use prior turns to resolve follow-ups such as 'how many?' or 'what about last month?'.",
    "For broad questions that genuinely need separate data (such as how the user is doing this month), call the relevant tools, including expenses and budget. You may call multiple tools when needed.",
    "Use a sensible period default: this month for expense spending; all time for current paid/unpaid bill status and total bills; current month for budget. For 'what bills are due?' default to unpaid bills due this month.",
    "Bills only store a current paid/unpaid flag and due date, not when payment occurred. Never claim bills were paid during a particular time period. When asked about bills paid for a period, explain that the available data shows their current paid status and filter only by due date when a period is specified.",
    "For budget answers, use getBudget.remaining or compute only budget minus spent minus paidBills. unpaidBills are not deducted. Never add paid bills to the separate expense total; the tables represent separate types of records.",
    "Use exact tool totals and counts. If complete is false, say the results are incomplete and do not present partial amounts as exact.",
    "For a category with no expense results, answer in this concise style: '**Food: ₹0 this month.** You haven't recorded any Food expenses yet.' Use the requested category and exact period. Do not say the user has no expenses generally or repeat the same fact.",
    "For no paid bills say there are no bills currently marked paid in the requested scope. For no unpaid bills say there are no unpaid bills in that scope. When bill results are empty, do not mention expenses.",
    "For biggest expenses, never use a generic name such as 'expense'. If largestExpense.name is null or generic, omit any merchant/name and state only amount and category (and date if useful); never invent a merchant.",
    "For no saved budget, say no budget has been set for that month. Do not present remaining amount as known when budget is unset.",
    "Format money in Indian Rupees (₹) with Indian grouping. Match every period to the tool's period and periodStartDate fields; do not infer or substitute a different month/year. Answer naturally and concisely, usually one bold lead sentence with a short supporting line only when useful. Use simple Markdown, no raw HTML, HTML entities, escaped Markdown, repetitive headings, or database-style labels.",
    "Distinguish calculated facts from advice. Label general advice as a suggestion and do not add unsupported claims. Do not claim data was changed or saved.",
  ].join(" ");
}

async function callGroq(
  apiKey: string,
  messages: Array<Record<string, unknown>>,
  useTools: boolean
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(
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
          model: MODEL,
          temperature: 0.2,
          messages,
          ...(useTools
            ? { tools, tool_choice: "auto", parallel_tool_calls: true }
            : { tool_choice: "none" }),
        }),
      }
    );
    if (response.ok) return response.json() as Promise<unknown>;

    const retryAfter = Number(response.headers.get("retry-after"));
    console.error("Household AI provider request failed:", {
      status: response.status,
      requestId: response.headers.get("x-request-id"),
    });
    if (response.status === 429 && attempt === 0) {
      const retryDelay = Number.isFinite(retryAfter)
        ? Math.min(Math.max(retryAfter, 1), 5) * 1000
        : 2_000;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      continue;
    }
    throw new Error(response.status === 429 ? "rate_limited" : "provider");
  }
  throw new Error("provider");
}

async function executeTool(
  call: ToolCall,
  auth: Extract<
    Awaited<ReturnType<typeof getAuthenticatedSupabase>>,
    { supabase: unknown }
  >,
  today: string,
  timezoneOffsetMinutes: number
) {
  let args: unknown;
  try {
    args = JSON.parse(call.arguments);
  } catch {
    throw new Error("invalid_tool_arguments");
  }

  if (call.name === "getExpenses" && isGetExpensesArguments(args)) {
    return {
      name: call.name,
      data: await getExpenses(
        auth.supabase,
        auth.userId,
        args,
        today,
        timezoneOffsetMinutes
      ),
    };
  }
  if (call.name === "getBills" && isGetBillsArguments(args)) {
    return {
      name: call.name,
      data: await getBills(
        auth.supabase,
        auth.userId,
        args,
        today,
        timezoneOffsetMinutes
      ),
    };
  }
  if (call.name === "getBudget" && isGetBudgetArguments(args)) {
    return {
      name: call.name,
      data: await getBudget(
        auth.supabase,
        auth.userId,
        args.month,
        today,
        timezoneOffsetMinutes
      ),
    };
  }
  throw new Error("invalid_tool_arguments");
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if ("response" in auth) return auth.response;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Household AI is not configured right now." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Send a question to Household AI." },
      { status: 400 }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Send a question to Household AI." },
      { status: 400 }
    );
  }

  const record = body as Record<string, unknown>;
  const messages = parseHistory(record.messages);
  const today = record.today;
  const timezoneOffsetMinutes = record.timezoneOffsetMinutes;
  if (
    !messages ||
    !isValidDate(today) ||
    typeof timezoneOffsetMinutes !== "number" ||
    !Number.isInteger(timezoneOffsetMinutes) ||
    Math.abs(timezoneOffsetMinutes) > 840
  ) {
    return NextResponse.json(
      { error: "Your message could not be processed. Please try again." },
      { status: 400 }
    );
  }

  const latestQuestion = messages[messages.length - 1].content
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .trim();
  if (
    /^how much (?:have i paid|did i pay|have i pay)(?: so far)?$/.test(
      latestQuestion
    ) &&
    !hasUnambiguousPaidContext(messages)
  ) {
    return NextResponse.json({
      answer: "Do you mean bills you've paid or your recorded expenses?",
    });
  }

  const systemMessage = {
    role: "system",
    content: systemPrompt(today),
  };
  let firstPayload: unknown;
  try {
    firstPayload = await callGroq(apiKey, [systemMessage, ...messages], true);
  } catch (error) {
    console.error("Household AI initial request failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "rate_limited"
            ? "Household AI is busy right now. Please wait a moment and try again."
            : "Household AI is temporarily unavailable. Please try again.",
      },
      { status: error instanceof Error && error.message === "rate_limited" ? 429 : 502 }
    );
  }

  const firstMessage = getChoiceMessage(firstPayload);
  const toolCalls = getToolCalls(firstMessage);
  if (!firstMessage || !toolCalls) {
    console.error("Household AI returned a malformed tool-selection response.");
    return NextResponse.json(
      { error: "Household AI returned an invalid response. Please try again." },
      { status: 502 }
    );
  }

  if (toolCalls.length === 0) {
    const content = (firstMessage as { content?: unknown }).content;
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Household AI couldn't form a clear answer. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ answer: normalizeMarkdown(content) });
  }

  let toolResults: Array<{ name: string; data: unknown }>;
  try {
    toolResults = [];
    for (const call of toolCalls) {
      toolResults.push(
        await executeTool(call, auth, today, timezoneOffsetMinutes)
      );
    }
  } catch (error) {
    console.error("Household AI controlled data lookup failed:", error);
    const message =
      error instanceof Error && error.message === "invalid_tool_arguments"
        ? "Household AI returned an invalid data request."
        : "I couldn't load the requested household data right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const toolMessages = toolResults.map((result, index) => ({
    role: "tool",
    tool_call_id: toolCalls[index].id,
    name: result.name,
    content: JSON.stringify(result.data),
  }));
  let answerPayload: unknown;
  try {
    answerPayload = await callGroq(
      apiKey,
      [
        systemMessage,
        ...messages,
        {
          role: "assistant",
          content:
            typeof (firstMessage as { content?: unknown }).content === "string"
              ? (firstMessage as { content: string }).content
              : null,
          tool_calls: toolCalls.map((call) => ({
            id: call.id,
            type: "function",
            function: {
              name: call.name,
              arguments: call.arguments,
            },
          })),
        },
        ...toolMessages,
      ],
      false
    );
  } catch (error) {
    console.error("Household AI answer request failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "rate_limited"
            ? "Household AI is busy right now. Please wait a moment and try again."
            : "Household AI couldn't finish the answer. Please try again.",
      },
      { status: error instanceof Error && error.message === "rate_limited" ? 429 : 502 }
    );
  }

  const answerMessage = getChoiceMessage(answerPayload);
  const answerContent =
    answerMessage && (answerMessage as { content?: unknown }).content;
  if (typeof answerContent !== "string" || !answerContent.trim()) {
    console.error("Household AI returned an empty or malformed answer.");
    return NextResponse.json(
      { error: "Household AI couldn't form a clear answer. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ answer: normalizeMarkdown(answerContent) });
}
