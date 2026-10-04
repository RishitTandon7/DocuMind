"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;    // px to pull before releasing triggers refresh
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 72,
  disabled = false,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const trigger = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current ?? window;
    if (disabled) return;

    const getScrollTop = () =>
      containerRef.current
        ? containerRef.current.scrollTop
        : window.scrollY;

    const onTouchStart = (e: Event) => {
      const touch = (e as TouchEvent).touches[0];
      if (getScrollTop() <= 0) {
        startY.current = touch.clientY;
      }
    };

    const onTouchMove = (e: Event) => {
      if (startY.current === null || isRefreshing) return;
      const touch = (e as TouchEvent).touches[0];
      const dist = Math.max(0, touch.clientY - startY.current);
      // Apply resistance
      setPullDistance(Math.min(threshold * 1.5, dist * 0.5));
    };

    const onTouchEnd = () => {
      if (pullDistance >= threshold) {
        trigger();
      } else {
        setPullDistance(0);
      }
      startY.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [disabled, isRefreshing, pullDistance, threshold, trigger]);

  return { pullDistance, isRefreshing, containerRef };
}
