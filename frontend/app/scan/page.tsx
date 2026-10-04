"use client";

/**
 * /scan — the scanner. One route, three views selected by the URL so the browser back button / swipe-back
 * behaves naturally on every screen:
 *
 *   /scan                              camera (live detection + auto-capture)
 *   /scan?view=adjust&page=<id>        adjust corners for a captured page (`&auto=1` runs detection on open,
 *                                      `&from=review` returns to the review grid afterwards)
 *   /scan?view=review                  page grid: reorder, rotate, delete, re-adjust
 *
 * The camera stream stays open underneath the other views so returning to it is instant. Pages live in the
 * scan session (IndexedDB-backed), so nothing captured is lost by navigating away or refreshing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suspense, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { usePendingUpload } from "@/components/providers/PendingUploadProvider";
import { useScanSession } from "@/components/providers/ScanSessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { AdjustCorners } from "@/components/scan/AdjustCorners";
import { CameraView, type CaptureResult } from "@/components/scan/CameraView";
import { PageReview } from "@/components/scan/PageReview";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { useOpenCv } from "@/hooks/useOpenCv";
import { useUploadFiles } from "@/hooks/useUploadFiles";
import { detectCornersForBlob } from "@/lib/detect";
import { orderCorners, rotateQuarterTurn, warpToBlob } from "@/lib/opencv";
import type { ScanPage } from "@/lib/scanStore";

function AdjustView({
  page,
  autoDetect,
  cv,
  onKeep,
  onRetake,
  onBack,
}: {
  page: ScanPage;
  autoDetect: boolean;
  cv: any;
  onKeep: (corners: number[][]) => Promise<void>;
  onRetake: () => void;
  onBack: () => void;
}) {
  const url = useObjectUrl(page.blob);
  const handleAuto = useCallback(() => detectCornersForBlob(page.blob, cv), [page.blob, cv]);

  if (!url) return null;
  return (
    <AdjustCorners
      imageUrl={url}
      width={page.width}
      height={page.height}
      initialCorners={page.corners}
      onKeep={onKeep}
      onRetake={onRetake}
      onAuto={handleAuto}
      onBack={onBack}
      autoRunOnMount={autoDetect}
    />
  );
}

function ScanFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const view = params.get("view") ?? "camera";
  const pageId = params.get("page");
  const autoDetect = params.get("auto") === "1";
  const origin = params.get("from");

  const { toast } = useToast();
  const { start } = usePendingUpload();
  const session = useScanSession();
  const { pages, allPages, ready } = session;
  const openCv = useOpenCv();
  const beginUpload = useUploadFiles();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.replace("/scan");
  }, [router]);

  // Anything captured but never kept is dropped once we're back on the camera.
  useEffect(() => {
    if (ready && view === "camera") session.discardUnconfirmed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view]);

  const adjustPage = view === "adjust" && pageId ? allPages.find((page) => page.id === pageId) : undefined;

  // A deep link to a page that no longer exists falls back to the camera.
  useEffect(() => {
    if (ready && view === "adjust" && !adjustPage) router.replace("/scan");
  }, [ready, view, adjustPage, router]);

  const handleCaptured = useCallback(
    (capture: CaptureResult) => {
      const page = session.addPage({
        blob: capture.blob,
        width: capture.width,
        height: capture.height,
        corners: capture.corners,
      });
      // No live quad locked → let the Adjust screen run the full detector on open.
      router.push(`/scan?view=adjust&page=${page.id}${capture.detected ? "" : "&auto=1"}`);
    },
    [router, session]
  );

  const handleKeep = useCallback(
    async (corners: number[][]) => {
      if (!adjustPage) return;
      const ordered = orderCorners(corners);
      const preview = await warpToBlob(openCv.cv, adjustPage.blob, ordered);
      session.updatePage(adjustPage.id, { corners: ordered, previewBlob: preview, confirmed: true });
      goBack();
    },
    [adjustPage, openCv.cv, session, goBack]
  );

  const handleRetake = useCallback(() => {
    if (!adjustPage) return;
    session.removePage(adjustPage.id);
    if (origin === "review") router.replace("/scan");
    else goBack();
  }, [adjustPage, origin, router, session, goBack]);

  const handleRotate = useCallback(
    async (id: string) => {
      const page = session.getPage(id);
      if (!page) return;
      try {
        const rotated = await rotateQuarterTurn(page.blob, page.corners);
        const preview = await warpToBlob(openCv.cv, rotated.blob, rotated.corners);
        session.updatePage(id, {
          blob: rotated.blob,
          width: rotated.width,
          height: rotated.height,
          corners: rotated.corners,
          previewBlob: preview,
        });
      } catch {
        toast({ message: "Couldn't rotate that page", tone: "error" });
      }
    },
    [openCv.cv, session, toast]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const page = session.getPage(id);
      if (!page) return;
      session.removePage(id);
      toast({
        message: "Page removed",
        actionLabel: "Undo",
        onAction: () => session.addPage({ ...page, confirmed: true }),
      });
    },
    [session, toast]
  );

  /** Create the document from every kept page. The upload runs behind the optimistic /document/new screen. */
  const handleDone = useCallback(() => {
    if (pages.length === 0) {
      toast("Capture at least one page first");
      return;
    }
    const files = pages.map((page, index) => new File([page.blob], `scan-${index + 1}.jpg`, { type: page.blob.type || "image/jpeg" }));
    const previews = pages.map((page) => URL.createObjectURL(page.previewBlob ?? page.blob));
    const stamp = new Date().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    start(files, {
      previews,
      corners: pages.map((page) => page.corners),
      name: `Scan ${stamp}`,
      onSuccess: () => session.clear(),
    });
    router.replace("/document/new");
  }, [pages, router, session, start, toast]);

  const lastPage = pages.length > 0 ? pages[pages.length - 1] : null;

  return (
    <>
      <CameraView
        active={view === "camera"}
        cv={openCv.cv}
        cvStatus={openCv.status}
        pageCount={pages.length}
        lastPage={lastPage ? lastPage.previewBlob ?? lastPage.blob : null}
        onCaptured={handleCaptured}
        onClose={() => (window.history.length > 1 ? router.back() : router.replace("/"))}
        onOpenReview={() => router.push("/scan?view=review")}
        onDone={handleDone}
        onPickFiles={() => fileInputRef.current?.click()}
      />

      {view === "adjust" && adjustPage && (
        <AdjustView
          key={adjustPage.id}
          page={adjustPage}
          autoDetect={autoDetect}
          cv={openCv.cv}
          onKeep={handleKeep}
          onRetake={handleRetake}
          onBack={goBack}
        />
      )}

      {view === "review" && (
        <PageReview
          pages={pages}
          onBack={goBack}
          onDone={handleDone}
          onOpen={(id) => router.push(`/scan?view=adjust&page=${id}&from=review`)}
          onDelete={handleDelete}
          onRotate={handleRotate}
          onReorder={session.reorder}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) beginUpload(files);
        }}
      />
    </>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-[#0d0d0d]" />}>
      <ScanFlow />
    </Suspense>
  );
}
