"use client";

/**
 * App-wide toasts: a cream pill above the safe area with an optional action button (e.g. "Retry").
 * Every failure in the scanner flow surfaces here instead of failing silently.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "default" | "error";
  /** Milliseconds before auto-dismiss (default 3500, or 6000 with an action). */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions | string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);

  const toast = useCallback(
    (options: ToastOptions | string) => {
      const resolved = typeof options === "string" ? { message: options } : options;
      const id = nextId.current++;
      setItems((current) => [...current.slice(-2), { ...resolved, id }]);
      window.setTimeout(() => dismiss(id), resolved.duration ?? (resolved.actionLabel ? 6000 : 3500));
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              role="status"
              className={cn(
                "pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-ink py-2.5 pl-5 pr-3 text-sm font-medium text-cream shadow-xl shadow-black/20",
                item.tone === "error" && "bg-[#7a2a2a]"
              )}
            >
              <span className="min-w-0 flex-1">{item.message}</span>
              {item.actionLabel && (
                <button
                  onClick={() => {
                    item.onAction?.();
                    dismiss(item.id);
                  }}
                  className="min-h-[36px] shrink-0 rounded-full bg-cream px-4 text-xs font-semibold text-ink"
                >
                  {item.actionLabel}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
