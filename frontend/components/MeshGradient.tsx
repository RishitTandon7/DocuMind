"use client";

/**
 * Full-viewport animated mesh gradient background — the single visual
 * theme used on every screen (mint, top-left; sky, top-right; peach,
 * bottom). Three blurred radial blobs drift independently on slow CSS
 * keyframe loops (transform-only, so they stay GPU-accelerated and
 * respect `animation-play-state` when the tab is hidden).
 */

import { useTabVisible } from "@/hooks/useTabVisible";
import { cn } from "@/lib/utils";

interface MeshGradientProps {
  className?: string;
}

const BLOBS = [
  { color: "#BFE3D0", top: "-10%", left: "-10%", size: "55vmax", anim: "animate-blob-1" },
  { color: "#A8D8D8", top: "-15%", right: "-15%", size: "60vmax", anim: "animate-blob-2" },
  { color: "#F5C98E", bottom: "-20%", left: "20%", size: "65vmax", anim: "animate-blob-3" },
];

export function MeshGradient({ className }: MeshGradientProps) {
  const tabVisible = useTabVisible();

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden bg-cream",
        !tabVisible && "[&_.mesh-blob]:[animation-play-state:paused]",
        className
      )}
      aria-hidden
    >
      {BLOBS.map((blob, index) => (
        <div
          key={index}
          className={cn("mesh-blob transform-gpu-layer", blob.anim)}
          style={{
            backgroundColor: blob.color,
            opacity: 0.55,
            width: blob.size,
            height: blob.size,
            top: blob.top,
            left: blob.left,
            right: blob.right,
            bottom: blob.bottom,
          }}
        />
      ))}
    </div>
  );
}
