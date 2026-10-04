"use client";

/** The Enhance pill: drag-compare the straightened crop against the enhanced result, and see what was applied. */

import { ImageCompareSlider } from "@/components/ImageCompareSlider";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { DIPOperationsResponse } from "@/types";

const HIDDEN_OPERATIONS = new Set(["document_detection", "output_grayscale", "output_bw"]);

const humanize = (name: string) => name.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());

interface EnhanceSheetProps {
  open: boolean;
  onClose: () => void;
  dip: DIPOperationsResponse | null;
  /** Appended to image URLs so a re-processed page never shows a cached older image. */
  version: string;
}

export function EnhanceSheet({ open, onClose, dip, version }: EnhanceSheetProps) {
  const before = dip?.operations[0]?.image_after_url;
  const after = dip?.color_image_url;
  const applied = dip?.operations.filter((op) => !HIDDEN_OPERATIONS.has(op.operation_name)) ?? [];

  return (
    <BottomSheet open={open} onClose={onClose} title="Enhancement">
      {before && after ? (
        <div className="space-y-3 pb-2">
          <ImageCompareSlider
            beforeUrl={`${before}${version}`}
            afterUrl={`${after}${version}`}
            beforeLabel="Straightened"
            afterLabel="Enhanced"
          />
          <p className="text-xs text-ink-soft">
            Drag to compare. DocuMind only keeps an enhancement step when it measurably improves the page.
          </p>
          {applied.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {applied.map((op) => (
                <li key={op.id} className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-ink">
                  {humanize(op.operation_name)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-medium text-ink-soft">
              This page was already clean — no enhancement steps were needed.
            </p>
          )}
        </div>
      ) : (
        <p className="pb-4 text-sm text-ink-soft">The comparison appears once this page has finished scanning.</p>
      )}
    </BottomSheet>
  );
}
