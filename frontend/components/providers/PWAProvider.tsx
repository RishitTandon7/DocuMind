"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __deferredInstallPrompt?: BeforeInstallPromptEvent;
  }
}

interface PWAContextValue {
  isInstallable: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<boolean>;
  swRegistered: boolean;
}

const PWAContext = createContext<PWAContextValue>({
  isInstallable: false,
  isInstalled: false,
  promptInstall: async () => false,
  swRegistered: false,
});

export function usePWA() {
  return useContext(PWAContext);
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://");
    setIsInstalled(isStandalone);

    // The event may have already fired and been caught by the early <head> script (see layout.tsx)
    // before this effect ever ran — pick it up immediately instead of waiting for another firing.
    if (window.__deferredInstallPrompt) {
      deferredPrompt.current = window.__deferredInstallPrompt;
      setIsInstallable(true);
    }

    // Listen for install prompt
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPrompt.current = null;
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Register service worker — but first unregister any stale SWs and
    // clear old caches so stale JS bundles can never be served again.
    if ("serviceWorker" in navigator) {
      // 1. Unregister all existing service workers that aren't our current sw.js
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        const stale = registrations.filter(
          (r) => r.active?.scriptURL && !r.active.scriptURL.endsWith("/sw.js")
        );
        return Promise.all(stale.map((r) => r.unregister()));
      });

      // 2. Delete any caches named with old versions
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            // Keep only v3 caches — delete anything older
            if (!key.includes("-v3")) {
              caches.delete(key);
              console.log("[PWA] Deleted stale cache:", key);
            }
          });
        });
      }

      // 3. Register new SW
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          setSwRegistered(true);
          // Force immediate update check
          reg.update();
          console.log("[PWA] SW registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] SW registration failed:", err);
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt.current) return false;
    await deferredPrompt.current.prompt();
    const result = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setIsInstallable(false);
    return result.outcome === "accepted";
  }, []);

  return (
    <PWAContext.Provider value={{ isInstallable, isInstalled, promptInstall, swRegistered }}>
      {children}
    </PWAContext.Provider>
  );
}
