"use client";

/**
 * Polls a document's processing status until it reaches a terminal state
 * (completed/failed), and exposes it alongside loading/error state.
 */

import { useCallback, useEffect, useState } from "react";

import { ApiError, getDocumentStatus } from "@/lib/api";
import type { DocumentStatus, DocumentStatusResponse } from "@/types";

const TERMINAL_STATUSES: DocumentStatus[] = ["completed", "failed"];
const POLL_INTERVAL_MS = 2500;

export function useDocument(documentId: string) {
  const [document, setDocument] = useState<DocumentStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [version, setVersion] = useState(0);

  /** Restart polling — used after an edit (rotate, re-crop, rename) puts the document back into processing. */
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const status = await getDocumentStatus(documentId);
        if (cancelled) return;
        setDocument(status);
        setError(null);
        setIsLoading(false);

        if (!TERMINAL_STATUSES.includes(status.status)) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setDocument({
            document_id: documentId,
            filename: "Unknown",
            status: "failed",
            error_message: "This document was not found or has been deleted.",
            upload_time: "",
            completed_time: "",
          });
          setError(null);
          setIsLoading(false);
          return;
        }

        setError(err instanceof ApiError ? err.message : "Failed to load document status");
        setIsLoading(false);
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [documentId, version]);

  return { document, error, isLoading, reload };
}
