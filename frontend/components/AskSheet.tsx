"use client";

/** Bottom sheet for the Ask action: recent documents with thumbnails; tapping one opens its Q&A page. */

import { useRouter } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { resolveMediaUrl } from "@/lib/api";
import type { DocumentSummary } from "@/types";

interface AskSheetProps {
  open: boolean;
  onClose: () => void;
  documents: DocumentSummary[];
  loaded: boolean;
}

export function AskSheet({ open, onClose, documents, loaded }: AskSheetProps) {
  const router = useRouter();

  return (
    <BottomSheet open={open} onClose={onClose} title="Ask about a document">
      {!loaded ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="skeleton-light h-16 rounded-3xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => {
            const ready = doc.status === "completed";
            return (
              <li key={doc.document_id}>
                <button
                  onClick={() => {
                    onClose();
                    router.push(ready ? `/query/${doc.document_id}` : `/document/${doc.document_id}`);
                  }}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-3xl bg-white/60 p-2 pr-4 text-left transition-colors hover:bg-white"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/5">
                    {doc.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveMediaUrl(doc.thumbnail_url)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <FileText className="h-5 w-5 text-ink-soft/50" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{doc.filename}</span>
                    <span className="block text-xs text-ink-soft">
                      {ready ? "Ready to ask" : doc.status === "failed" ? "Processing failed" : "Still processing…"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
