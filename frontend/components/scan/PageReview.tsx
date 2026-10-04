"use client";

/**
 * Page review grid for the in-progress scan: drag a tile's grip to reorder, rotate or delete a page, tap a
 * page to re-adjust its corners. "Done" creates the document from all pages.
 */

import { useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { ArrowLeft, Check, GripVertical, Plus, RotateCw, Trash2 } from "lucide-react";

import { useObjectUrl } from "@/hooks/useObjectUrl";
import type { ScanPage } from "@/lib/scanStore";
import { cn } from "@/lib/utils";

interface PageReviewProps {
  pages: ScanPage[];
  onBack: () => void;
  onDone: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRotate: (id: string) => Promise<void>;
  onReorder: (ids: string[]) => void;
}

interface TileProps {
  page: ScanPage;
  index: number;
  isTarget: boolean;
  registerElement: (id: string, element: HTMLElement | null) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRotate: (id: string) => Promise<void>;
  onDragMove: (id: string, x: number, y: number) => void;
  onDrop: (id: string, x: number, y: number) => void;
}

function PageTile({ page, index, isTarget, registerElement, onOpen, onDelete, onRotate, onDragMove, onDrop }: TileProps) {
  const controls = useDragControls();
  const url = useObjectUrl(page.previewBlob ?? page.blob);
  const [rotating, setRotating] = useState(false);

  const pointer = (event: MouseEvent | TouchEvent | PointerEvent): [number, number] => {
    if ("clientX" in event) return [event.clientX, event.clientY];
    const touch = event.changedTouches[0];
    return [touch.clientX, touch.clientY];
  };

  return (
    <motion.li
      ref={(element) => registerElement(page.id, element)}
      layout
      drag
      dragControls={controls}
      dragListener={false}
      dragSnapToOrigin
      dragElastic={0.12}
      onDrag={(event) => onDragMove(page.id, ...pointer(event))}
      onDragEnd={(event) => onDrop(page.id, ...pointer(event))}
      whileDrag={{ scale: 1.06, zIndex: 30, boxShadow: "0 20px 40px rgba(0,0,0,0.35)" }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className={cn(
        "relative list-none overflow-hidden rounded-2xl bg-[#1c1c1c] ring-2 ring-transparent",
        isTarget && "ring-[#4ADE80]"
      )}
    >
      <button onClick={() => onOpen(page.id)} aria-label={`Adjust corners of page ${index + 1}`} className="block aspect-[3/4] w-full">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Page ${index + 1}`} draggable={false} className="h-full w-full object-contain" />
        )}
      </button>

      <span className="pointer-events-none absolute left-2 top-2 flex h-7 min-w-[28px] items-center justify-center rounded-full bg-black/60 px-2 text-xs font-bold text-white">
        {index + 1}
      </span>

      <button
        onPointerDown={(event) => controls.start(event)}
        aria-label={`Drag to reorder page ${index + 1}`}
        className="absolute right-1.5 top-1.5 flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-full bg-black/50 text-white active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
        <button
          onClick={async () => {
            setRotating(true);
            try {
              await onRotate(page.id);
            } finally {
              setRotating(false);
            }
          }}
          disabled={rotating}
          aria-label={`Rotate page ${index + 1}`}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
        >
          <RotateCw className={cn("h-4 w-4", rotating && "animate-spin")} />
        </button>
        <button
          onClick={() => onDelete(page.id)}
          aria-label={`Delete page ${index + 1}`}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-[#f87171]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.li>
  );
}

export function PageReview({ pages, onBack, onDone, onOpen, onDelete, onRotate, onReorder }: PageReviewProps) {
  const elements = useRef(new Map<string, HTMLElement>());
  const [targetId, setTargetId] = useState<string | null>(null);

  const registerElement = (id: string, element: HTMLElement | null) => {
    if (element) elements.current.set(id, element);
    else elements.current.delete(id);
  };

  /** The tile (other than the dragged one) under the pointer, if any. */
  const tileAt = (draggedId: string, x: number, y: number): string | null => {
    for (const [id, element] of elements.current) {
      if (id === draggedId) continue;
      const box = element.getBoundingClientRect();
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return id;
    }
    return null;
  };

  const handleDrop = (draggedId: string, x: number, y: number) => {
    const overId = tileAt(draggedId, x, y);
    setTargetId(null);
    if (!overId) return;
    const ids = pages.map((page) => page.id).filter((id) => id !== draggedId);
    ids.splice(ids.indexOf(overId) + (pages.findIndex((p) => p.id === draggedId) < pages.findIndex((p) => p.id === overId) ? 1 : 0), 0, draggedId);
    onReorder(ids);
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0d0d0d] text-white">
      <header className="flex h-14 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
        <button onClick={onBack} aria-label="Back to camera" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold">
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </h1>
        <button
          onClick={onDone}
          disabled={pages.length === 0}
          className="ml-auto flex min-h-[44px] items-center gap-1.5 rounded-full bg-cream px-5 text-sm font-bold text-ink disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Done
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
        {pages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/70">
            <p className="text-sm">No pages yet.</p>
            <button onClick={onBack} className="min-h-[44px] rounded-full bg-white/10 px-5 text-sm font-semibold text-white">
              Back to camera
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <AnimatePresence initial={false}>
              {pages.map((page, index) => (
                <PageTile
                  key={page.id}
                  page={page}
                  index={index}
                  isTarget={targetId === page.id}
                  registerElement={registerElement}
                  onOpen={onOpen}
                  onDelete={onDelete}
                  onRotate={onRotate}
                  onDragMove={(id, x, y) => setTargetId(tileAt(id, x, y))}
                  onDrop={handleDrop}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <footer className="shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2">
        <button
          onClick={onBack}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white/10 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          Add page
        </button>
      </footer>
    </div>
  );
}
