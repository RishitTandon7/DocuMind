"use client";

/**
 * A bottom sheet with a dimmed backdrop: swipe down (or tap the backdrop / press Escape) to dismiss. Padding
 * respects the home-indicator safe area. On wide screens it sits centred with a max width instead of
 * spanning the viewport.
 */

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            role="dialog"
            aria-label={title}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="relative flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-4xl bg-cream shadow-2xl"
          >
            {/* Only the header starts a swipe-down, so scrolling and sliders inside the sheet never fight it. */}
            <div className="flex touch-none justify-center pt-3" onPointerDown={(event) => controls.start(event)}>
              <div className="h-1.5 w-12 rounded-full bg-black/15" />
            </div>
            <div className="flex touch-none items-center justify-between px-6 pb-2 pt-3" onPointerDown={(event) => controls.start(event)}>
              <h2 className="text-lg font-bold tracking-tightest text-ink">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
