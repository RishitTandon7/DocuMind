"use client";

/** Animates a number counting up with spring physics whenever `value` changes. */

import { useEffect, useRef } from "react";
import { useReducedMotion, useSpring } from "framer-motion";

interface CountUpProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

export function CountUp({ value, decimals = 1, suffix = "", className }: CountUpProps) {
  const reducedMotion = useReducedMotion();
  const nodeRef = useRef<HTMLSpanElement>(null);
  const spring = useSpring(0, reducedMotion ? { stiffness: 1000, damping: 100 } : { stiffness: 120, damping: 20 });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      if (nodeRef.current) {
        nodeRef.current.textContent = `${latest.toFixed(decimals)}${suffix}`;
      }
    });
    return unsubscribe;
  }, [spring, decimals, suffix]);

  return (
    <span ref={nodeRef} className={className}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
