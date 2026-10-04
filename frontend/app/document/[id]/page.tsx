"use client";

/**
 * The document view, following scanner-app conventions: the straightened scan in a cream frame; a page strip
 * (multi-page) with swipe / arrow-key paging; Share and a ⋯ menu (Rename, Rotate, Re-adjust corners, Delete) top
 * right; action pills under the scan (Enhance · Ask questions · Export PDF). Every action is either available or
 * visibly unavailable with a toast that says why — no dead buttons.
 */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Crop, Download, FileDown, MessageCircle, Pencil, RotateCw, Send, Share2, Sparkles, Trash2, Workflow } from "lucide-react";


import { DeleteSheet, RenameSheet } from "@/components/document/DocumentDialogs";
import { EnhanceSheet } from "@/components/document/EnhanceSheet";
import { PageStrip } from "@/components/document/PageStrip";
import { MeshGradient } from "@/components/MeshGradient";
import { ModeToggle } from "@/components/ModeToggle";
import { HowItWorksPanel } from "@/components/panel/HowItWorksPanel";
import { useToast } from "@/components/providers/ToastProvider";
import { ScanSequence } from "@/components/ScanSequence";
import { AdjustCorners } from "@/components/scan/AdjustCorners";
import { GlassIconButton } from "@/components/ui/GlassIconButton";
import { useAgentStream } from "@/hooks/useAgentStream";
import { useDocument } from "@/hooks/useDocument";
import {
  deleteDocument,
  getDocumentAgentsLog,
  getDocumentDip,
  getDocumentGraph,
  getDocumentOcr,
  getDocumentPages,
  recropDocument,
  renameDocument,
  resolveMediaUrl,
  rotatePage,
} from "@/lib/api";
import { detectCornersForBlob } from "@/lib/detect";
import { haptic } from "@/lib/haptics";
import { fetchImageBlob } from "@/lib/media";
import { defaultCorners } from "@/lib/opencv";
import { buildPdf } from "@/lib/pdf";
import { downloadBlob, safeFilename, shareOrDownload } from "@/lib/share";
import type {
  AgentLogEntry,
  DIPOperationsResponse,
  GraphResponse,
  OCRResponse,
  PageInfo,
  ScanMode,
} from "@/types";

const SWIPE_DISTANCE = 60;

export default function DocumentPage() {
  const params = useParams();
  const documentId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const { document, error, reload } = useDocument(documentId);
  const { events, isConnected } = useAgentStream(documentId);

  const [pages, setPages] = useState<PageInfo[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [dip, setDip] = useState<DIPOperationsResponse | null>(null);
  const [ocr, setOcr] = useState<OCRResponse | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([]);
  const [mode, setMode] = useState<ScanMode>("color");
  const [panelOpen, setPanelOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [enhanceOpen, setEnhanceOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [rotation, setRotation] = useState(0);
  const sawProcessingRef = useRef(false);

  const status = document?.status ?? "uploaded";
  const isReady = status === "completed";
  const isFailed = status === "failed";
  const filename = document?.filename ?? "Document";

  // Appended to image URLs so a re-cropped/rotated page (same file path) never shows a cached older image.
  const version = document?.completed_time ? `?v=${encodeURIComponent(document.completed_time)}` : "";
  const versioned = useCallback((url: string) => (url ? `${url}${version}` : ""), [version]);

  // --------------------------------------------------------------- data loading
  useEffect(() => {
    if (!document) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const logs = await getDocumentAgentsLog(documentId);
        if (!cancelled) setAgentLogs(logs.logs);
      } catch {
        // logs may not exist yet
      }
      try {
        const pageList = await getDocumentPages(documentId);
        if (!cancelled) setPages(pageList.pages);
      } catch {
        // pages appear once the upload has been registered
      }
      try {
        if (status !== "uploaded") {
          const dipResult = await getDocumentDip(documentId, pageIndex);
          if (!cancelled && dipResult.operations.length > 0) setDip(dipResult);
        }
      } catch {
        // dip results may not exist yet
      }
      if (["processing_understanding", "processing_graph", "processing_embeddings", "completed"].includes(status)) {
        try {
          const result = await getDocumentOcr(documentId);
          if (!cancelled) setOcr(result);
        } catch {
          // ocr may not exist yet
        }
      }
      if (["processing_embeddings", "completed"].includes(status)) {
        try {
          const result = await getDocumentGraph(documentId);
          if (!cancelled) setGraph(result);
        } catch {
          // graph may not exist yet
        }
      }
    };

    void refresh();
    return () => {
      cancelled = true;
    };
    // `document` is deliberately reduced to its status: the polled object changes identity every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, status, pageIndex, events.length]);

  // Drop the optimistic rotation once the server has re-processed the page.
  useEffect(() => {
    if (rotation === 0) return;
    if (status !== "completed") sawProcessingRef.current = true;
    else if (sawProcessingRef.current) {
      sawProcessingRef.current = false;
      setRotation(0);
    }
  }, [status, rotation]);

  // Keep the page index valid if pages disappear, and reset per-page data when switching pages.
  useEffect(() => {
    if (pages.length > 0 && pageIndex >= pages.length) setPageIndex(pages.length - 1);
  }, [pages.length, pageIndex]);

  const goToPage = useCallback(
    (index: number) => {
      if (index < 0 || index >= pages.length || index === pageIndex) return;
      haptic(8);
      setDip(null);
      setPageIndex(index);
    },
    [pages.length, pageIndex]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.key === "ArrowLeft") goToPage(pageIndex - 1);
      if (event.key === "ArrowRight") goToPage(pageIndex + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToPage, pageIndex]);

  // ------------------------------------------------------------------ derived
  const currentPage = pages[pageIndex];
  const pageUrls = useMemo<Record<ScanMode, string> | null>(() => {
    if (!currentPage?.color_url) return null;
    return {
      color: versioned(currentPage.color_url),
      grayscale: versioned(currentPage.grayscale_url),
      bw: versioned(currentPage.bw_url),
    };
  }, [currentPage, versioned]);

  const isFallback = dip?.detection_status === "fallback" && dip.page_number === pageIndex;
  const hasResult = Boolean(pageUrls);
  const multiPage = pages.length > 1;

  const modeUrlFor = (page: PageInfo): string =>
    versioned({ color: page.color_url, grayscale: page.grayscale_url, bw: page.bw_url }[mode] || page.color_url);

  const unavailable = (reason: string) => {
    toast(reason);
  };

  // ------------------------------------------------------------------ actions
  const handleAsk = (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    router.push(`/query/${documentId}?q=${encodeURIComponent(question.trim())}`);
  };

  const handleDownload = async () => {
    const url = currentPage ? modeUrlFor(currentPage) : "";
    if (!url) return unavailable("Still scanning — the download is ready in a moment");
    try {
      downloadBlob(await fetchImageBlob(resolveMediaUrl(url)), safeFilename(`${filename}-page-${pageIndex + 1}`, "png"));
    } catch {
      toast({ message: "Couldn't download that image", tone: "error", actionLabel: "Retry", onAction: handleDownload });
    }
  };

  const makePdf = async (): Promise<File> => {
    const urls = pages.map((page) => resolveMediaUrl(modeUrlFor(page))).filter(Boolean);
    const blob = await buildPdf(urls);
    return new File([blob], safeFilename(filename, "pdf"), { type: "application/pdf" });
  };

  const handleExportPdf = async () => {
    if (!hasResult) return unavailable("Still scanning — export is available in a moment");
    setExporting(true);
    try {
      const file = await makePdf();
      downloadBlob(file, file.name);
      toast(`Saved ${file.name}`);
    } catch {
      toast({ message: "Couldn't build the PDF", tone: "error", actionLabel: "Retry", onAction: handleExportPdf });
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (!hasResult) return unavailable("Still scanning — you can share once the scan is ready");
    setSharing(true);
    try {
      let file: File;
      if (multiPage) {
        file = await makePdf();
      } else {
        const blob = await fetchImageBlob(resolveMediaUrl(modeUrlFor(pages[0])));
        file = new File([blob], safeFilename(filename, "png"), { type: "image/png" });
      }
      const outcome = await shareOrDownload(file, filename);
      if (outcome === "downloaded") toast(`Saved ${file.name}`);
    } catch {
      toast({ message: "Couldn't share that", tone: "error", actionLabel: "Retry", onAction: handleShare });
    } finally {
      setSharing(false);
    }
  };

  const handleRename = async (name: string) => {
    try {
      await renameDocument(documentId, name);
      reload();
      toast("Renamed");
    } catch {
      toast({ message: "Couldn't rename the document", tone: "error" });
      throw new Error("rename failed");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDocument(documentId);
      toast("Document deleted");
      router.push("/");
    } catch {
      toast({ message: "Couldn't delete the document", tone: "error" });
    }
  };

  const handleRotate = async () => {
    if (!hasResult) return unavailable("Still scanning — rotate once this page is ready");
    haptic(8);
    setRotation((current) => current + 90); // optimistic: turn the picture now, sync in the background
    try {
      await rotatePage(documentId, pageIndex, 90);
      setOcr(null);
      setGraph(null);
      reload();
    } catch {
      setRotation((current) => current - 90);
      toast({ message: "Couldn't rotate that page", tone: "error", actionLabel: "Retry", onAction: handleRotate });
    }
  };

  const handleReadjust = () => {
    if (!dip || dip.page_number !== pageIndex) return unavailable("Still scanning — adjust corners once this page is ready");
    setAdjustOpen(true);
  };

  const handleRecrop = async (corners: number[][]) => {
    await recropDocument(documentId, corners, pageIndex);
    setAdjustOpen(false);
    setDip(null);
    setOcr(null);
    setGraph(null);
    reload();
    toast("Re-scanning this page with your corners…");
  };

  const handleAutoCorners = useCallback(async () => {
    if (!dip) return null;
    return detectCornersForBlob(await fetchImageBlob(resolveMediaUrl(versioned(dip.original_image_url))), null);
  }, [dip, versioned]);

  const pillClass =
    "flex min-h-[44px] items-center gap-2 rounded-full bg-cream px-4 text-xs font-semibold text-ink shadow-md shadow-black/5 transition-colors hover:bg-white";

  return (
    <main className="relative min-h-[100dvh] overflow-hidden">
      <MeshGradient />

      <header className="relative z-30 flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          DocuMind
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setRenameOpen(true)}
            aria-label="Rename"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white/50 text-ink backdrop-blur-md hover:bg-white/70"
          >
            <Pencil className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white/50 text-[#c0392b] backdrop-blur-md hover:bg-white/70"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={handleShare}
            aria-label="Share"
            aria-disabled={!hasResult || undefined}
            className={
              "flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white/50 text-ink backdrop-blur-md hover:bg-white/70 " +
              (hasResult ? "" : "opacity-50")
            }
          >
            <Share2 className={sharing ? "h-4.5 w-4.5 animate-pulse" : "h-4.5 w-4.5"} />
          </button>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: panelOpen ? 0.98 : 1 }}
        transition={{ duration: 0.5 }}
        className={
          "relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-2 sm:px-6 sm:pt-4 " +
          (multiPage ? "pb-44" : "pb-32")
        }
      >
        {error && (
          <p className="mb-4 rounded-full border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">{error}</p>
        )}

        {isFailed ? (
          <div className="flex w-full flex-col items-center gap-3 rounded-4xl bg-cream px-6 py-16 text-center shadow-xl shadow-black/5">
            <p className="text-lg font-semibold text-ink">Something went wrong</p>
            <p className="max-w-sm text-sm text-ink-soft">
              {document?.error_message || "The document could not be processed. Please try again."}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 max-w-full truncate text-sm font-semibold text-ink-soft">{filename}</p>

            <motion.div
              className="relative w-full"
              style={{ touchAction: "pan-y" }}
              onPanEnd={(_, info) => {
                if (Math.abs(info.offset.x) < SWIPE_DISTANCE || Math.abs(info.offset.x) < Math.abs(info.offset.y)) return;
                goToPage(pageIndex + (info.offset.x < 0 ? 1 : -1));
              }}
            >
              <ScanSequence urls={pageUrls} pageKey={String(pageIndex)} status={status} mode={mode} extraRotation={rotation} />
              {multiPage && (
                <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  {pageIndex + 1} / {pages.length}
                </span>
              )}
            </motion.div>

            {hasResult && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <ModeToggle mode={mode} onChange={setMode} />
                <button
                  onClick={handleRotate}
                  aria-label="Rotate page"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-ink shadow-md shadow-black/5 hover:bg-white"
                >
                  <RotateCw className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={handleReadjust}
                  aria-label="Re-adjust corners"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-ink shadow-md shadow-black/5 hover:bg-white"
                >
                  <Crop className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={handleDownload}
                  aria-label="Download this page"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-ink shadow-md shadow-black/5 hover:bg-white"
                >
                  <Download className="h-4.5 w-4.5" />
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => (dip ? setEnhanceOpen(true) : unavailable("Enhancement details appear once this page is scanned"))}
                aria-disabled={!dip || undefined}
                className={pillClass + (dip ? "" : " opacity-60")}
              >
                <Sparkles className="h-4 w-4" />
                Enhance
              </button>
              <button
                onClick={() => (isReady ? router.push(`/query/${documentId}`) : unavailable("Still reading your document — questions unlock when it's ready"))}
                aria-disabled={!isReady || undefined}
                className={pillClass + (isReady ? "" : " opacity-60")}
              >
                <MessageCircle className="h-4 w-4" />
                Ask questions
              </button>
              <button
                onClick={handleExportPdf}
                disabled={exporting}
                aria-disabled={!hasResult || undefined}
                className={pillClass + (hasResult ? "" : " opacity-60")}
              >
                <FileDown className="h-4 w-4" />
                {exporting ? "Building PDF…" : "Export PDF"}
              </button>
            </div>

            <AnimatePresence>
              {isFallback && !adjustOpen && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  onClick={handleReadjust}
                  className="mt-4 flex min-h-[44px] items-center gap-2 rounded-full bg-cream px-4 py-2 text-xs font-semibold text-ink-soft shadow-md shadow-black/5 transition-colors hover:text-ink"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Couldn&apos;t find the edges — Adjust corners
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isReady && (
                <motion.form
                  onSubmit={handleAsk}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 24, delay: 0.2 }}
                  className="mt-6 flex w-full max-w-xl items-center gap-2 rounded-full bg-cream py-2 pl-6 pr-2 shadow-lg shadow-black/10 focus-within:ring-2 focus-within:ring-accent/40"
                >
                  <input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask anything about this document…"
                    className="min-h-[44px] flex-1 bg-transparent text-sm text-ink placeholder:text-ink-soft focus:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Ask"
                    className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-ink text-cream transition-transform active:scale-90"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>

      {multiPage && (
        <PageStrip
          thumbnails={pages.map((page) => versioned(page.color_url || page.original_url))}
          current={pageIndex}
          onSelect={goToPage}
        />
      )}

      <div
        className={
          "fixed right-4 z-30 sm:right-8 " +
          (multiPage ? "bottom-[calc(env(safe-area-inset-bottom)+96px)]" : "bottom-[calc(env(safe-area-inset-bottom)+24px)]")
        }
      >
        <GlassIconButton label="How it works" onClick={() => setPanelOpen(true)} className="group relative">
          <Workflow className="h-5 w-5" />
        </GlassIconButton>
      </div>

      <HowItWorksPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        dip={dip}
        ocr={ocr}
        graph={graph}
        agentLogs={agentLogs}
        liveEvents={events}
        isConnected={isConnected}
      />

      <EnhanceSheet open={enhanceOpen} onClose={() => setEnhanceOpen(false)} dip={dip} version={version} />
      <RenameSheet open={renameOpen} initialName={filename} onClose={() => setRenameOpen(false)} onSave={handleRename} />
      <DeleteSheet open={deleteOpen} name={filename} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} />

      <AnimatePresence>
        {adjustOpen && dip && (
          <AdjustCorners
            key="adjust"
            imageUrl={resolveMediaUrl(versioned(dip.original_image_url))}
            width={dip.original_width}
            height={dip.original_height}
            initialCorners={
              dip.detected_corners.length === 4 ? dip.detected_corners : defaultCorners(dip.original_width, dip.original_height)
            }
            title={multiPage ? `Adjust corners — page ${pageIndex + 1}` : "Adjust corners"}
            keepLabel="Save crop"
            onKeep={handleRecrop}
            onAuto={handleAutoCorners}
            onBack={() => setAdjustOpen(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
