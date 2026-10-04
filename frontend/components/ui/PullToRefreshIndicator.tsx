"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 72,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const progress = Math.min(1, pullDistance / threshold);
  const isReady = pullDistance >= threshold;

  return (
    <motion.div
      style={{ height: isRefreshing ? 56 : pullDistance * 0.8 }}
      animate={{ height: isRefreshing ? 56 : pullDistance * 0.8 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex items-center justify-center w-full overflow-hidden"
    >
      <motion.div
        animate={{
          scale: isRefreshing ? 1 : 0.5 + progress * 0.5,
          opacity: isRefreshing ? 1 : progress,
        }}
        className={`flex flex-col items-center gap-1 transition-colors ${
          isReady || isRefreshing ? "text-amber-600" : "text-ink/40"
        }`}
      >
        {isRefreshing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            style={{ transform: `rotate(${progress * 180}deg)` }}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        )}
        <span className="text-[10px] font-medium">
          {isRefreshing ? "Refreshing…" : isReady ? "Release to refresh" : "Pull to refresh"}
        </span>
      </motion.div>
    </motion.div>
  );
}
