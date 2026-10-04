"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";

import { loadOpenCv } from "@/lib/opencv";

export type OpenCvState = { status: "loading"; cv: null } | { status: "ready"; cv: any } | { status: "failed"; cv: null };

/** Load OpenCV.js once and expose it; `failed` lets callers degrade gracefully (manual capture, bbox previews). */
export function useOpenCv(): OpenCvState {
  const [state, setState] = useState<OpenCvState>({ status: "loading", cv: null });

  useEffect(() => {
    let cancelled = false;
    loadOpenCv()
      .then(({ cv }) => !cancelled && setState({ status: "ready", cv }))
      .catch(() => !cancelled && setState({ status: "failed", cv: null }));
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
