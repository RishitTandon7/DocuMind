"use client";

/** The most recent documents, refreshed on mount and whenever the tab regains focus (so a document that was
 * just scanned already appears in Recent when the user comes back to the landing page). */

import { useCallback, useEffect, useState } from "react";

import { listRecentDocuments } from "@/lib/api";
import type { DocumentSummary } from "@/types";

export function useRecentDocuments(limit = 8) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await listRecentDocuments(limit);
      setDocuments(response.documents);
    } catch {
      // keep whatever we had; the landing page works without Recent
    } finally {
      setLoaded(true);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  return { documents, loaded, refresh };
}
