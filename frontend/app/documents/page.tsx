"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Edit2,
  FileText,
  Grid3X3,
  LayoutList,
  Loader2,
  MoreHorizontal,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";

import { MeshGradient } from "@/components/MeshGradient";
import { HamburgerButton } from "@/components/HamburgerButton";
import { SideNav } from "@/components/SideNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { deleteDocument, listAllDocuments, renameDocument, resolveMediaUrl } from "@/lib/api";
import { useToast } from "@/components/providers/ToastProvider";
import type { DocumentLibraryItem, DocumentStatus, PaginationMeta } from "@/types";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list";

const PROCESSING_STATUSES: DocumentStatus[] = [
  "uploaded",
  "processing_dip",
  "processing_ocr",
  "processing_understanding",
  "processing_graph",
  "processing_embeddings",
];

function statusColor(status: DocumentStatus): string {
  if (status === "completed") return "bg-green-500";
  if (status === "failed") return "bg-red-500";
  return "bg-amber-400";
}

function statusLabel(status: DocumentStatus): string {
  if (status === "completed") return "Done";
  if (status === "failed") return "Failed";
  return "Processing";
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ──────────────────────────────────────────────────────────────────────────────
// Inline rename input
// ──────────────────────────────────────────────────────────────────────────────

function RenameInput({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.select();
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSave(value.trim());
      }}
      className="flex gap-1"
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 text-xs px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400/60 min-w-0"
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <button type="submit" className="px-2 py-1 rounded-lg bg-amber-500 text-white text-xs font-medium">Save</button>
      <button type="button" onClick={onCancel} className="px-2 py-1 rounded-lg bg-black/5 text-xs">Cancel</button>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────

export default function DocumentsLibraryPage() {
  const { toast } = useToast();

  const [documents, setDocuments] = useState<DocumentLibraryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [overflowId, setOverflowId] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listAllDocuments(page, 20);
      setDocuments(result.documents);
      setPagination(result.pagination);
    } catch {
      setDocuments([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ── Pull to refresh ───────────────────────────────────────────────────────
  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
    onRefresh: fetchDocuments,
  });

  // ── Rename ────────────────────────────────────────────────────────────────
  const handleRename = async (doc: DocumentLibraryItem, newName: string) => {
    try {
      await renameDocument(doc.document_id, newName);
      setDocuments((prev) =>
        prev.map((d) => (d.document_id === doc.document_id ? { ...d, filename: newName } : d))
      );
      toast({ message: "Renamed successfully" });
    } catch {
      toast({ message: "Failed to rename document", tone: "error" });
    } finally {
      setRenamingId(null);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (doc: DocumentLibraryItem) => {
    setDeletingId(doc.document_id);
    try {
      await deleteDocument(doc.document_id);
      setDocuments((prev) => prev.filter((d) => d.document_id !== doc.document_id));
      toast({ message: "Document deleted" });
    } catch {
      toast({ message: "Failed to delete document", tone: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden">
      <MeshGradient />
      <SideNav />

      {/* Pull to refresh indicator */}
      <div ref={containerRef as React.RefObject<HTMLDivElement>}>
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
        />

        {/* Header */}
        <header className="relative z-10 flex items-center gap-3 px-4 pb-4 pt-[max(env(safe-area-inset-top),20px)] sm:px-8 sm:pt-8">
          <HamburgerButton />

          <div className="flex-1">
            <h1 className="text-xl font-extrabold tracking-tight text-ink">Your Library</h1>
            {pagination && (
              <p className="text-xs text-ink/40 mt-0.5">
                {pagination.total_count} document{pagination.total_count !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                viewMode === "grid" ? "bg-ink text-cream shadow-md" : "bg-white/60 text-ink/50 hover:text-ink"
              }`}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                viewMode === "list" ? "bg-ink text-cream shadow-md" : "bg-white/60 text-ink/50 hover:text-ink"
              }`}
              aria-label="List view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={fetchDocuments}
              disabled={isRefreshing}
              aria-label="Refresh"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-ink/50 hover:text-ink transition-colors"
            >
              <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 pb-20">
          {/* Global search with filter popup */}
          <div className="mb-6">
            <GlobalSearch />
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-ink/30" />
            </div>
          ) : documents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 rounded-4xl bg-white/60 backdrop-blur-sm px-8 py-20 text-center shadow-xl shadow-black/5"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/5">
                <FileText className="h-7 w-7 text-ink/30" />
              </div>
              <p className="text-lg font-semibold text-ink">No documents yet</p>
              <p className="max-w-sm text-sm text-ink/50">Upload your first document to get started.</p>
              <Link
                href="/"
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-lg"
              >
                <ArrowUp className="h-4 w-4" />
                Upload a document
              </Link>
            </motion.div>
          ) : viewMode === "grid" ? (
            /* ── GRID VIEW ──────────────────────────────────────────────── */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              <AnimatePresence mode="popLayout">
                {documents.map((doc, i) => (
                  <motion.div
                    key={doc.document_id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.025, type: "spring", stiffness: 260, damping: 24 }}
                    className="group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-md shadow-black/5 border border-black/5"
                  >
                    <Link href={`/document/${doc.document_id}`} className="block">
                      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-black/5 sm:h-40">
                        {doc.thumbnail_url ? (
                          <img
                            src={resolveMediaUrl(doc.thumbnail_url)}
                            alt={doc.filename}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <FileText className="h-8 w-8 text-ink/20" />
                        )}
                        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-ink backdrop-blur-sm">
                          <span className={`h-1.5 w-1.5 rounded-full ${statusColor(doc.status)}`} />
                          {statusLabel(doc.status)}
                        </div>
                      </div>
                    </Link>

                    <div className="flex flex-col gap-0.5 p-2.5">
                      {renamingId === doc.document_id ? (
                        <RenameInput
                          initialValue={doc.filename}
                          onSave={(v) => handleRename(doc, v)}
                          onCancel={() => setRenamingId(null)}
                        />
                      ) : (
                        <span className="truncate text-xs font-semibold text-ink">{doc.filename}</span>
                      )}
                      <span className="text-[10px] text-ink/40">{relativeTime(doc.upload_time)}</span>
                    </div>

                    {/* Inline action buttons — always visible */}
                    <div className="flex items-center gap-0.5 px-2 pb-2">
                      <button
                        id={`rename-${doc.document_id}`}
                        onClick={() => setRenamingId(doc.document_id)}
                        title="Rename"
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] text-ink/50 hover:bg-amber-50 hover:text-amber-700 border border-transparent hover:border-amber-200 transition-all"
                      >
                        <Edit2 className="w-3 h-3" />
                        Rename
                      </button>
                      <button
                        id={`delete-${doc.document_id}`}
                        onClick={() => handleDelete(doc)}
                        disabled={deletingId === doc.document_id}
                        title="Delete"
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] text-ink/50 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 transition-all disabled:opacity-40"
                      >
                        {deletingId === doc.document_id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Delete
                      </button>
                      <button
                        id={`more-${doc.document_id}`}
                        onClick={() => setOverflowId((p) => (p === doc.document_id ? null : doc.document_id))}
                        title="More options"
                        className="p-1.5 rounded-lg text-ink/30 hover:bg-black/5 hover:text-ink/60 transition-colors"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* ── LIST VIEW ──────────────────────────────────────────────── */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {documents.map((doc, i) => (
                  <motion.div
                    key={doc.document_id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ delay: i * 0.02, type: "spring", stiffness: 300, damping: 26 }}
                    className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur-sm px-3 py-2.5 shadow-md shadow-black/5 border border-black/5"
                  >
                    {/* Thumbnail */}
                    <Link href={`/document/${doc.document_id}`} className="shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-black/5">
                        {doc.thumbnail_url ? (
                          <img
                            src={resolveMediaUrl(doc.thumbnail_url)}
                            alt={doc.filename}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FileText className="h-5 w-5 text-ink/20" />
                        )}
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      {renamingId === doc.document_id ? (
                        <RenameInput
                          initialValue={doc.filename}
                          onSave={(v) => handleRename(doc, v)}
                          onCancel={() => setRenamingId(null)}
                        />
                      ) : (
                        <span className="truncate text-sm font-semibold text-ink">{doc.filename}</span>
                      )}
                      <span className="text-[11px] text-ink/40">
                        {relativeTime(doc.upload_time)}
                        {doc.word_count != null && doc.word_count > 0 && ` · ${doc.word_count} words`}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold text-ink shrink-0">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusColor(doc.status)}`} />
                      {statusLabel(doc.status)}
                    </div>

                    {/* Inline actions — always visible */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        id={`rename-list-${doc.document_id}`}
                        onClick={() => setRenamingId(doc.document_id)}
                        title="Rename"
                        className="p-2 rounded-xl text-ink/40 hover:bg-amber-50 hover:text-amber-600 border border-transparent hover:border-amber-200 transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`delete-list-${doc.document_id}`}
                        onClick={() => handleDelete(doc)}
                        disabled={deletingId === doc.document_id}
                        title="Delete"
                        className="p-2 rounded-xl text-ink/40 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 transition-all disabled:opacity-40"
                      >
                        {deletingId === doc.document_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        id={`more-list-${doc.document_id}`}
                        title="More options"
                        className="p-2 rounded-xl text-ink/30 hover:bg-black/5 transition-colors"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex items-center justify-center gap-3"
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[80px] text-center text-sm font-semibold text-ink">
                {page} of {pagination.total_pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </main>
  );
}
