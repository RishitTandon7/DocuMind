"use client";

/**
 * Optimistic landing spot for uploads and finished scans. It appears the instant the user chooses files (or
 * taps Done), showing their own pictures straight away while the upload runs in the background. When the
 * server accepts the document this screen replaces itself with /document/[id]; if the upload fails the
 * user sees the reason with Retry — nothing is lost and there is never a blank screen.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, RotateCcw } from "lucide-react";

import { MeshGradient } from "@/components/MeshGradient";
import { usePendingUpload } from "@/components/providers/PendingUploadProvider";

export default function NewDocumentPage() {
  const router = useRouter();
  const { pending, retry, dismiss } = usePendingUpload();
  // Once we've told the router to open the real document, a later change to `pending` (the provider clears
  // it after a while) must not be mistaken for "nothing to show" and bounce the user to the landing page.
  const handedOver = useRef(false);

  useEffect(() => {
    if (handedOver.current) return;
    if (!pending) {
      router.replace("/");
    } else if (pending.status === "done" && pending.documentId) {
      handedOver.current = true;
      router.replace(`/document/${pending.documentId}`);
    }
  }, [pending, router]);

  if (!pending) return <main className="min-h-[100dvh]" />;

  const failed = pending.status === "error";
  const percent = Math.round(pending.progress * 100);
  const [first, ...rest] = pending.previews;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <MeshGradient />

      <header className="relative z-10 flex h-14 items-center px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          DocuMind
        </Link>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-2 sm:px-6 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-cream shadow-xl shadow-black/5"
        >
          {first ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={first} alt="Your document" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-soft">
              <FileText className="h-10 w-10" />
              <span className="text-sm font-medium">PDF</span>
            </div>
          )}
          {!failed && <div className="skeleton-light pointer-events-none absolute inset-0 opacity-40" />}
        </motion.div>

        {rest.length > 0 && (
          <div className="scrollbar-hide mt-3 flex w-full gap-2 overflow-x-auto">
            {[first, ...rest].map((url, index) => (
              <div
                key={index}
                className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream shadow-md shadow-black/5"
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <FileText className="h-4 w-4 text-ink-soft/50" />
                )}
              </div>
            ))}
          </div>
        )}

        {failed ? (
          <div className="mt-6 flex w-full max-w-md flex-col items-center gap-3 rounded-3xl bg-cream px-6 py-5 text-center shadow-lg shadow-black/5">
            <p className="text-base font-semibold text-ink">Upload didn&apos;t go through</p>
            <p className="text-sm text-ink-soft">{pending.error}</p>
            <div className="flex w-full gap-2">
              <button
                onClick={() => {
                  dismiss();
                  router.push("/");
                }}
                className="min-h-[44px] flex-1 rounded-full bg-black/5 px-4 text-sm font-semibold text-ink"
              >
                Discard
              </button>
              <button
                onClick={retry}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-cream"
              >
                <RotateCcw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex w-full max-w-md flex-col items-center gap-3">
            <p className="text-sm font-medium text-ink-soft">
              {pending.status === "done" ? "Opening your document…" : percent >= 100 ? "Starting…" : `Uploading ${percent}%`}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <motion.div
                className="h-full rounded-full bg-ink"
                animate={{ width: `${Math.max(4, percent)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 24 }}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
