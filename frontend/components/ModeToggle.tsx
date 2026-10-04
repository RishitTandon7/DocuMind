"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { ScanMode } from "@/types";

const MODES: { key: ScanMode; label: string }[] = [
  { key: "color", label: "Color" },
  { key: "grayscale", label: "Grayscale" },
  { key: "bw", label: "B&W" },
];

interface ModeToggleProps {
  mode: ScanMode;
  onChange: (mode: ScanMode) => void;
  disabledModes?: ScanMode[];
}

export function ModeToggle({ mode, onChange, disabledModes = [] }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-cream p-1 shadow-md shadow-black/5">
      {MODES.map((option) => {
        const isActive = mode === option.key;
        const isDisabled = disabledModes.includes(option.key);
        return (
          <button
            key={option.key}
            onClick={() => !isDisabled && onChange(option.key)}
            disabled={isDisabled}
            className={cn(
              "relative min-h-[36px] rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30",
              isActive ? "text-cream" : "text-ink-soft hover:text-ink"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="mode-toggle-indicator"
                transition={{ type: "spring", stiffness: 340, damping: 30 }}
                className="absolute inset-0 rounded-full bg-ink"
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
