"use client";

import type { ReactNode } from "react";

import { PendingUploadProvider } from "@/components/providers/PendingUploadProvider";
import { PWAProvider } from "@/components/providers/PWAProvider";
import { ScanSessionProvider } from "@/components/providers/ScanSessionProvider";
import { SideNavProvider } from "@/components/providers/SideNavProvider";
import { TapFeedback } from "@/components/providers/TapFeedback";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { GlobalSearchOverlay } from "@/components/GlobalSearchOverlay";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ScanSessionProvider>
        <PendingUploadProvider>
          <PWAProvider>
            <SideNavProvider>
              <TapFeedback />
              <GlobalSearchOverlay />
              {children}
            </SideNavProvider>
          </PWAProvider>
        </PendingUploadProvider>
      </ScanSessionProvider>
    </ToastProvider>
  );
}
