"use client";

/** A single line of status text that rolls vertically (old line up+fade, new rolls in from below) on change. */

import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface StatusRollerProps {
  text: string;
  shimmer?: boolean;
  className?: string;
}

export function StatusRoller({ text, shimmer = false, className }: StatusRollerProps) {
  return (
    <div className={cn("relative h-6 overflow-hidden", className)}>
      <AnimatePresence mode="popLayout">
        <motion.p
          key={text}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className={cn(
            "absolute inset-x-0 text-center text-sm font-medium text-ink-soft",
            shimmer &&
              "bg-gradient-to-r from-ink-soft via-ink to-ink-soft bg-[length:200%_100%] bg-clip-text text-transparent [animation:shimmer_2s_linear_infinite]"
          )}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
