"use client";

/**
 * The quiet "Recent documents" row under the actions: 96px cream thumbnail chips in a horizontal snap
 * scroller (padding + scroll-padding so nothing clips at either edge, scrollbar hidden), filenames trimmed to
 * 14 characters, and a "See all" chip at the end. Hidden entirely when there are no documents.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, LayoutGrid } from "lucide-react";

import { resolveMediaUrl } from "@/lib/api";
import type { DocumentSummary } from "@/types";

const MAX_NAME_LENGTH = 14;

function trimName(name: string): string {
  return name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH)}…` : name;
}

export function RecentDocuments({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      aria-label="Recent documents"
      className="flex w-full max-w-2xl flex-col gap-2"
    >
      <p className="px-4 text-xs font-medium text-ink-soft/70">Recent documents</p>
      <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:justify-center">
        {documents.map((doc, index) => (
          <motion.div
            key={doc.document_id}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 + index * 0.04, type: "spring", stiffness: 260, damping: 24 }}
            className="snap-start"
          >
            <Link
              href={`/document/${doc.document_id}`}
              className="flex w-[112px] shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-cream p-2 shadow-md shadow-black/5"
            >
              <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-black/5">
                {doc.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveMediaUrl(doc.thumbnail_url)}
                    alt={doc.filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FileText className="h-6 w-6 text-ink-soft/50" />
                )}
              </span>
              <span className="w-full text-center text-[11px] text-ink-soft" title={doc.filename}>
                {trimName(doc.filename)}
              </span>
            </Link>
          </motion.div>
        ))}

        <div className="snap-start">
          <Link
            href="/documents"
            className="flex h-full w-[112px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-cream/70 p-2 text-ink-soft shadow-md shadow-black/5"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5">
              <LayoutGrid className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-semibold">See all</span>
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
