"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Download,
  FilePlus2,
  Loader2,
  Merge,
  Plus,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { downloadBlob, mergeImagesToPdf, splitPdfPages, type PageRange } from "@/lib/pdfOps";

interface PdfToolsProps {
  pages: { url: string; label: string }[];
  documentName: string;
  onClose?: () => void;
}

type ActiveTool = "merge" | "split" | null;

export function PdfTools({ pages, documentName, onClose }: PdfToolsProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [busy, setBusy] = useState(false);

  // ── Merge ───────────────────────────────────────────────────────────────
  const handleMerge = async () => {
    if (!pages.length) return;
    setBusy(true);
    try {
      const blob = await mergeImagesToPdf(pages.map((p) => p.url), {
        filename: `${documentName}-merged.pdf`,
      });
      downloadBlob(blob, `${documentName}-merged.pdf`);
    } finally {
      setBusy(false);
    }
  };

  // ── Split ───────────────────────────────────────────────────────────────
  const [ranges, setRanges] = useState<PageRange[]>([
    { start: 1, end: pages.length, name: "part-1.pdf" },
  ]);

  const addRange = () => {
    setRanges((prev) => [...prev, { start: 1, end: pages.length, name: `part-${prev.length + 1}.pdf` }]);
  };
  const removeRange = (i: number) => setRanges((prev) => prev.filter((_, idx) => idx !== i));
  const updateRange = (i: number, patch: Partial<PageRange>) =>
    setRanges((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleSplit = async () => {
    if (!ranges.length) return;
    setBusy(true);
    try {
      const files = await splitPdfPages(pages.map((p) => p.url), ranges);
      for (const { blob, name } of files) {
        downloadBlob(blob, name);
        await new Promise((r) => setTimeout(r, 250)); // stagger downloads
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Tool selector buttons */}
      <div className="flex gap-2">
        <button
          id="pdf-merge-btn"
          onClick={() => setActiveTool((t) => (t === "merge" ? null : "merge"))}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
            activeTool === "merge"
              ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-200"
              : "bg-white border-black/10 text-ink hover:bg-violet-50 hover:border-violet-200"
          }`}
        >
          <Merge className="w-4 h-4" />
          Merge all pages
        </button>
        <button
          id="pdf-split-btn"
          onClick={() => setActiveTool((t) => (t === "split" ? null : "split"))}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
            activeTool === "split"
              ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200"
              : "bg-white border-black/10 text-ink hover:bg-amber-50 hover:border-amber-200"
          }`}
        >
          <Scissors className="w-4 h-4" />
          Split PDF
        </button>
      </div>

      {/* Merge panel */}
      <AnimatePresence>
        {activeTool === "merge" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="bg-violet-50 border border-violet-200/60 rounded-xl p-4">
              <div className="text-sm font-semibold text-violet-900 mb-1">Merge all pages into one PDF</div>
              <div className="text-xs text-violet-600/80 mb-4">
                All {pages.length} pages will be combined in their current order into a single downloadable PDF file.
              </div>

              {/* Page thumbnails preview */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide mb-4">
                {pages.map((p, i) => (
                  <div key={i} className="flex-none w-14 text-center">
                    <div className="w-14 h-[72px] rounded-lg overflow-hidden border border-violet-200 bg-white">
                      <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-[9px] text-violet-500 mt-0.5">{i + 1}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleMerge}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {busy ? "Generating PDF…" : "Download merged PDF"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Split panel */}
      <AnimatePresence>
        {activeTool === "split" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4">
              <div className="text-sm font-semibold text-amber-900 mb-1">Split into separate PDFs</div>
              <div className="text-xs text-amber-700/80 mb-4">
                Define page ranges — each range becomes its own PDF file. Pages are 1-indexed.
              </div>

              <div className="space-y-2">
                {ranges.map((range, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-xl border border-amber-200/60 p-2.5">
                    <FilePlus2 className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-xs text-amber-700">Pages</span>
                      <input
                        type="number"
                        min={1}
                        max={pages.length}
                        value={range.start}
                        onChange={(e) => updateRange(i, { start: Number(e.target.value) })}
                        className="w-12 text-xs px-2 py-1 rounded-lg border border-amber-200 text-center bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                      />
                      <span className="text-xs text-amber-500">–</span>
                      <input
                        type="number"
                        min={1}
                        max={pages.length}
                        value={range.end}
                        onChange={(e) => updateRange(i, { end: Number(e.target.value) })}
                        className="w-12 text-xs px-2 py-1 rounded-lg border border-amber-200 text-center bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                      />
                    </div>
                    <input
                      type="text"
                      value={range.name || ""}
                      onChange={(e) => updateRange(i, { name: e.target.value })}
                      placeholder="filename.pdf"
                      className="flex-1 text-xs px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400/50 min-w-0"
                    />
                    <button
                      onClick={() => removeRange(i)}
                      disabled={ranges.length <= 1}
                      className="p-1 rounded-lg text-amber-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addRange}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-amber-300 text-xs text-amber-600 hover:bg-amber-100/50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add range
              </button>

              <button
                onClick={handleSplit}
                disabled={busy}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {busy ? `Generating ${ranges.length} PDF${ranges.length !== 1 ? "s" : ""}…` : `Download ${ranges.length} PDF file${ranges.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
