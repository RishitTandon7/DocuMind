"use client";

/**
 * Global tap feedback: a light haptic tick (Android; iOS Safari ignores vibrate) the instant any button or
 * link is pressed. The visual half (scale 0.97) is pure CSS `:active` in globals.css so it lands on the very
 * first frame — well inside the 100ms budget — with no JS on the critical path.
 */

import { useEffect } from "react";

import { haptic } from "@/lib/haptics";

const PRESSABLE = "button, a[href], [role='button'], summary, label[for]";

export function TapFeedback() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const pressable = target?.closest?.(PRESSABLE);
      if (!pressable) return;
      if ((pressable as HTMLButtonElement).disabled || pressable.getAttribute("aria-disabled") === "true") return;
      if (pressable.hasAttribute("data-no-haptic")) return;
      haptic(8);
    };
    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, []);

  return null;
}
