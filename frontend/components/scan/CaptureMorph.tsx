"use client";

/**
 * The "un-warp" after a capture: the frozen frame stays put while the detected quad flattens into a straight
 * rectangle over 0.4s (a real projective transform — the image is mapped with CSS matrix3d between the quad
 * and a centred rectangle of the document's aspect ratio — clipped to the quad so only the page is seen).
 */

import { useLayoutEffect, useRef } from "react";

import { lerpPoint, matrix3dFor, type Point } from "@/lib/homography";
import { quadSideLengths } from "@/lib/opencv";

export const MORPH_DURATION_MS = 400;

/** How an `object-cover` image of `imageW×imageH` is laid out inside a `cw×ch` box. */
export function coverMap(imageW: number, imageH: number, cw: number, ch: number) {
  const scale = Math.max(cw / imageW, ch / imageH);
  const dw = imageW * scale;
  const dh = imageH * scale;
  return { scale, dw, dh, ox: (cw - dw) / 2, oy: (ch - dh) / 2 };
}

interface CaptureMorphProps {
  url: string;
  imageW: number;
  imageH: number;
  /** Detected quad, normalised 0–1 (TL, TR, BR, BL); null skips the flatten and just holds the frame. */
  quad: number[][] | null;
  onDone: () => void;
}

export function CaptureMorph({ url, imageW, imageH, quad, onDone }: CaptureMorphProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Layout effect: the first frame is already clipped to the quad, so the full photo never flashes.
  useLayoutEffect(() => {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const map = coverMap(imageW, imageH, cw, ch);

    if (!quad) {
      const timer = window.setTimeout(() => doneRef.current(), 160);
      return () => window.clearTimeout(timer);
    }

    const local: Point[] = quad.map(([nx, ny]) => [nx * map.dw, ny * map.dh]);
    const from: Point[] = quad.map(([nx, ny]) => [map.ox + nx * map.dw, map.oy + ny * map.dh]);

    const { width, height } = quadSideLengths(quad.map(([nx, ny]) => [nx * imageW, ny * imageH]));
    const aspect = width / Math.max(height, 1);
    let rectW = cw * 0.86;
    let rectH = rectW / aspect;
    if (rectH > ch * 0.66) {
      rectH = ch * 0.66;
      rectW = rectH * aspect;
    }
    const rx = (cw - rectW) / 2;
    const ry = ch * 0.45 - rectH / 2;
    const to: Point[] = [
      [rx, ry],
      [rx + rectW, ry],
      [rx + rectW, ry + rectH],
      [rx, ry + rectH],
    ];

    const frame = (t: number) => {
      const dst = from.map((point, index) => lerpPoint(point, to[index], t));
      const matrix = matrix3dFor(local, dst);
      if (matrix && imageRef.current) imageRef.current.style.transform = matrix;
      if (wrapRef.current) {
        wrapRef.current.style.clipPath = `polygon(${dst.map(([x, y]) => `${x}px ${y}px`).join(",")})`;
      }
      if (scrimRef.current) scrimRef.current.style.opacity = String(0.88 * t);
    };

    frame(0);
    const startedAt = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / MORPH_DURATION_MS);
      frame(1 - Math.pow(1 - progress, 3)); // ease-out cubic
      if (progress < 1) raf = requestAnimationFrame(step);
      else doneRef.current();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [imageW, imageH, quad]);

  const map = typeof window === "undefined" ? null : coverMap(imageW, imageH, window.innerWidth, window.innerHeight);

  return (
    <div className="fixed inset-0 z-30 overflow-hidden">
      <div ref={scrimRef} className="absolute inset-0 bg-black opacity-0" />
      <div ref={wrapRef} className="absolute inset-0">
        {map && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imageRef}
            src={url}
            alt=""
            draggable={false}
            className="absolute left-0 top-0 max-w-none"
            style={{ width: map.dw, height: map.dh, transformOrigin: "0 0", transform: `translate(${map.ox}px, ${map.oy}px)` }}
          />
        )}
      </div>
    </div>
  );
}
