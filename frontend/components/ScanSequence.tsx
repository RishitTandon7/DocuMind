"use client";

/**
 * The document view's main image display.
 *
 * Always shows the cropped, perspective-corrected scan (never the raw
 * original photo — that only appears inside the How-it-works panel's
 * "Detect & Crop" stage, where the green quad overlay explains it). While
 * processing, a soft placeholder shimmers with a rolling status line; once
 * the crop is ready it materializes with a gentle blur-up + glow bloom, and
 * switching Color/Grayscale/B&W crossfades between the three outputs.
 */

import { motion, useReducedMotion } from "framer-motion";

import BrutalistDeckLoader from "@/components/ui/brutalist-deck-loader";
import { StatusRoller } from "@/components/StatusRoller";
import { resolveMediaUrl } from "@/lib/api";
import type { DocumentStatus, ScanMode } from "@/types";

const STATUS_MESSAGES: Record<DocumentStatus, string> = {
  uploaded: "Getting started…",
  processing_dip: "Scanning your document…",
  processing_ocr: "Reading the details…",
  processing_understanding: "Making sense of it…",
  processing_graph: "Connecting the dots…",
  processing_embeddings: "Almost ready…",
  completed: "Ready — ask me anything",
  failed: "Something went wrong",
};

interface ScanSequenceProps {
  /** Output image URLs for the page being viewed, or null while Tier 0 hasn't produced them yet. */
  urls: Record<ScanMode, string> | null;
  /** Identifies the page so switching pages crossfades like switching modes does. */
  pageKey: string;
  status: DocumentStatus;
  mode: ScanMode;
  /** Optimistic clockwise rotation (degrees) shown immediately while the server re-processes the page. */
  extraRotation?: number;
}

export function ScanSequence({ urls, pageKey, status, mode, extraRotation = 0 }: ScanSequenceProps) {
  const reducedMotion = useReducedMotion();
  const statusText = STATUS_MESSAGES[status];

  const resultUrl = urls ? urls[mode] || urls.color : "";
  const hasResult = !!resultUrl;

  return (
    <div className="w-full">
      <div 
        className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-cream shadow-xl shadow-black/5"
        style={{ WebkitMaskImage: "-webkit-radial-gradient(white, black)", isolation: "isolate" }}
      >
        {!hasResult ? (
          <BrutalistDeckLoader />
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.25 }}
              transition={{ duration: 0.8 }}
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#7DD3C0,_transparent_65%)]"
            />
            <motion.img
              key={`${pageKey}-${mode}`}
              src={resolveMediaUrl(resultUrl)}
              alt="Cropped and enhanced document"
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 1.05, filter: "blur(14px)" }
              }
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)", rotate: extraRotation }}
              transition={{ type: "spring", stiffness: 200, damping: 24, mass: 0.8, filter: { duration: 0.6 } }}
              className="absolute inset-0 h-full w-full object-contain transform-gpu"
            />
          </>
        )}
      </div>

      <StatusRoller
        text={statusText}
        className="mt-6"
        shimmer={status !== "completed" && status !== "failed"}
      />
    </div>
  );
}
