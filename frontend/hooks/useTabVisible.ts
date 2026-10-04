"use client";

import { useEffect, useState } from "react";

/** True while the browser tab is visible — used to pause infinite animations (beams, blobs) when hidden. */
export function useTabVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => setVisible(document.visibilityState === "visible");
    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return visible;
}
