"use client";

import * as React from "react";
import { useChat } from "ai/react";
import { Bot, Database, SendHorizonal, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const STARTER_QUESTIONS = [
  "How much did I spend on takeaways last month?",
  "What are my recurring subscriptions?",
  "Compare this month's spending to last month",
  "What is my biggest avoidable expense?",
];

const TOOL_LABELS: Record<string, string> = {
  getCategorySummary: "Summarising a month",
  getTransactions: "Fetching transactions",
  findRecurringPayments: "Scanning for subscriptions",
  compareSpending: "Comparing two months",
};

/**
 * Models often reply with light markdown. Render the common inline parts
 * (**bold** and `code`) and turn heading markers into bold lines, without
 * pulling in a full markdown library. Text is rendered as React nodes, never
 * as HTML, so model output cannot inject markup.
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const cleaned = text.replace(/^#{1,6}\s+(.+)$/gm, "**$1**");
  return cleaned.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded bg-background/60 px-1 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function ChatPanel() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    append,
  } = useChat({
    api: "/api/chat",
    onError: (error) => {
      // The API route returns a short plain-text reason on failure.
      const reason =
        error.message && error.message.length < 200 ? error.message : null;
      toast("Chat error", {
        description:
          reason ??
          "MoneyMate could not respond. Check your connection and try again.",
        variant: "error",
      });
    },
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  const lastMessage = messages[messages.length - 1];
  const showThinking =
    isLoading &&
    (!lastMessage ||
      lastMessage.role !== "assistant" ||
      lastMessage.content.length === 0);

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[420px] flex-col rounded-lg border bg-card shadow-sm">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Bot className="h-10 w-10 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Ask MoneyMate anything about your money</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Answers come straight from your own transactions, never made-up
                numbers.
              </p>
            </div>
            <div className="flex max-w-md flex-wrap justify-center gap-2">
              {STARTER_QUESTIONS.map((question) => (
                <button
                  key={question}
                  onClick={() => append({ role: "user", content: question })}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs transition-colors hover:border-primary/50 hover:bg-accent sm:text-sm"
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
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role !== "user" ? (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
                  <Bot className="h-4 w-4 text-primary" aria-hidden />
                </span>
              ) : null}
              <div
                className={cn(
                  "max-w-[85%] space-y-2 sm:max-w-[70%]",
                  message.role === "user" && "order-first sm:order-none"
                )}
              >
                {message.toolInvocations?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {message.toolInvocations.map((invocation) => (
                      <span
                        key={invocation.toolCallId}
                        className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        <Database className="h-3 w-3" aria-hidden />
                        {TOOL_LABELS[invocation.toolName] ?? invocation.toolName}
                        {invocation.state !== "result" ? "..." : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
                {message.content ? (
                  <div
                    className={cn(
                      "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      message.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted"
                    )}
                  >
                    {message.role === "user"
                      ? message.content
                      : renderInlineMarkdown(message.content)}
                  </div>
                ) : null}
              </div>
              {message.role === "user" ? (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" aria-hidden />
                </span>
              ) : null}
            </div>
          ))
        )}

        {showThinking ? (
          <div className="flex gap-3">
            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
              <Bot className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground" />
              <span
                className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t p-3"
      >
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="e.g. How much did I spend on groceries in June?"
          aria-label="Message MoneyMate"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <SendHorizonal className="h-4 w-4" aria-hidden />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
