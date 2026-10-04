"use client";

/**
 * Full-screen corner adjustment, used both right after a capture and later from the document view.
 *
 * Four draggable handles (44px touch targets) sit on the document's corners over the photo. While one is
 * dragged a magnifier loupe floats above the finger (below it near the top edge) — like iOS — so the corner can
 * be placed to the pixel without the finger hiding it. Bottom bar: Retake · Auto (re-run detection) · Keep.
 * Dragging uses pointer capture on the handle, so it behaves identically for touch, pen and mouse.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, Wand2 } from "lucide-react";

import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils";

const HANDLE_SIZE = 44;
const LOUPE_SIZE = 112;
const LOUPE_ZOOM = 2.6;

interface AdjustCornersProps {
  imageUrl: string;
  /** Natural size of the image; corners are expressed in these pixel coordinates. */
  width: number;
  height: number;
  initialCorners: number[][];
  title?: string;
  keepLabel?: string;
  onKeep: (corners: number[][]) => Promise<void> | void;
  /** Re-run detection; resolve to new corners, or null when no document was found. */
  onAuto: () => Promise<number[][] | null>;
  onRetake?: () => void;
  onBack: () => void;
  /** Run detection once on mount (used when the capture had no live-detected quad). */
  autoRunOnMount?: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function AdjustCorners({
  imageUrl,
  width,
  height,
  initialCorners,
  title = "Adjust corners",
  keepLabel = "Keep scan",
  onKeep,
  onAuto,
  onRetake,
  onBack,
  autoRunOnMount = false,
}: AdjustCornersProps) {
  const { toast } = useToast();
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [corners, setCorners] = useState<number[][]>(initialCorners);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [glide, setGlide] = useState(false);
  const autoRanRef = useRef(false);

  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const update = () => setStageSize({ w: element.clientWidth, h: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Where the image sits inside the stage (object-contain), and the px-per-image-px scale.
  const rect: Rect = (() => {
    if (!stageSize.w || !stageSize.h || !width || !height) return { x: 0, y: 0, w: 0, h: 0 };
    const scale = Math.min(stageSize.w / width, stageSize.h / height);
    const w = width * scale;
    const h = height * scale;
    return { x: (stageSize.w - w) / 2, y: (stageSize.h - h) / 2, w, h };
  })();
  const scale = rect.w / (width || 1);

  const toStage = useCallback(
    ([x, y]: number[]): [number, number] => [rect.x + x * scale, rect.y + y * scale],
    [rect.x, rect.y, scale]
  );

  const runAuto = useCallback(async () => {
    setDetecting(true);
    try {
      const detected = await onAuto();
      if (detected) {
        setGlide(true);
        setCorners(detected);
        window.setTimeout(() => setGlide(false), 350);
      } else {
        toast("Couldn't find the edges — drag the corners into place");
      }
    } catch {
      toast({ message: "Edge detection failed — drag the corners into place", tone: "error" });
    } finally {
      setDetecting(false);
    }
  }, [onAuto, toast]);

  useEffect(() => {
    if (autoRunOnMount && !autoRanRef.current) {
      autoRanRef.current = true;
      void runAuto();
    }
  }, [autoRunOnMount, runAuto]);

  const moveHandle = (index: number, event: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!stage || scale === 0) return;
    const bounds = stage.getBoundingClientRect();
    const x = Math.min(width, Math.max(0, (event.clientX - bounds.left - rect.x) / scale));
    const y = Math.min(height, Math.max(0, (event.clientY - bounds.top - rect.y) / scale));
    setCorners((current) => current.map((corner, i) => (i === index ? [x, y] : corner)));
  };

  const handleKeep = async () => {
    setSaving(true);
    try {
      await onKeep(corners);
    } catch {
      toast({ message: "Couldn't save that scan — try again", tone: "error" });
      setSaving(false);
    }
  };

  const busy = detecting || saving;
  const polygon = corners.map((corner) => toStage(corner).join(",")).join(" ");

  // Loupe placement: above the handle, or below it when there isn't room.
  const loupe = (() => {
    if (activeIndex === null || scale === 0) return null;
    const [hx, hy] = toStage(corners[activeIndex]);
    const above = hy - LOUPE_SIZE - 40 > 0;
    const left = Math.min(stageSize.w - LOUPE_SIZE - 8, Math.max(8, hx - LOUPE_SIZE / 2));
    const top = above ? hy - LOUPE_SIZE - 40 : hy + 40;
    const localX = (hx - rect.x) * LOUPE_ZOOM;
    const localY = (hy - rect.y) * LOUPE_ZOOM;
    return { left, top, localX, localY };
  })();

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0d0d0d] text-white">
      <header className="flex h-14 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
        <button
          onClick={onBack}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold">{title}</h1>
        {detecting && <span className="ml-auto pr-3 text-xs font-medium text-white/60">Detecting edges…</span>}
      </header>

      <div ref={stageRef} className="relative min-h-0 flex-1 touch-none select-none">
        {rect.w > 0 && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Captured page"
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            />

            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <mask id="adjust-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <polygon points={polygon} fill="black" style={{ transition: glide ? "all 300ms" : undefined }} />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#adjust-mask)" />
              <polygon
                points={polygon}
                fill="rgba(74,222,128,0.10)"
                stroke="#4ADE80"
                strokeWidth={2.5}
                strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 0 6px rgba(74,222,128,0.8))" }}
              />
            </svg>

            {corners.map((corner, index) => {
              const [sx, sy] = toStage(corner);
              return (
                <div
                  key={index}
                  role="slider"
                  aria-label={`Corner ${index + 1}`}
                  aria-valuetext={`${Math.round(corner[0])}, ${Math.round(corner[1])}`}
                  tabIndex={0}
                  onPointerDown={(event) => {
                    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                    setActiveIndex(index);
                    moveHandle(index, event);
                  }}
                  onPointerMove={(event) => activeIndex === index && moveHandle(index, event)}
                  onPointerUp={() => setActiveIndex(null)}
                  onPointerCancel={() => setActiveIndex(null)}
                  onKeyDown={(event) => {
                    const step = event.shiftKey ? 20 : 4;
                    const delta: Record<string, [number, number]> = {
                      ArrowLeft: [-step, 0],
                      ArrowRight: [step, 0],
                      ArrowUp: [0, -step],
                      ArrowDown: [0, step],
                    };
                    const move = delta[event.key];
                    if (!move) return;
                    event.preventDefault();
                    setCorners((current) =>
                      current.map((c, i) =>
                        i === index
                          ? [Math.min(width, Math.max(0, c[0] + move[0])), Math.min(height, Math.max(0, c[1] + move[1]))]
                          : c
                      )
                    );
                  }}
                  className="absolute flex cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                  style={{
                    left: sx - HANDLE_SIZE / 2,
                    top: sy - HANDLE_SIZE / 2,
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    transition: glide ? "left 300ms ease-out, top 300ms ease-out" : undefined,
                  }}
                >
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full border-2 border-white bg-[#4ADE80] shadow-[0_0_10px_rgba(74,222,128,0.9)] transition-transform",
                      activeIndex === index && "scale-125"
                    )}
                  />
                </div>
              );
            })}

            {loupe && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="pointer-events-none absolute overflow-hidden rounded-full border-2 border-white shadow-2xl"
                style={{ left: loupe.left, top: loupe.top, width: LOUPE_SIZE, height: LOUPE_SIZE }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: `${rect.w * LOUPE_ZOOM}px ${rect.h * LOUPE_ZOOM}px`,
                    backgroundPosition: `${LOUPE_SIZE / 2 - loupe.localX}px ${LOUPE_SIZE / 2 - loupe.localY}px`,
                  }}
                />
                <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#4ADE80]/80" />
                <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#4ADE80]/80" />
              </motion.div>
            )}
          </>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        {onRetake && (
          <button
            onClick={onRetake}
            disabled={busy}
            className="flex min-h-[48px] items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
            Retake
          </button>
        )}
        <button
          onClick={runAuto}
          disabled={busy}
          className="flex min-h-[48px] items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Wand2 className="h-4 w-4" />
          Auto
        </button>
        <button
          onClick={handleKeep}
          disabled={busy}
          className="ml-auto min-h-[48px] rounded-full bg-cream px-7 text-sm font-bold text-ink shadow-lg disabled:opacity-60"
        >
          {saving ? "Saving…" : keepLabel}
        </button>
      </footer>
    </div>
  );
}
