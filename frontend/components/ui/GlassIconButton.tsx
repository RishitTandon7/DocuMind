"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";

import type { MotionConflictingHandlers } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface GlassIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, MotionConflictingHandlers> {
  label: string;
}

export const GlassIconButton = forwardRef<HTMLButtonElement, GlassIconButtonProps>(
  ({ className, label, children, ...props }, ref) => (
    <motion.button
      ref={ref}
      aria-label={label}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 340, damping: 22 }}
      className={cn(
        "flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-black/5 bg-white/40 text-ink backdrop-blur-md transition-colors hover:bg-white/60",
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
);
GlassIconButton.displayName = "GlassIconButton";
