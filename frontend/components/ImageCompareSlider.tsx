"use client";

import { useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";

import { resolveMediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ImageCompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

export function ImageCompareSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "After",
  className,
}: ImageCompareSliderProps) {
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
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-3xl border border-black/10 bg-black/5",
        className
      )}
      onMouseMove={(event) => isDragging && updatePosition(event.clientX)}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onTouchMove={(event) => updatePosition(event.touches[0].clientX)}
      onTouchEnd={() => setIsDragging(false)}
    >
      <img
        src={resolveMediaUrl(afterUrl)}
        alt={afterLabel}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        draggable={false}
      />
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={resolveMediaUrl(beforeUrl)}
          alt={beforeLabel}
          className="h-full max-w-none object-contain"
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
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-accent" />
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-ink shadow-lg">
          <MoveHorizontal className="h-4 w-4" />
        </div>
      </div>

      <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
        {beforeLabel}
      </span>
      <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
        {afterLabel}
      </span>
    </div>
  );
}
