"use client";

/**
 * One of the three landing actions (Upload · Scan · Ask). On mobile it is a full-width 64px cream row with the
 * icon and label on the left and a chevron on the right (no rotation, no overlap); from `sm` up it becomes the
 * tilted floating pill. The same button either way, so every action is a real, focusable, disabled-aware control.
 */

import { forwardRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface ActionCardProps {
  icon: ReactNode;
  label: string;
  circleColor: string;
  rotate: number;
  delay: number;
  onClick: () => void;
  /** Small pill after the label, e.g. "3 pages". */
  badge?: string;
  /** Speech-bubble hint shown above the card, e.g. "Scan something first". */
  hint?: string | null;
  disabled?: boolean;
  disabledReason?: string;
  isArc?: boolean;
  motionStyle?: React.ComponentProps<typeof motion.button>["style"];
}

export const ActionCard = forwardRef<HTMLButtonElement, ActionCardProps>(function ActionCard(
  { icon, label, circleColor, rotate, delay, onClick, badge, hint, disabled, disabledReason, isArc, motionStyle },
  ref
) {
  const isMobile = useIsMobile();

  return (
    <div className={cn("relative", isArc ? "w-[120px]" : "w-full sm:w-56")}>
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-cream shadow-lg"
          >
            {hint}
            <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-ink" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        ref={ref}
        type="button"
        layout
        onClick={onClick}
        aria-disabled={disabled || undefined}
        title={disabled ? disabledReason : undefined}
        initial={isArc ? undefined : { opacity: 0, y: 24, rotate: 0, scale: 0.95 }}
        animate={isArc ? undefined : { opacity: disabled ? 0.55 : 1, y: 0, rotate: isMobile ? 0 : rotate, scale: 1 }}
        transition={isArc ? { layout: { type: "spring", stiffness: 200, damping: 24 } } : { type: "spring", stiffness: 220, damping: 24, delay }}
        whileHover={isMobile ? undefined : { rotate: 0, y: -6, scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        style={motionStyle}
        className={cn(
          "flex w-full items-center shadow-xl shadow-black/5 transform-gpu bg-cream",
          isArc
            ? "flex-col justify-start pt-6 gap-3 rounded-[32px] h-[160px]"
            : "h-16 min-h-[44px] gap-4 rounded-3xl px-4 text-left sm:h-auto sm:gap-3 sm:px-5 sm:py-4"
        )}
      >
        <span
          className={cn("flex shrink-0 items-center justify-center rounded-full", isArc ? "h-[56px] w-[56px]" : "h-10 w-10 sm:h-11 sm:w-11")}
          style={{ backgroundColor: circleColor }}
        >
          {icon}
        </span>
        <span className={cn("font-semibold text-ink", isArc ? "text-base text-center mt-1" : "text-base sm:text-sm")}>{label}</span>
        {badge && (
          <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-cream">{badge}</span>
        )}
        {!isArc && <ChevronRight className="ml-auto h-5 w-5 text-ink-soft sm:hidden" aria-hidden />}
      </motion.button>
    </div>
  );
});
