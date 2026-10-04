"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Send } from "lucide-react";

import { MeshGradient } from "@/components/MeshGradient";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { ApiError, submitQuery } from "@/lib/api";
import { cn, formatPercent } from "@/lib/utils";
import type { QueryResponse } from "@/types";

interface QueryTurn {
  id: string;
  result: QueryResponse;
}

function StreamingAnswer({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <p className="text-xl leading-relaxed text-ink sm:text-2xl">
      {words.map((word, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: index * 0.02 }}
          className="mr-[0.28em] inline-block"
        >
          {word}
        </motion.span>
      ))}
    </p>
  );
}

function ConfidenceDetails({ result }: { result: QueryResponse }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-[32px] items-center gap-1 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
      >
        Details
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-black/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.confidence * 100}%` }}
                    transition={{ type: "spring", stiffness: 140, damping: 18 }}
                    className="h-full rounded-full bg-gradient-to-r from-mint to-peach"
                  />
                </div>
                <span className="text-xs font-medium text-ink-soft">
                  {formatPercent(result.confidence)} confidence
                </span>
              </div>
              <span className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-ink-soft shadow-sm shadow-black/5">
                {result.retrieval_strategy} retrieval
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SourceChips({ result }: { result: QueryResponse }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (result.sources.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
        {result.sources.map((source, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.4 + index * 0.06 }}
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            className={cn(
              "min-h-[36px] shrink-0 snap-start rounded-full bg-cream px-4 py-2 text-xs font-medium text-ink-soft shadow-sm shadow-black/5 transition-colors",
              expandedIndex === index && "bg-ink text-cream"
            )}
          >
            Source {index + 1} · {source.source_type}
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {expandedIndex !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="mt-3 rounded-3xl bg-cream p-4 text-sm leading-relaxed text-ink-soft shadow-sm shadow-black/5">
              {result.sources[expandedIndex].content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function QueryPage() {
  const params = useParams();
  const id = params.id as string;
  return (
    <Suspense fallback={null}>
      <QueryPageContent documentId={id} />
    </Suspense>
  );
}

function QueryPageContent({ documentId }: { documentId: string }) {
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const [question, setQuestion] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<QueryTurn[]>([]);
  const autoSubmitted = useRef(false);

  const ask = async (text: string) => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitQuery(text.trim(), documentId);
      setTurns((previous) => [{ id: crypto.randomUUID(), result }, ...previous]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to get an answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const prefill = searchParams.get("q");
    if (prefill && !autoSubmitted.current) {
      autoSubmitted.current = true;
      ask(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    ask(question);
  };

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-cream">
      <MeshGradient className="opacity-60" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 pb-28 pt-6 sm:px-6 sm:pt-10">
        <Link
          href={`/document/${documentId}`}
          className="mb-8 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to document
        </Link>

        {!isMobile && (
          <form onSubmit={handleSubmit} className="mb-10">
            <FloatingInput
              value={question}
              onChange={setQuestion}
              isFocused={isFocused}
              setIsFocused={setIsFocused}
              disabled={isSubmitting}
            />
          </form>
        )}

        {error && <p className="mb-6 text-sm text-error">{error}</p>}

        <div className="flex-1 space-y-12">
          {turns.map((turn) => (
            <motion.div
              key={turn.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              <p className="mb-3 text-sm font-semibold text-ink-soft">{turn.result.question}</p>
              <StreamingAnswer text={turn.result.answer} />
              <ConfidenceDetails result={turn.result} />
              <SourceChips result={turn.result} />
            </motion.div>
          ))}

          {turns.length === 0 && !isSubmitting && (
            <p className="pt-16 text-center text-sm text-ink-soft/70">Ask a question to get started.</p>
          )}
        </div>

        {isMobile && (
          <form
            onSubmit={handleSubmit}
            className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          >
            <FloatingInput
              value={question}
              onChange={setQuestion}
              isFocused={isFocused}
              setIsFocused={setIsFocused}
              disabled={isSubmitting}
            />
          </form>
        )}
      </div>
    </main>
  );
}

interface FloatingInputProps {
  value: string;
  onChange: (value: string) => void;
  isFocused: boolean;
  setIsFocused: (value: boolean) => void;
  disabled: boolean;
}

function FloatingInput({ value, onChange, isFocused, setIsFocused, disabled }: FloatingInputProps) {
  const hasContent = value.length > 0;

  return (
    <motion.div
      animate={{ scale: isFocused ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={cn(
        "relative flex items-center gap-2 rounded-full bg-cream py-2 pl-6 pr-2 shadow-lg shadow-black/10 transition-shadow",
        isFocused && "ring-2 ring-accent/50"
      )}
    >
      <div className="relative flex-1">
        <motion.span
          animate={{
            y: isFocused || hasContent ? -18 : 0,
            scale: isFocused || hasContent ? 0.75 : 1,
            opacity: isFocused || hasContent ? 0.6 : 1,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 origin-left text-sm text-ink-soft"
        >
          Ask anything about this document…
        </motion.span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          className="min-h-[44px] w-full bg-transparent pt-2 text-sm text-ink focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Ask"
        className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-ink text-cream transition-transform active:scale-90 disabled:opacity-40"
      >
        <Send className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
