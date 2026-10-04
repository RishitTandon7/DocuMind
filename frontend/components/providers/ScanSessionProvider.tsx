"use client";

/**
 * The in-progress multi-page scan session. Held in React state for instant UI and mirrored into IndexedDB so
 * captured pages survive refreshes, back-swipes and crashes. Only *confirmed* pages ("Keep scan") count as
 * part of the document; an unconfirmed page is a capture still being adjusted.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  clearStoredPages,
  deleteStoredPage,
  loadStoredPages,
  storePage,
  type ScanPage,
} from "@/lib/scanStore";

export type NewScanPage = Omit<ScanPage, "id" | "order" | "confirmed" | "previewBlob"> & {
  previewBlob?: Blob | null;
  confirmed?: boolean;
  /** Explicit position (used to restore a deleted page in place); defaults to the end. */
  order?: number;
};

interface ScanSessionValue {
  /** Every stored page, unconfirmed included. */
  allPages: ScanPage[];
  /** Pages the user has kept, in document order. */
  pages: ScanPage[];
  ready: boolean;
  addPage: (page: NewScanPage) => ScanPage;
  updatePage: (id: string, patch: Partial<Omit<ScanPage, "id">>) => void;
  removePage: (id: string) => void;
  /** Reorder confirmed pages to match `ids` (a permutation of the confirmed page ids). */
  reorder: (ids: string[]) => void;
  /** Drop pages that were captured but never kept (e.g. the user backed out of the adjust screen). */
  discardUnconfirmed: () => void;
  clear: () => void;
  getPage: (id: string) => ScanPage | undefined;
}

const ScanSessionContext = createContext<ScanSessionValue | null>(null);

export function useScanSession(): ScanSessionValue {
  const context = useContext(ScanSessionContext);
  if (!context) throw new Error("useScanSession must be used inside <ScanSessionProvider>");
  return context;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ScanSessionProvider({ children }: { children: ReactNode }) {
  const [allPages, setAllPages] = useState<ScanPage[]>([]);
  const [ready, setReady] = useState(false);
  const pagesRef = useRef<ScanPage[]>([]);

  const commit = useCallback((next: ScanPage[]) => {
    pagesRef.current = next;
    setAllPages(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadStoredPages().then((stored) => {
      if (cancelled) return;
      // Pages already added in this tab before IndexedDB answered win over stale stored copies.
      const inMemory = pagesRef.current;
      const merged = [...stored.filter((page) => !inMemory.some((mine) => mine.id === page.id)), ...inMemory];
      commit(merged.sort((a, b) => a.order - b.order));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [commit]);

  const addPage = useCallback(
    (page: NewScanPage): ScanPage => {
      const order = page.order ?? pagesRef.current.reduce((max, existing) => Math.max(max, existing.order), -1) + 1;
      const created: ScanPage = {
        ...page,
        id: newId(),
        order,
        previewBlob: page.previewBlob ?? null,
        confirmed: page.confirmed ?? false,
      };
      commit([...pagesRef.current, created].sort((a, b) => a.order - b.order));
      void storePage(created);
      return created;
    },
    [commit]
  );

  const updatePage = useCallback(
    (id: string, patch: Partial<Omit<ScanPage, "id">>) => {
      const next = pagesRef.current.map((page) => (page.id === id ? { ...page, ...patch } : page));
      commit(next);
      const updated = next.find((page) => page.id === id);
      if (updated) void storePage(updated);
    },
    [commit]
  );

  const removePage = useCallback(
    (id: string) => {
      commit(pagesRef.current.filter((page) => page.id !== id));
      void deleteStoredPage(id);
    },
    [commit]
  );

  const reorder = useCallback(
    (ids: string[]) => {
      const orderById = new Map(ids.map((id, index) => [id, index]));
      const unconfirmed = pagesRef.current.filter((page) => !orderById.has(page.id));
      const next = pagesRef.current.map((page) =>
        orderById.has(page.id)
          ? { ...page, order: orderById.get(page.id)! }
          : { ...page, order: ids.length + unconfirmed.indexOf(page) }
      );
      commit(next.sort((a, b) => a.order - b.order));
      next.forEach((page) => void storePage(page));
    },
    [commit]
  );

  const discardUnconfirmed = useCallback(() => {
    const stale = pagesRef.current.filter((page) => !page.confirmed);
    if (stale.length === 0) return;
    commit(pagesRef.current.filter((page) => page.confirmed));
    stale.forEach((page) => void deleteStoredPage(page.id));
  }, [commit]);

  const clear = useCallback(() => {
    commit([]);
    void clearStoredPages();
  }, [commit]);

  const getPage = useCallback((id: string) => pagesRef.current.find((page) => page.id === id), []);

  const pages = useMemo(() => allPages.filter((page) => page.confirmed), [allPages]);

  const value = useMemo<ScanSessionValue>(
    () => ({ allPages, pages, ready, addPage, updatePage, removePage, reorder, discardUnconfirmed, clear, getPage }),
    [allPages, pages, ready, addPage, updatePage, removePage, reorder, discardUnconfirmed, clear, getPage]
  );

  return <ScanSessionContext.Provider value={value}>{children}</ScanSessionContext.Provider>;
}
