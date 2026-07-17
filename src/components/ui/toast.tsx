"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A tiny sonner-style toast system with zero dependencies.
 * Usage: import { toast } from "@/components/ui/toast" and call
 * toast("Saved", { description: "12 transactions imported" }).
 * <Toaster /> is mounted once in the root layout.
 */

export interface ToastOptions {
  description?: string;
  variant?: "default" | "success" | "error";
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  title: string;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let listeners: Listener[] = [];
let nextId = 1;

function emit() {
  for (const listener of listeners) listener([...toasts]);
}

export function toast(title: string, options: ToastOptions = {}) {
  const item: ToastItem = { id: nextId++, title, ...options };
  toasts = [...toasts, item].slice(-4);
  emit();
  const duration = options.durationMs ?? 5000;
  setTimeout(() => dismiss(item.id), duration);
  return item.id;
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            "pointer-events-auto animate-fade-in-up rounded-lg border bg-card p-4 shadow-lg",
            item.variant === "success" && "border-green-300",
            item.variant === "error" && "border-destructive"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={cn(
                  "text-sm font-semibold",
                  item.variant === "error" && "text-destructive"
                )}
              >
                {item.title}
              </p>
              {item.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
