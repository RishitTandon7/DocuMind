"use client";

import { createContext, useCallback, useContext, useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface SideNavContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SideNavContext = createContext<SideNavContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  searchOpen: false,
  openSearch: () => {},
  closeSearch: () => {},
});

export function useSideNav() {
  return useContext(SideNavContext);
}

export function SideNavProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((p) => !p), []);
  
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <SideNavContext.Provider value={{ isOpen, open, close, toggle, searchOpen, openSearch, closeSearch }}>
      {children}
    </SideNavContext.Provider>
  );
}
