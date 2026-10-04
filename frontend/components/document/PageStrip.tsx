"use client";

/** Bottom page strip for multi-page documents: snap-scrolling thumbnails, the current page ringed. */

import { useEffect, useRef } from "react";

import { resolveMediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PageStripProps {
  /** One thumbnail URL per page (may be empty while a page is still processing). */
  thumbnails: string[];
  current: number;
  onSelect: (index: number) => void;
}

export function PageStrip({ thumbnails, current, onSelect }: PageStripProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    itemRefs.current[current]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [current]);

  return (
    <nav
      aria-label="Pages"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-cream/85 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur-xl"
    >
      <div className="scrollbar-hide mx-auto flex max-w-3xl snap-x scroll-px-4 gap-2 overflow-x-auto px-4">
        {thumbnails.map((url, index) => (
          <button
            key={index}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            onClick={() => onSelect(index)}
            aria-label={`Page ${index + 1}`}
            aria-current={index === current ? "page" : undefined}
            className={cn(
              "relative h-16 w-12 shrink-0 snap-center overflow-hidden rounded-lg bg-black/5 ring-2 transition-shadow",
              index === current ? "ring-ink" : "ring-transparent opacity-70"
            )}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveMediaUrl(url)} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="skeleton-light absolute inset-0" />
            )}
            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[9px] font-bold text-white">
              {index + 1}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
