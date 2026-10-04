"use client";

import { AnimatePresence, motion, Reorder } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  GripVertical,
  ImagePlus,
  Merge,
  Plus,
  RotateCcw,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { rotatePage } from "@/lib/api";
import type { PageInfo } from "@/types";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface ManagedPage extends PageInfo {
  /** Unique key for React list (stable across reorders) */
  key: string;
  /** Blob URL for a locally added image before upload */
  localSrc?: string;
  /** Pages merged onto this page */
  mergedImages?: string[];
}

interface PageManagerProps {
  documentId: string;
  initialPages: PageInfo[];
  onReorder?: (pages: ManagedPage[]) => void;
  onMerge?: (pages: ManagedPage[]) => void;
  onDelete?: (pageKey: string) => void;
  onAddImages?: (pageKey: string, files: File[]) => void;
  className?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function toManaged(pages: PageInfo[]): ManagedPage[] {
  return pages.map((p, i) => ({ ...p, key: `page-${i}-${p.page_number}` }));
}

// ──────────────────────────────────────────────────────────────────────────────
// Page Manager Component
// ──────────────────────────────────────────────────────────────────────────────

export function PageManager({
  documentId,
  initialPages,
  onReorder,
  onDelete,
  onAddImages,
  className = "",
}: PageManagerProps) {
  const [pages, setPages] = useState<ManagedPage[]>(() => toManaged(initialPages));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rotatingKey, setRotatingKey] = useState<string | null>(null);
  const addImageInputRef = useRef<HTMLInputElement>(null);
  const [addToPageKey, setAddToPageKey] = useState<string | null>(null);

  // ── Reorder ──────────────────────────────────────────────────────────────
  const handleReorder = useCallback(
    (reordered: ManagedPage[]) => {
      setPages(reordered);
      onReorder?.(reordered);
    },
    [onReorder]
  );

  // ── Move up/down ─────────────────────────────────────────────────────────
  const moveUp = (key: string) => {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      onReorder?.(next);
      return next;
    });
  };

  const moveDown = (key: string) => {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      onReorder?.(next);
      return next;
    });
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const deletePage = (key: string) => {
    setPages((prev) => prev.filter((p) => p.key !== key));
    setSelected((prev) => { const s = new Set(prev); s.delete(key); return s; });
    onDelete?.(key);
  };

  // ── Rotate ───────────────────────────────────────────────────────────────
  const rotatePage_ = async (page: ManagedPage) => {
    setRotatingKey(page.key);
    try {
      await rotatePage(documentId, page.page_number, 90);
    } finally {
      setRotatingKey(null);
    }
  };

  // ── Selection ────────────────────────────────────────────────────────────
  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  };

  // ── Add images to page ───────────────────────────────────────────────────
  const openAddImages = (key: string) => {
    setAddToPageKey(key);
    addImageInputRef.current?.click();
  };

  const handleImageFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !addToPageKey) return;
    onAddImages?.(addToPageKey, files);
    // Add local preview URLs to the page
    setPages((prev) =>
      prev.map((p) => {
        if (p.key !== addToPageKey) return p;
        const newUrls = files.map((f) => URL.createObjectURL(f));
        return { ...p, mergedImages: [...(p.mergedImages || []), ...newUrls] };
      })
    );
    e.target.value = "";
    setAddToPageKey(null);
  };

  // ── Split selected ────────────────────────────────────────────────────────
  const splitSelected = () => {
    // For real splitting: emit an event; here we just deselect
    setSelected(new Set());
  };

  return (
    <div className={`relative ${className}`}>
      {/* Hidden file input for adding images */}
      <input
        ref={addImageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleImageFiles}
        aria-label="Add images to page"
      />

      {/* Toolbar */}
      {selected.size > 1 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-3 flex items-center gap-2 px-1"
        >
          <span className="text-xs text-ink/50 font-medium">{selected.size} selected</span>
          <button
            onClick={splitSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            <Scissors className="w-3.5 h-3.5" />
            Split into separate files
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto p-1.5 rounded-lg hover:bg-black/5 text-ink/40"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}

      {/* Page list */}
      <Reorder.Group
        axis="y"
        values={pages}
        onReorder={handleReorder}
        className="space-y-2"
        layoutScroll
      >
        <AnimatePresence mode="popLayout">
          {pages.map((page, idx) => (
            <Reorder.Item
              key={page.key}
              value={page}
              id={page.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              className={`relative flex items-start gap-3 p-3 rounded-2xl border bg-white transition-shadow ${
                selected.has(page.key)
                  ? "border-amber-400 shadow-md shadow-amber-200/40 bg-amber-50/30"
                  : "border-black/8 shadow-sm hover:shadow-md"
              }`}
            >
              {/* Drag handle */}
              <div className="flex flex-col items-center gap-1 pt-1.5 cursor-grab active:cursor-grabbing text-ink/25 hover:text-ink/50 transition-colors touch-none">
                <GripVertical className="w-4.5 h-4.5" />
              </div>

              {/* Page number */}
              <div
                onClick={() => toggleSelect(page.key)}
                className={`relative w-[80px] h-[110px] rounded-xl overflow-hidden shrink-0 cursor-pointer border-2 transition-colors ${
                  selected.has(page.key) ? "border-amber-400" : "border-transparent"
                }`}
              >
                <img
                  src={page.color_url}
                  alt={`Page ${page.page_number}`}
                  className="w-full h-full object-cover"
                />
                {/* Merged images indicator */}
                {page.mergedImages && page.mergedImages.length > 0 && (
                  <div className="absolute bottom-1 right-1 flex gap-0.5">
                    {page.mergedImages.slice(0, 3).map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        className="w-5 h-5 rounded-sm border border-white object-cover shadow"
                        alt=""
                      />
                    ))}
                  </div>
                )}
                {selected.has(page.key) && (
                  <div className="absolute inset-0 bg-amber-400/20 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="text-sm font-semibold text-ink">Page {idx + 1}</div>
                {page.mergedImages && page.mergedImages.length > 0 && (
                  <div className="text-xs text-ink/50 mt-0.5">
                    +{page.mergedImages.length} merged image{page.mergedImages.length !== 1 ? "s" : ""}
                  </div>
                )}
                <div className="text-[10px] text-ink/30 mt-0.5 uppercase tracking-wide">
                  {page.detection_status === "success" ? "Detected" : "Manual crop"}
                </div>

                {/* Inline action buttons — directly visible */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <button
                    onClick={() => openAddImages(page.key)}
                    title="Add images to this page"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 text-[11px] font-medium hover:bg-purple-100 transition-colors border border-purple-100"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    Add image
                  </button>
                  <button
                    onClick={() => rotatePage_(page)}
                    disabled={rotatingKey === page.key}
                    title="Rotate 90°"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-[11px] font-medium hover:bg-sky-100 transition-colors border border-sky-100 disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${rotatingKey === page.key ? "animate-spin" : ""}`} />
                    Rotate
                  </button>
                  <button
                    onClick={() => deletePage(page.key)}
                    title="Delete page"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-medium hover:bg-red-100 transition-colors border border-red-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Move up/down for keyboards/accessibility */}
              <div className="flex flex-col gap-1 pt-1">
                <button
                  onClick={() => moveUp(page.key)}
                  disabled={idx === 0}
                  aria-label="Move page up"
                  className="p-1 rounded-lg text-ink/30 hover:text-ink/60 hover:bg-black/5 transition-colors disabled:opacity-20"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveDown(page.key)}
                  disabled={idx === pages.length - 1}
                  aria-label="Move page down"
                  className="p-1 rounded-lg text-ink/30 hover:text-ink/60 hover:bg-black/5 transition-colors disabled:opacity-20"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {/* Add blank page */}
      <button className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-black/10 text-sm text-ink/40 hover:border-amber-400/40 hover:text-amber-600 hover:bg-amber-50/30 transition-all">
        <Plus className="w-4 h-4" />
        Add page
      </button>
    </div>
  );
}
