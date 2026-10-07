"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { readApiResponse } from "../../lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  "How am I doing this month?",
  "Where is my money going?",
  "What was my biggest expense?",
  "How much did I spend on food?",
];

const FRIENDLY_ERROR =
  "I couldn't get an answer just now. Please try again in a moment.";

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-slate-950/50 px-1 py-0.5 font-mono text-[0.9em] text-indigo-100"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderMarkdown(content: string) {
  const lines = content.split(/\r?\n/);
  const rendered: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    rendered.push(
      <ul key={`list-${rendered.length}`} className="my-1 list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const listItem = trimmed.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    if (listItem) {
      listItems.push(listItem[1]);
      return;
    }
    flushList();
    if (!trimmed) return;
    rendered.push(
      <p key={`line-${index}`} className="my-1">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  });
  flushList();
  return rendered;
}

function getLocalDate() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function HouseholdAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (value: string) => {
    const question = value.trim();
    if (!question || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const conversation = [...messages, userMessage];
    setMessages(conversation);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.slice(-12).map(({ role, content }) => ({
            role,
            content,
          })),
          today: getLocalDate(),
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        }),
      });
      const result = await readApiResponse<{ answer: string }>(response);
      if (typeof result.answer !== "string" || !result.answer.trim()) {
        throw new Error(FRIENDLY_ERROR);
      }
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.answer.trim(),
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error && requestError.message
          ? requestError.message
          : FRIENDLY_ERROR
      );
    } finally {
      setLoading(false);
    }
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <section
      id="household-ai"
      aria-labelledby="household-ai-heading"
      className="relative mt-8 overflow-hidden rounded-[1.75rem] border border-indigo-300/20 bg-gradient-to-br from-[#1b2b49] via-[#151f35] to-[#111827] shadow-xl shadow-indigo-950/15"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
      />
      <div className="relative p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-indigo-300">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-indigo-200/20 bg-indigo-300/10 text-base"
              >
                ✦
              </span>
              Your household, understood
            </p>
            <h2
              id="household-ai-heading"
              className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            >
              Household AI
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Your personal finance assistant
            </p>
          </div>
          <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-200">
            Reads expenses, bills &amp; budget · Nothing is changed
          </span>
        </div>

        <div
          aria-label="Conversation"
          aria-live="polite"
          className="mt-6 flex h-[22rem] flex-col gap-4 overflow-y-auto rounded-2xl border border-white/[0.07] bg-slate-950/30 p-4 sm:h-[26rem] sm:p-5"
        >
          {messages.length === 0 ? (
            <div className="my-auto">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-400/10 text-xl text-indigo-200">
                ✦
              </div>
              <p className="mt-4 text-center text-sm font-semibold text-white">
                What would you like to know?
              </p>
              <p className="mt-1 text-center text-sm text-slate-400">
                Ask about your real household spending.
              </p>
              <div className="mx-auto mt-5 grid max-w-2xl gap-2 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(question)}
                    disabled={loading}
                    className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3 text-left text-sm text-slate-200 transition hover:border-indigo-300/30 hover:bg-indigo-300/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[78%] ${
                    message.role === "user"
                      ? "rounded-br-md border border-indigo-300/20 bg-indigo-500/20 text-indigo-50"
                      : "rounded-bl-md border border-white/[0.08] bg-[#1b2638] text-slate-100"
                  }`}
                >
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    {message.role === "user" ? "You" : "Household AI"}
                  </p>
                  <div className="text-sm leading-6">
                    {renderMarkdown(message.content)}
                  </div>
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start" role="status" aria-label="Household AI is thinking">
              <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-white/[0.08] bg-[#1b2638] px-4 py-3 text-sm text-slate-300">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-300" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-300 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-300 [animation-delay:300ms]" />
                </span>
                Looking through your expenses…
              </div>
            </div>
          )}
          <div ref={conversationEndRef} />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </p>
        )}

        <form onSubmit={submitMessage} className="mt-4 flex items-end gap-2 sm:gap-3">
          <label htmlFor="household-ai-input" className="sr-only">
            Ask Household AI about your spending
          </label>
          <textarea
            id="household-ai-input"
            rows={1}
            maxLength={1200}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask about your household spending…"
            className="dashboard-dark-field min-h-12 flex-1 resize-none rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-500 focus:border-indigo-300/60 focus:outline-none focus:ring-4 focus:ring-indigo-300/10"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-200/20 bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-950/25 transition hover:from-indigo-400 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300/20 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:px-5"
          >
            <span className="hidden text-sm font-semibold sm:inline">Send</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-5 w-5 sm:hidden"
            >
              <path
                d="M3 10h13m-5-5 5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </section>
  );
}
