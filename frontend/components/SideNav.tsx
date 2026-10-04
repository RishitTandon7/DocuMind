"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Camera,
  CheckCircle,
  ChevronRight,
  Download,
  FileText,
  Home,
  LayoutGrid,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";

import { usePWA } from "@/components/providers/PWAProvider";
import { useSideNav } from "@/components/providers/SideNavProvider";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/documents", label: "Library", icon: LayoutGrid },
  { href: "/scan", label: "Scan", icon: Camera },
  { href: "/query", label: "Ask AI", icon: Sparkles },
];

export function SideNav() {
  const { isOpen, close, openSearch } = useSideNav();
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const pathname = usePathname();

  const handleInstall = useCallback(async () => {
    const accepted = await promptInstall();
    if (accepted) close();
  }, [promptInstall, close]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#111827] text-white shadow-2xl"
            role="navigation"
            aria-label="App navigation"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),20px)] pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold tracking-tight">DocuMind</div>
                  <div className="text-[10px] text-white/40 leading-none">Document Intelligence</div>
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Close menu"
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                      active
                        ? "bg-amber-500/20 text-amber-400"
                        : "text-white/70 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`w-4.5 h-4.5 shrink-0 transition-colors ${
                        active ? "text-amber-400" : "text-white/50 group-hover:text-white/80"
                      }`}
                    />
                    {label}
                    {active && (
                      <motion.span
                        layoutId="sidenav-active"
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400"
                      />
                    )}
                  </Link>
                );
              })}

              <div className="my-3 border-t border-white/8" />

              <Link
                href="/documents"
                onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/8 hover:text-white transition-all"
              >
                <BookOpen className="w-4.5 h-4.5 shrink-0 text-white/50" />
                All Documents
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/30" />
              </Link>
              <button
                onClick={() => {
                  close();
                  openSearch();
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/8 hover:text-white transition-all w-full text-left"
              >
                <Search className="w-4.5 h-4.5 shrink-0 text-white/50" />
                Search
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/30" />
              </button>
            </nav>

            {/* Footer: Install App */}
            <div className="px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 border-t border-white/10 space-y-2">
              {isInstalled ? (
                <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-green-500/15 text-green-400 text-sm">
                  <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                  <div>
                    <div className="font-semibold">App Installed</div>
                    <div className="text-xs text-green-400/70">Running as standalone app</div>
                  </div>
                </div>
              ) : isInstallable ? (
                <button
                  onClick={handleInstall}
                  id="pwa-install-btn"
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Download className="w-4.5 h-4.5 shrink-0" />
                  <div className="text-left">
                    <div>Install App</div>
                    <div className="text-[11px] font-normal text-white/75">Add to Home Screen</div>
                  </div>
                  <Smartphone className="w-4.5 h-4.5 ml-auto opacity-70" />
                </button>
              ) : (
                <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-white/5 text-white/40 text-sm">
                  <Smartphone className="w-4.5 h-4.5 shrink-0" />
                  <div>
                    <div className="font-medium">Install App</div>
                    <div className="text-xs text-white/30">Open in Chrome to install</div>
                  </div>
                </div>
              )}

              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/8 hover:text-white/80 transition-all">
                <Settings className="w-4 h-4 shrink-0" />
                Settings
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
