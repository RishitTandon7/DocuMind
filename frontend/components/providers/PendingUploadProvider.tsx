"use client";

/**
 * Optimistic uploads. Choosing files or finishing a scan navigates to /document/new *immediately*, showing
 * object-URL previews of what the user just provided, while the real upload runs in the background here.
 * On success the /document/new screen swaps itself for /document/[id]; on failure the user gets a toast and an
 * on-screen Retry — captured pages are only cleared from the scan session once the server has them.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, uploadPages } from "@/lib/api";

export type PendingStatus = "uploading" | "error" | "done";

export interface PendingUpload {
  /** Object URLs for the pages being uploaded, in order. */
  previews: string[];
  name: string;
  status: PendingStatus;
  progress: number;
  error: string | null;
  documentId: string | null;
}

export interface StartUploadOptions {
  previews: string[];
  corners?: (number[][] | null)[];
  name?: string;
  /** Called once the server has accepted the document (e.g. to clear the scan session). */
  onSuccess?: () => void;
}

interface PendingUploadValue {
  pending: PendingUpload | null;
  start: (files: (File | Blob)[], options: StartUploadOptions) => void;
  retry: () => void;
  dismiss: () => void;
}

const PendingUploadContext = createContext<PendingUploadValue | null>(null);

export function usePendingUpload(): PendingUploadValue {
  const context = useContext(PendingUploadContext);
  if (!context) throw new Error("usePendingUpload must be used inside <PendingUploadProvider>");
  return context;
}

interface Job {
  files: (File | Blob)[];
  options: StartUploadOptions;
}

export function PendingUploadProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const jobRef = useRef<Job | null>(null);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const revokePreviews = useCallback((previews: string[]) => {
    previews.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const run = useCallback(
    async (job: Job) => {
      setPending((current) => (current ? { ...current, status: "uploading", progress: 0, error: null } : current));
      try {
        const response = await uploadPages(job.files, {
          corners: job.options.corners,
          name: job.options.name,
          onProgress: (fraction) => setPending((current) => (current ? { ...current, progress: fraction } : current)),
        });
        job.options.onSuccess?.();
        setPending((current) =>
          current ? { ...current, status: "done", progress: 1, documentId: response.document_id } : current
        );
        // The optimistic screen hands over to the real document within moments; release its previews after.
        window.setTimeout(() => {
          setPending((current) => {
            if (!current || current.status !== "done" || current.documentId !== response.document_id) return current;
            current.previews.forEach((url) => URL.revokeObjectURL(url));
            return null;
          });
        }, 15000);
        if (pathnameRef.current !== "/document/new") {
          toast({
            message: "Your document is ready",
            actionLabel: "Open",
            onAction: () => router.push(`/document/${response.document_id}`),
          });
        }
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Upload failed";
        setPending((current) => (current ? { ...current, status: "error", error: message } : current));
        toast({ message: `Upload failed — ${message}`, tone: "error", actionLabel: "Retry", onAction: () => retryRef.current() });
      }
    },
    [router, toast]
  );

  const retryRef = useRef<() => void>(() => undefined);

  const start = useCallback(
    (files: (File | Blob)[], options: StartUploadOptions) => {
      setPending((previous) => {
        if (previous) revokePreviews(previous.previews);
        return {
          previews: options.previews,
          name: options.name ?? "",
          status: "uploading",
          progress: 0,
          error: null,
          documentId: null,
        };
      });
      const job = { files, options };
      jobRef.current = job;
      void run(job);
    },
    [revokePreviews, run]
  );

  const retry = useCallback(() => {
    if (jobRef.current) void run(jobRef.current);
  }, [run]);

  retryRef.current = retry;

  const dismiss = useCallback(() => {
    setPending((previous) => {
      if (previous) revokePreviews(previous.previews);
      return null;
    });
    jobRef.current = null;
  }, [revokePreviews]);

  const value = useMemo(() => ({ pending, start, retry, dismiss }), [pending, start, retry, dismiss]);

  return <PendingUploadContext.Provider value={value}>{children}</PendingUploadContext.Provider>;
}
