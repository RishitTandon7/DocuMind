"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

export function StageFlipIcon({ complete }: { complete: boolean }) {
  return (
    <div className="relative h-6 w-6 [perspective:400px]">
      <motion.div
        animate={{ rotateY: complete ? 180 : 0 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        <div className="absolute inset-0 flex items-center justify-center rounded-full border border-black/10 bg-white/70 [backface-visibility:hidden]">
          <motion.span
            animate={!complete ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
            transition={{ duration: 1.4, repeat: complete ? 0 : Infinity }}
            className="h-2 w-2 rounded-full bg-accent"
          />
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center rounded-full bg-success/20 text-success [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          <Check className="h-3.5 w-3.5" />
        </div>
      </motion.div>
    </div>
  );
}
