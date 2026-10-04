"use client";

import { motion } from "framer-motion";

import { MetricDeltaBadge } from "@/components/MetricDeltaBadge";
import type { DIPOperationsResponse } from "@/types";

function formatOperationName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function OperationsTab({ dip }: { dip: DIPOperationsResponse | null }) {
  if (!dip || dip.operations.length === 0) {
    return <p className="py-10 text-center text-xs text-ink-soft">No DIP operations recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {dip.operations.map((op, index) => {
        const reverted = op.params.reverted === true;
        const scored = op.params.scored !== false;
        return (
          <motion.div
            key={op.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="rounded-2xl border border-black/10 bg-black/5 p-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{formatOperationName(op.operation_name)}</p>
              {scored ? (
                <div className="flex flex-wrap gap-1.5">
                  <MetricDeltaBadge
                    label="PSNR"
                    delta={op.psnr_after - op.psnr_before}
                    unit=" dB"
                    reverted={reverted}
                  />
                  <MetricDeltaBadge label="SSIM" delta={op.ssim_after - op.ssim_before} reverted={reverted} />
                </div>
              ) : (
                <span className="rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-ink-soft">
                  Output mode — not scored
                </span>
              )}
            </div>
            {Object.keys(op.params).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(op.params)
                  .filter(([key]) => !["reverted", "reason", "scored", "output_mode"].includes(key))
                  .map(([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full border border-black/10 bg-white/60 px-2 py-0.5 font-mono text-[10px] text-ink-soft"
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
