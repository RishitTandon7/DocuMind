"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface StaggeredHeadlineProps {
  text: string;
  className?: string;
}

/** Splits text into words that rise + unblur + fade in, staggered 60ms apart. */
export function StaggeredHeadline({ text, className }: StaggeredHeadlineProps) {
  const words = text.split(" ");

  return (
    <h1 className={cn("text-balance", className)}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: index * 0.06, filter: { duration: 0.45, delay: index * 0.06 } }}
          className="mr-[0.28em] inline-block"
        >
          {word}
        </motion.span>
      ))}
    </h1>
  );
}
