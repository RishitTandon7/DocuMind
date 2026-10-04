"use client";

import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

interface MetricDeltaBadgeProps {
  label: string;
  delta: number;
  unit?: string;
  reverted?: boolean;
}

export function MetricDeltaBadge({ label, delta, unit = "", reverted = false }: MetricDeltaBadgeProps) {
  const improved = delta >= 0;

  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 1.15, 1], opacity: 1 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        reverted
          ? "border-warning/30 bg-warning/10 text-warning"
          : improved
            ? "border-success/30 bg-success/10 text-success"
            : "border-error/30 bg-error/10 text-error"
      )}
    >
      {reverted && <RotateCcw className="h-3 w-3" />}
      {label} {improved ? "+" : ""}
      {delta.toFixed(2)}
      {unit}
      {reverted && " reverted"}
    </motion.span>
  );
}
