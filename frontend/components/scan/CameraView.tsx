"use client";

/**
 * The scanner's live camera screen.
 *
 * - Full-bleed rear-camera video on a dark backdrop, cream 72px shutter bottom-centre, flash + close in the
 *   top corners, and bottom-left the last kept page with a page-count badge.
 * - Live edge detection: every ~150ms a ≤480px copy of the frame goes through OpenCV.js; the detected quad is
 *   drawn as a glowing green outline on a canvas overlay, lerp-smoothed so it doesn't jitter.
 * - Auto-capture: when the smoothed quad's corners move < 2% for 1.2s the outline pulses, "Hold still…"
 *   shows, and the shot fires by itself. The manual shutter always works. After a capture, auto-capture
 *   re-arms only once the camera has moved to a new page (the quad was lost, or moved > 12%), so it never
 *   re-shoots the page you just kept.
 * - After capture: freeze frame → 0.4s un-warp morph → hand over to the Adjust screen.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, ImageIcon, X, Zap, ZapOff } from "lucide-react";

import { CaptureMorph, coverMap } from "@/components/scan/CaptureMorph";
import { useToast } from "@/components/providers/ToastProvider";
import { useCameraStream } from "@/hooks/useCameraStream";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { haptic } from "@/lib/haptics";
import { canvasToBlob, defaultCorners, detectDocumentQuad } from "@/lib/opencv";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DETECT_INTERVAL_MS = 150;
const DETECT_MAX_DIMENSION = 480;
const STABLE_MOVEMENT = 0.02;
const STABLE_HOLD_MS = 1200;
const LOST_GRACE_MS = 350;
const REARM_LOST_MS = 700;
const REARM_MOVEMENT = 0.12;
const AUTO_KEY = "documind.autoCapture";

type Quad = number[][];

export interface CaptureResult {
  blob: Blob;
  width: number;
  height: number;
  /** Corners in image pixels — the live quad if one was locked, otherwise an inset default. */
  corners: Quad;
  /** True when the corners came from live detection (so the Adjust screen needn't re-detect). */
  detected: boolean;
}

interface CameraViewProps {
  /** False while the Adjust / Review screens cover the camera: the stream stays warm, detection pauses. */
  active: boolean;
  cv: any | null;
  cvStatus: "loading" | "ready" | "failed";
  pageCount: number;
  lastPage: Blob | null;
  onCaptured: (capture: CaptureResult) => void;
  onClose: () => void;
  onOpenReview: () => void;
  onDone: () => void;
  onPickFiles: () => void;
}

const lerpQuad = (from: Quad, to: Quad, t: number): Quad =>
  from.map(([x, y], i) => [x + (to[i][0] - x) * t, y + (to[i][1] - y) * t]);

const maxDisplacement = (a: Quad, b: Quad): number =>
  Math.max(...a.map(([x, y], i) => Math.max(Math.abs(x - b[i][0]), Math.abs(y - b[i][1]))));

export function CameraView({
  active,
  cv,
  cvStatus,
  pageCount,
  lastPage,
  onCaptured,
  onClose,
  onOpenReview,
  onDone,
  onPickFiles,
}: CameraViewProps) {
  const { toast } = useToast();
  const { videoRef, status, torchSupported, torchOn, toggleTorch, restart } = useCameraStream();

  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef<Quad | null>(null);
  const displayRef = useRef<Quad | null>(null);
  const alphaRef = useRef(0);
  const holdRef = useRef(0);
  const busyRef = useRef(false);
  const detector = useRef({
    lastSeen: 0,
    stableRef: null as Quad | null,
    stableSince: 0,
    armed: true,
    lostSince: 0,
    lastCaptured: null as Quad | null,
  });

  const [autoCapture, setAutoCapture] = useState(true);
  const autoRef = useRef(true);
  const [holdProgress, setHoldProgress] = useState(0);
  const [hasQuad, setHasQuad] = useState(false);
  const [flash, setFlash] = useState(false);
  const [frozen, setFrozen] = useState<{ url: string; w: number; h: number; quad: Quad | null } | null>(null);
  const pendingCaptureRef = useRef<CaptureResult | null>(null);

  // While the Adjust / Review screens cover the camera, its controls must not be focusable or announced.
  useEffect(() => {
    if (rootRef.current) (rootRef.current as HTMLElement & { inert: boolean }).inert = !active;
  }, [active]);

  const thumbUrl = useObjectUrl(lastPage);
  const live = status === "live";

  // Remember the auto-capture preference.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(AUTO_KEY);
      if (stored !== null) {
        setAutoCapture(stored === "1");
        autoRef.current = stored === "1";
      }
    } catch {
      // storage blocked: default on
    }
  }, []);

  const toggleAuto = () => {
    const next = !autoRef.current;
    autoRef.current = next;
    setAutoCapture(next);
    try {
      window.localStorage.setItem(AUTO_KEY, next ? "1" : "0");
    } catch {
      // preference just won't persist
    }
  };

  // ------------------------------------------------------------------ capture
  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busyRef.current || !video.videoWidth) return;
    busyRef.current = true;
    haptic(15);

    const width = video.videoWidth;
    const height = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(video, 0, 0);

    const quad = targetRef.current ? targetRef.current.map(([x, y]) => [x, y]) : null;
    try {
      const blob = await canvasToBlob(canvas, 0.92);
      pendingCaptureRef.current = {
        blob,
        width,
        height,
        corners: quad ? quad.map(([x, y]) => [x * width, y * height]) : defaultCorners(width, height),
        detected: Boolean(quad),
      };
      const s = detector.current;
      s.armed = false;
      s.lastCaptured = quad;
      s.lostSince = 0;
      holdRef.current = 0;
      setHoldProgress(0);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
      setFrozen({ url: URL.createObjectURL(blob), w: width, h: height, quad });
    } catch {
      busyRef.current = false;
      toast({ message: "Couldn't capture that frame — try again", tone: "error" });
    }
  }, [toast, videoRef]);

  const finishMorph = useCallback(() => {
    const result = pendingCaptureRef.current;
    pendingCaptureRef.current = null;
    if (result) onCaptured(result);
    // Release the freeze a moment after navigation so the camera doesn't flash back into view.
    window.setTimeout(() => {
      setFrozen((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return null;
      });
      busyRef.current = false;
    }, 250);
  }, [onCaptured]);

  const captureRef = useRef(capture);
  captureRef.current = capture;

  // ------------------------------------------------------------ detection loop
  useEffect(() => {
    if (!active || !live || !cv) return;

    const sample = (sampleRef.current ??= document.createElement("canvas"));
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.videoWidth || busyRef.current) return;

      const scale = Math.min(1, DETECT_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
      sample.width = Math.round(video.videoWidth * scale);
      sample.height = Math.round(video.videoHeight * scale);
      sample.getContext("2d", { willReadFrequently: true })!.drawImage(video, 0, 0, sample.width, sample.height);

      const quad = detectDocumentQuad(cv, sample);
      const now = performance.now();
      const s = detector.current;

      if (quad) {
        targetRef.current = targetRef.current ? lerpQuad(targetRef.current, quad, 0.5) : quad;
        s.lastSeen = now;
        s.lostSince = 0;
      } else if (now - s.lastSeen > LOST_GRACE_MS) {
        targetRef.current = null;
      }
      const target = targetRef.current;

      // Re-arm auto-capture once the camera has moved on from the page we just shot.
      if (!s.armed) {
        if (!target) {
          if (!s.lostSince) s.lostSince = now;
          if (now - s.lostSince > REARM_LOST_MS) s.armed = true;
        } else if (s.lastCaptured && maxDisplacement(target, s.lastCaptured) > REARM_MOVEMENT) {
          s.armed = true;
        }
      }

      if (target) {
        if (!s.stableRef || maxDisplacement(target, s.stableRef) > STABLE_MOVEMENT) {
          s.stableRef = target.map(([x, y]) => [x, y]);
          s.stableSince = now;
        }
        const held = now - s.stableSince;
        const progress = s.armed && autoRef.current ? Math.min(1, held / STABLE_HOLD_MS) : 0;
        holdRef.current = progress;
        setHoldProgress(progress > 0.12 ? progress : 0);
        if (progress >= 1) void captureRef.current();
      } else {
        s.stableRef = null;
        holdRef.current = 0;
        setHoldProgress(0);
      }
      setHasQuad(Boolean(target));
    }, DETECT_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      targetRef.current = null;
      holdRef.current = 0;
      setHoldProgress(0);
      setHasQuad(false);
    };
  }, [active, live, cv, videoRef]);

  // ------------------------------------------------------------- overlay draw
  useEffect(() => {
    if (!live) return;
    let raf = 0;

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      const canvas = overlayRef.current;
      const video = videoRef.current;
      if (!canvas || !video || !video.videoWidth) return;

      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const target = targetRef.current;
      if (target) {
        displayRef.current = displayRef.current ? lerpQuad(displayRef.current, target, 0.3) : target.map(([x, y]) => [x, y]);
        alphaRef.current = Math.min(1, alphaRef.current + 0.15);
      } else {
        alphaRef.current = Math.max(0, alphaRef.current - 0.1);
        if (alphaRef.current === 0) displayRef.current = null;
      }
      const display = displayRef.current;
      if (!display || alphaRef.current <= 0) return;

      const map = coverMap(video.videoWidth, video.videoHeight, cw, ch);
      const points = display.map(([nx, ny]) => [map.ox + nx * map.dw, map.oy + ny * map.dh]);

      const progress = holdRef.current;
      const pulse = progress > 0 ? Math.sin(time / 110) * 0.5 + 0.5 : 0;

      ctx.globalAlpha = alphaRef.current;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = `rgba(74, 222, 128, ${0.1 + progress * 0.16 + pulse * 0.08})`;
      ctx.fill();
      ctx.lineJoin = "round";
      ctx.lineWidth = 3 + pulse * 3 * progress;
      ctx.strokeStyle = "#4ADE80";
      ctx.shadowColor = "rgba(74, 222, 128, 0.95)";
      ctx.shadowBlur = 14 + pulse * 14 * progress;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#4ADE80";
      points.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [live, videoRef]);

  // ------------------------------------------------------------------- render
  const statusText = (() => {
    if (!live) return "";
    if (cvStatus === "loading") return "Loading edge detection…";
    if (cvStatus === "failed") return "Edge detection unavailable — tap the shutter";
    if (holdProgress > 0) return "Hold still…";
    if (!autoCapture) return hasQuad ? "Document found" : "Auto-capture off";
    return hasQuad ? "Document found" : "Looking for a document…";
  })();

  const handleFlash = async () => {
    if (!torchSupported) {
      toast("Flash isn't available on this camera");
      return;
    }
    if (!(await toggleTorch())) toast("Couldn't switch the flash");
  };

  return (
    <div ref={rootRef} aria-hidden={!active || undefined} className="fixed inset-0 z-20 overflow-hidden bg-[#0d0d0d] text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-300", live ? "opacity-100" : "opacity-0")}
      />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute inset-0 z-[25] bg-white"
          />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pb-8 pt-[calc(env(safe-area-inset-top)+8px)]">
        <button
          onClick={onClose}
          aria-label="Close camera"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
        >
          <X className="h-5 w-5" />
        </button>

        <button
          onClick={toggleAuto}
          aria-pressed={autoCapture}
          className={cn(
            "flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold backdrop-blur-md",
            autoCapture ? "bg-[#4ADE80]/25 text-[#b6f5cd]" : "bg-black/40 text-white/70"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", autoCapture ? "bg-[#4ADE80]" : "bg-white/50")} />
          Auto {autoCapture ? "on" : "off"}
        </button>

        <div className="flex items-center gap-2">
          {pageCount > 0 && (
            <button
              onClick={onDone}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-cream px-4 text-sm font-bold text-ink shadow-lg"
            >
              <Check className="h-4 w-4" />
              Done
            </button>
          )}
          <button
            onClick={handleFlash}
            aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
            aria-disabled={!torchSupported || undefined}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md",
              torchOn ? "bg-[#FBBF24] text-black" : "bg-black/40",
              !torchSupported && "opacity-50"
            )}
          >
            {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Status chip */}
      <AnimatePresence mode="wait">
        {statusText && (
          <motion.div
            key={statusText}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+64px)] z-10 flex flex-col items-center gap-2"
          >
            <span
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold backdrop-blur-md",
                holdProgress > 0 ? "bg-[#4ADE80] text-black" : "bg-black/45 text-white/90"
              )}
            >
              {statusText}
            </span>
            {holdProgress > 0 && (
              <span className="h-1 w-28 overflow-hidden rounded-full bg-white/25">
                <span className="block h-full rounded-full bg-[#4ADE80]" style={{ width: `${holdProgress * 100}%` }} />
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-12">
        <div className="w-16">
          {pageCount > 0 && thumbUrl ? (
            <button onClick={onOpenReview} aria-label={`Review ${pageCount} pages`} className="relative block h-14 w-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl} alt="Last page" className="h-full w-full rounded-xl border-2 border-white object-cover" />
              <span className="absolute -right-2 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-cream px-1.5 text-xs font-bold text-ink shadow">
                {pageCount}
              </span>
            </button>
          ) : (
            <button
              onClick={() => toast("Pages you capture will appear here")}
              aria-disabled
              aria-label="No pages yet"
              className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/40 text-white/50"
            >
              <Camera className="h-5 w-5" />
            </button>
          )}
        </div>

        <motion.button
          onClick={() => void capture()}
          disabled={!live}
          whileTap={{ scale: 0.92 }}
          aria-label="Capture"
          className="flex h-[88px] w-[88px] items-center justify-center rounded-full border-4 border-white/70 disabled:opacity-40"
        >
          <span className="block h-[72px] w-[72px] rounded-full bg-cream shadow-lg" />
        </motion.button>

        <div className="flex w-16 justify-end">
          <button
            onClick={onPickFiles}
            aria-label="Choose from files"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Camera states */}
      {!live && (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-4 px-8 text-center">
          {status === "starting" ? (
            <p className="text-sm font-medium text-white/70">Starting camera…</p>
          ) : (
            <>
              <Camera className="h-10 w-10 text-white/60" />
              <p className="max-w-xs text-sm text-white/80">
                {status === "denied"
                  ? "Camera access is blocked. Allow it in your browser's site settings, then try again."
                  : status === "unavailable"
                  ? "No camera found on this device."
                  : "The camera couldn't start."}
              </p>
              <div className="flex gap-2">
                <button onClick={() => void restart()} className="min-h-[44px] rounded-full bg-white/15 px-5 text-sm font-semibold">
                  Try again
                </button>
                <button onClick={onPickFiles} className="min-h-[44px] rounded-full bg-cream px-5 text-sm font-semibold text-ink">
                  Pick a file
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {frozen && <CaptureMorph url={frozen.url} imageW={frozen.w} imageH={frozen.h} quad={frozen.quad} onDone={finishMorph} />}
    </div>
  );
}
