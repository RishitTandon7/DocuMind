"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  ChevronDown,
  FileSearch,
  FileText,
  Filter,
  Loader2,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { listAllDocuments, submitQuery } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/api";
import type { DocumentLibraryItem, QuerySource } from "@/types";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type SearchMode = "filename" | "content";

interface ContentHit {
  documentId: string;
  filename: string;
  snippet: string;
  score: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Highlight helper
// ──────────────────────────────────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-amber-300/70 text-amber-900 rounded-[3px] px-0.5 not-italic font-semibold">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function scoreMatch(item: DocumentLibraryItem, q: string): number {
  const lq = q.toLowerCase();
  const title = (item.filename || "").toLowerCase();
  let score = 0;
  if (title === lq) score += 100;
  else if (title.startsWith(lq)) score += 80;
  else if (title.includes(lq)) score += 60;
  return score;
}

// ──────────────────────────────────────────────────────────────────────────────
// Filter state
// ──────────────────────────────────────────────────────────────────────────────

type FilterStatus = "all" | "done" | "processing" | "error";
type SortOrder = "newest" | "oldest" | "name";

interface Filters {
  status: FilterStatus;
  sort: SortOrder;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: Filters = {
  status: "all",
  sort: "newest",
  dateFrom: "",
  dateTo: "",
};

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  overlay?: boolean;
  onClose?: () => void;
  className?: string;
}

export function GlobalSearch({ overlay = false, onClose, className = "" }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("filename");

  // Filename search state
  const [filenameResults, setFilenameResults] = useState<DocumentLibraryItem[]>([]);
  // Content search state
  const [contentHits, setContentHits] = useState<ContentHit[]>([]);
  const [contentAnswer, setContentAnswer] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 320);
    return () => clearTimeout(t);
  }, [query]);

  // Lock scroll if rendered as overlay
  useEffect(() => {
    if (overlay) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [overlay]);

  // ── Filename search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "filename") return;
    if (!debouncedQuery.trim()) {
      setFilenameResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listAllDocuments(1, 50, debouncedQuery, filters.status === "all" ? undefined : filters.status)
      .then((data) => {
        if (cancelled) return;
        let docs = data.documents || [];

        // Client-side relevance score on top of backend search
        const scored = docs
          .map((d) => ({ doc: d, score: scoreMatch(d, debouncedQuery) || 10 }))
          .sort((a, b) => {
            // Apply sort order
            if (filters.sort === "name") return a.doc.filename.localeCompare(b.doc.filename);
            if (filters.sort === "oldest") return new Date(a.doc.upload_time).getTime() - new Date(b.doc.upload_time).getTime();
            if (filters.sort === "newest") return new Date(b.doc.upload_time).getTime() - new Date(a.doc.upload_time).getTime();
            return b.score - a.score;
          })
          .map((x) => x.doc);

        // Date range filter
        const filtered = scored.filter((d) => {
          const t = new Date(d.upload_time).getTime();
          if (filters.dateFrom && t < new Date(filters.dateFrom).getTime()) return false;
          if (filters.dateTo && t > new Date(filters.dateTo + "T23:59:59").getTime()) return false;
          return true;
        });

        setFilenameResults(filtered);
      })
      .catch(() => { if (!cancelled) setFilenameResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, filters, mode]);

  // ── Content / RAG search ───────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "content") return;
    if (!debouncedQuery.trim()) {
      setContentHits([]);
      setContentAnswer("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setContentAnswer("");
    setContentHits([]);

    submitQuery(debouncedQuery, undefined)
      .then((res) => {
        if (cancelled) return;

        // Answer summary
        setContentAnswer(res.answer || "");

        // Group sources by document
        const byDoc = new Map<string, ContentHit>();
        (res.sources || []).forEach((src: QuerySource) => {
          const docId = String(src.metadata?.document_id || src.metadata?.doc_id || "");
          const filename = String(src.metadata?.filename || src.metadata?.name || "Document");
          if (!docId) return;
          const existing = byDoc.get(docId);
          if (!existing || src.score > existing.score) {
            byDoc.set(docId, {
              documentId: docId,
              filename,
              snippet: src.content?.slice(0, 240) || "",
              score: src.score,
            });
          }
        });

        setContentHits(Array.from(byDoc.values()).sort((a, b) => b.score - a.score));
      })
      .catch(() => {
        if (!cancelled) {
          setContentAnswer("Could not perform content search. Make sure at least one document is fully processed.");
          setContentHits([]);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, mode]);

  // Close filter on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === "status") return v !== "all";
    if (k === "sort") return v !== "newest";
    return v !== "";
  }).length;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const hasResults = mode === "filename" ? filenameResults.length > 0 : contentHits.length > 0 || contentAnswer;

  return (
    <div className={`relative w-full ${className}`}>
      {/* ── Search input row ── */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40 pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            id="global-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "filename" ? "Search by filename, keyword…" : "Search inside documents…"}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full h-11 pl-10 pr-10 rounded-2xl border border-black/10 bg-white/80 backdrop-blur-sm text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/60 transition-all"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setFilenameResults([]); setContentHits([]); setContentAnswer(""); }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-ink/40 hover:text-ink/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter button (only in filename mode) */}
        {mode === "filename" && (
          <div className="relative" ref={filterRef}>
            <button
              id="search-filter-btn"
              onClick={() => setFilterOpen((p) => !p)}
              aria-label="Filters"
              aria-expanded={filterOpen}
              className={`relative h-11 px-3.5 flex items-center gap-1.5 rounded-2xl border text-sm font-medium transition-all ${
                activeFilterCount > 0 || filterOpen
                  ? "bg-amber-50 border-amber-400/60 text-amber-700 shadow-sm"
                  : "bg-white/80 border-black/10 text-ink/70 hover:bg-white hover:text-ink"
              } backdrop-blur-sm`}
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Filter popup */}
            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: -8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="absolute right-0 top-[calc(100%+8px)] z-50 w-[300px] rounded-2xl bg-white border border-black/8 shadow-xl shadow-black/10 p-4 space-y-4"
                >
                  <div>
                    <label className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Status</label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(["all", "done", "processing", "error"] as FilterStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setFilters((f) => ({ ...f, status: s }))}
                          className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                            filters.status === s ? "bg-amber-500 text-white shadow-sm" : "bg-black/5 text-ink/60 hover:bg-black/10"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Sort by</label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {([["newest", "Newest first"], ["oldest", "Oldest first"], ["name", "Name A–Z"]] as [SortOrder, string][]).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setFilters((f) => ({ ...f, sort: val }))}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            filters.sort === val ? "bg-amber-500 text-white shadow-sm" : "bg-black/5 text-ink/60 hover:bg-black/10"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink/50 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Date range
                    </label>
                    <div className="flex gap-2 mt-2">
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                        className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-black/10 bg-black/2 text-ink focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                      />
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                        className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-black/10 bg-black/2 text-ink focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-black/6">
                    <button onClick={clearFilters} className="text-xs text-ink/40 hover:text-ink/70 transition-colors">Reset all</button>
                    <button
                      onClick={() => setFilterOpen(false)}
                      className="px-3 py-1.5 rounded-lg bg-ink text-white text-xs font-medium hover:bg-ink/90 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {overlay && onClose && (
          <button
            onClick={onClose}
            aria-label="Close search"
            className="h-11 w-11 flex items-center justify-center rounded-2xl border border-black/10 bg-white/80 text-ink/60 hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── Mode toggle (filename vs content) ── */}
      <div className="flex mt-2.5 gap-1.5">
        <button
          onClick={() => { setMode("filename"); setContentHits([]); setContentAnswer(""); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            mode === "filename"
              ? "bg-[#1a1a2e] text-white shadow-md"
              : "bg-black/5 text-ink/60 hover:bg-black/8"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          By filename
        </button>
        <button
          onClick={() => { setMode("content"); setFilenameResults([]); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            mode === "content"
              ? "bg-amber-500 text-white shadow-md"
              : "bg-black/5 text-ink/60 hover:bg-black/8"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Inside documents
        </button>
      </div>

      {/* ── Results ── */}
      <AnimatePresence mode="wait">
        {query.trim() && (
          <motion.div
            key={`results-${mode}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="mt-3"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-ink/40">
                <Loader2 className="w-5 h-5 animate-spin" />
                {mode === "content" ? "Searching inside documents with AI…" : "Searching…"}
              </div>
            ) : mode === "filename" ? (
              /* ── Filename results ── */
              filenameResults.length === 0 ? (
                <div className="text-center py-8 text-sm text-ink/40">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No documents matching "{query}"
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-xs text-ink/40 px-1 mb-2">
                    {filenameResults.length} result{filenameResults.length !== 1 ? "s" : ""}
                  </div>
                  {filenameResults.map((doc) => (
                    <motion.div
                      key={doc.document_id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                    >
                      <Link
                        href={`/document/${doc.document_id}`}
                        onClick={onClose}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-black/4 transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 mt-0.5 bg-amber-50 border border-amber-200/60 flex items-center justify-center group-hover:border-amber-300 transition-colors">
                          {doc.thumbnail_url ? (
                            <img src={resolveMediaUrl(doc.thumbnail_url)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <FileText className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink leading-snug">
                            {highlightMatch(doc.filename || "Untitled", debouncedQuery)}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              doc.status === "completed" ? "bg-green-100 text-green-700"
                              : doc.status.startsWith("processing") ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                            }`}>
                              {doc.status.replace(/_/g, " ")}
                            </span>
                            {doc.word_count != null && doc.word_count > 0 && (
                              <span className="text-[10px] text-ink/35">{doc.word_count} words</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )
            ) : (
              /* ── Content / RAG results ── */
              <div className="space-y-3">
                {/* AI Answer */}
                {contentAnswer && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-amber-50 border border-amber-200/60 p-3.5"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">AI Answer</span>
                    </div>
                    <p className="text-sm text-ink/80 leading-relaxed line-clamp-4">{contentAnswer}</p>
                  </motion.div>
                )}

                {/* Source documents */}
                {contentHits.length > 0 && (
                  <div>
                    <div className="text-xs text-ink/40 px-1 mb-2">
                      Found in {contentHits.length} document{contentHits.length !== 1 ? "s" : ""}
                    </div>
                    <div className="space-y-1.5">
                      {contentHits.map((hit, i) => (
                        <motion.div
                          key={hit.documentId}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <Link
                            href={`/document/${hit.documentId}`}
                            onClick={onClose}
                            className="flex items-start gap-3 p-3 rounded-xl hover:bg-black/4 transition-colors group"
                          >
                            <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-200/60 flex items-center justify-center shrink-0 mt-0.5 group-hover:border-violet-300 transition-colors">
                              <FileSearch className="w-4 h-4 text-violet-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-ink truncate">{hit.filename}</div>
                              <p className="text-xs text-ink/55 mt-0.5 line-clamp-2 leading-relaxed">
                                {highlightMatch(hit.snippet, debouncedQuery)}
                              </p>
                              <div className="mt-1 flex items-center gap-1.5">
                                <div className="h-1 flex-1 max-w-[60px] rounded-full bg-black/8 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-violet-400"
                                    style={{ width: `${Math.round(hit.score * 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-ink/35">
                                  {Math.round(hit.score * 100)}% match
                                </span>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty content state */}
                {!contentAnswer && contentHits.length === 0 && (
                  <div className="text-center py-8 text-sm text-ink/40">
                    <FileSearch className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No content matches found for "{query}"</p>
                    <p className="text-xs mt-1 text-ink/30">Only completed documents are searched</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
