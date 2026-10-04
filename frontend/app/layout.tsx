import type { Metadata, Viewport } from "next";

import { AppProviders } from "@/components/providers/AppProviders";
import { Onboarding } from "@/components/Onboarding";
import { InteractiveTour } from "@/components/InteractiveTour";

import "./globals.css";

export const metadata: Metadata = {
  title: "DocuMind — Document Intelligence",
  description:
    "Drop in a messy document and DocuMind restores, reads, and understands it — then answers your questions.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DocuMind",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#1a1a2e",
    "msapplication-tap-highlight": "no",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDF6EC" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a2e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* PWA Icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        {/* iOS splash / standalone */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DocuMind" />
        {/* Prevent tap highlight on iOS */}
        <meta name="format-detection" content="telephone=no" />
        {/*
          Chrome can fire `beforeinstallprompt` before the app's React bundle finishes hydrating and
          attaches its own listener (inside a useEffect), losing the event permanently for that page load.
          Capturing it here, synchronously, as early as possible in <head>, guarantees nothing is missed —
          PWAProvider reads window.__deferredInstallPrompt on mount instead of relying solely on the event.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('beforeinstallprompt', function(e) {
              e.preventDefault();
              window.__deferredInstallPrompt = e;
            });`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <AppProviders>
          {children}
          {/* We keep both, but they trigger separately. InteractiveTour handles the spotlight hover. */}
          <InteractiveTour />
        </AppProviders>
      </body>
    </html>
  );
}
