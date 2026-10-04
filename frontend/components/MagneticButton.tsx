"use client";

/**
 * Wraps a button so it eases toward the cursor when it comes within range
 * (max 6px displacement, spring-damped) — disabled on touch devices and
 * respects prefers-reduced-motion, per the animation spec's performance
 * rules.
 */

import { type ReactNode, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

import { useIsTouchDevice } from "@/hooks/useMediaQuery";
import type { MotionConflictingHandlers } from "@/lib/motion";
import { cn } from "@/lib/utils";

const MAGNETIC_RANGE = 80;
const MAX_DISPLACEMENT = 6;

interface MagneticButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, MotionConflictingHandlers> {
  children: ReactNode;
  className?: string;
}

export function MagneticButton({ children, className, ...props }: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const isTouch = useIsTouchDevice();
  const reducedMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 20, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 260, damping: 20, mass: 0.6 });
  const iconRotate = useSpring(useMotionValue(0), { stiffness: 260, damping: 20 });

  const disabled = isTouch || !!reducedMotion;

  const handleMouseMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = event.clientX - centerX;
    const distanceY = event.clientY - centerY;
    const distance = Math.hypot(distanceX, distanceY);

    if (distance < MAGNETIC_RANGE + rect.width / 2) {
      const pull = Math.min(1, (MAGNETIC_RANGE + rect.width / 2 - distance) / MAGNETIC_RANGE);
      x.set((distanceX / distance || 0) * MAX_DISPLACEMENT * pull);
      y.set((distanceY / distance || 0) * MAX_DISPLACEMENT * pull);
      iconRotate.set(Math.atan2(distanceY, distanceX) * (180 / Math.PI) * 0.05);
    } else {
      x.set(0);
      y.set(0);
      iconRotate.set(0);
    }
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    iconRotate.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={disabled ? undefined : { x: springX, y: springY }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 340, damping: 24 }}
      className={cn("transform-gpu", className)}
      {...props}
    >
      <motion.span style={disabled ? undefined : { rotate: iconRotate }} className="flex items-center justify-center">
        {children}
      </motion.span>
    </motion.button>
  );
}
