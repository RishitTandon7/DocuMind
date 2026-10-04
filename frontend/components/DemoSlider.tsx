"use client";

/** A small draggable before/after preview on the landing page, using the bundled demo image pair. */

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { MoveHorizontal } from "lucide-react";

export function DemoSlider() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = (clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24, delay: 0.3 }}
      className="w-full max-w-lg rounded-3xl sm:max-w-md bg-cream p-2 shadow-xl shadow-black/5 sm:p-4"
    >
      <div
        ref={containerRef}
        className="relative aspect-video w-full touch-none select-none overflow-hidden rounded-2xl bg-black/5"
        onMouseMove={(event) => isDragging && updatePosition(event.clientX)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchMove={(event) => updatePosition(event.touches[0].clientX)}
        onTouchEnd={() => setIsDragging(false)}
      >
        <img
          src="/demo/after.jpg"
          alt="Clean, cropped scan result"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
          <img
            src="/demo/before.jpg"
            alt="Original messy photo"
            className="h-full max-w-none object-cover"
            style={{ width: containerRef.current?.clientWidth ?? "100%" }}
            draggable={false}
          />
        </div>

        <div
          className="absolute inset-y-0 z-10 flex w-1 min-w-[44px] -translate-x-1/2 cursor-ew-resize items-center justify-center"
          style={{ left: `${position}%` }}
          onMouseDown={() => setIsDragging(true)}
          onTouchStart={() => setIsDragging(true)}
        >
          <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white" />
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-lg">
            <MoveHorizontal className="h-4 w-4" />
          </div>
        </div>

        <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
          Before
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
          After
        </span>
      </div>
      <p className="mt-2 text-center text-xs text-ink-soft sm:mt-3 sm:text-sm">See what happens to a bad scan</p>
    </motion.div>
  );
}
