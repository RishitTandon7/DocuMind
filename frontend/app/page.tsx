"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDropzone, type FileRejection } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp, Camera, Edit3, FileSearch, HelpCircle,
  LayoutGrid, Pencil, QrCode, Scissors, Search,
  ScanLine, Sparkles, User, Smartphone
} from "lucide-react";

import { ActionCard } from "@/components/ActionCard";
import { AskSheet } from "@/components/AskSheet";
import { DemoSlider } from "@/components/DemoSlider";
import { HamburgerButton } from "@/components/HamburgerButton";
import { MagneticButton } from "@/components/MagneticButton";
import { MeshGradient } from "@/components/MeshGradient";
import { StaggeredHeadline } from "@/components/StaggeredHeadline";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useScanSession } from "@/components/providers/ScanSessionProvider";
import { useSideNav } from "@/components/providers/SideNavProvider";
import { usePWA } from "@/components/providers/PWAProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { RecentDocuments } from "@/components/RecentDocuments";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { GlassIconButton } from "@/components/ui/GlassIconButton";
import { useRecentDocuments } from "@/hooks/useRecentDocuments";
import { useUploadFiles } from "@/hooks/useUploadFiles";
import { checkCamera } from "@/lib/camera";

const ACCEPTED_TYPES = {
  "image/*": [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp", ".heic"],
  "application/pdf": [".pdf"],
};

const USERNAME_KEY = "documind_username";

// ─── App Loading Screen ───────────────────────────────────────────────────────
function AppLoader() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#FDF6EC]"
    >
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.45, 0.65, 0.45] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#D9CEF2] blur-[100px]"
        />
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          className="absolute bottom-0 left-1/3 h-[320px] w-[320px] rounded-full bg-[#A8D8D8] blur-[90px]"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          className="absolute bottom-10 right-1/4 h-[280px] w-[280px] rounded-full bg-[#F5C98E] blur-[80px]"
        />
      </div>

      {/* Logo mark */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
        className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#1a1a2e] shadow-2xl shadow-[#1a1a2e]/30"
      >
        <span className="text-4xl font-black text-[#FDF6EC]">D</span>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-1 rounded-[32px] border-2 border-dashed border-[#1a1a2e]/15"
        />
      </motion.div>

      {/* Brand name */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-2xl font-extrabold tracking-tight text-[#1a1a2e]"
      >
        DocuMind
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-1 text-sm text-[#1a1a2e]/40"
      >
        Document intelligence
      </motion.p>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-16 w-36"
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#1a1a2e]/8">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "0%" }}
            transition={{ duration: 1.1, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="h-full rounded-full bg-[#1a1a2e]/30"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Username onboarding modal ────────────────────────────────────────────────
function UsernameModal({ onDone }: { onDone: (name: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    localStorage.setItem(USERNAME_KEY, trimmed);
    onDone(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1a1a2e]/30 backdrop-blur-sm" />

      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative w-full max-w-sm rounded-3xl bg-[#FDF6EC] p-6 shadow-2xl shadow-black/20"
      >
        {/* Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D9CEF2]">
          <User className="h-5 w-5 text-[#1a1a2e]" />
        </div>

        <h2 className="text-xl font-extrabold text-[#1a1a2e]">What's your name?</h2>
        <p className="mt-1 text-sm text-[#1a1a2e]/50">
          DocuMind will use this to greet you personally.
        </p>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Your first name…"
          maxLength={32}
          className="mt-4 w-full rounded-2xl border border-[#1a1a2e]/10 bg-white/70 px-4 py-3 text-base font-medium text-[#1a1a2e] placeholder-[#1a1a2e]/30 outline-none focus:border-[#1a1a2e]/30 focus:ring-2 focus:ring-[#1a1a2e]/10"
        />

        <button
          onClick={submit}
          disabled={!value.trim()}
          className="mt-3 w-full rounded-2xl bg-[#1a1a2e] py-3.5 text-sm font-bold text-[#FDF6EC] shadow-lg shadow-[#1a1a2e]/20 transition-all hover:bg-[#1a1a2e]/90 disabled:opacity-40"
        >
          Get started →
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Feature card (secondary actions below main actions) ──────────────────────
function FeatureCard({
  icon,
  title,
  description,
  color,
  onClick,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  onClick?: () => void;
  delay?: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 24 }}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-white/70 px-4 py-3.5 text-left shadow-md shadow-black/5 border border-black/5 backdrop-blur-sm"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: color }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#1a1a2e]">{title}</p>
        <p className="text-xs text-[#1a1a2e]/50 truncate">{description}</p>
      </div>
      <span className="text-[#1a1a2e]/20">›</span>
    </motion.button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const { pages: scanPages } = useScanSession();
  const { documents, loaded } = useRecentDocuments(8);

  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { searchOpen, openSearch, closeSearch } = useSideNav();
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

  // ── On mount: check username + hide loader ──────────────────────────────
  useIsomorphicLayoutEffect(() => {
    const stored = localStorage.getItem(USERNAME_KEY);
    if (stored) {
      setUsername(stored);
    } else {
      // Show username modal after loader finishes
      setShowUsernameModal(true);
    }
    
    // Set up timer if it hasn't loaded yet
    if (sessionStorage.getItem("app_has_loaded")) {
      setIsLoading(false);
    } else {
      const t = setTimeout(() => {
        setIsLoading(false);
        sessionStorage.setItem("app_has_loaded", "true");
      }, 1600);
      return () => clearTimeout(t);
    }
  }, []);

  // ── Upload ──────────────────────────────────────────────────────────────
  const beginUpload = useUploadFiles();

  const onDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      toast({ message: `${rejections[0]?.file.name ?? "That file"} isn't an image or PDF`, tone: "error" });
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (accepted) => accepted.length > 0 && beginUpload(accepted),
    onDropRejected,
    accept: ACCEPTED_TYPES,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const handleScan = async () => {
    const availability = await checkCamera();
    if (availability === "ok") { router.push("/scan"); return; }
    toast(
      availability === "insecure"
        ? "Camera needs a secure (https) connection — pick a file instead"
        : "No camera found — pick a file instead"
    );
    open();
  };

  const handleAsk = () => {
    if (loaded && documents.length === 0) {
      uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setUploadHint("Scan something first");
      window.setTimeout(() => setUploadHint(null), 3200);
      return;
    }
    setAskOpen(true);
  };

  const greeting = username ? `Hi ${username},` : "Hi there,";

  return (
    <>
      {/* ── Loading screen ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isLoading && <AppLoader key="loader" />}
      </AnimatePresence>

      {/* ── Username modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isLoading && showUsernameModal && (
          <UsernameModal
            key="username-modal"
            onDone={(name) => {
              setUsername(name);
              setShowUsernameModal(false);
            }}
          />
        )}
      </AnimatePresence>

      <main
        {...(getRootProps() as Record<string, unknown>)}
        className="relative flex min-h-[100dvh] flex-col items-center overflow-x-hidden"
      >
        <input {...getInputProps()} />
        <MeshGradient />

        <div className="relative w-full flex flex-col items-center px-4 pb-24 sm:px-6">

          {/* Drag overlay */}
          <AnimatePresence>
            {isDragActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-2 z-50 flex items-center justify-center rounded-4xl border-4 border-dashed border-ink/30 bg-cream/70 backdrop-blur-sm"
              >
                <p className="text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">Drop it here</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="relative z-10 flex h-14 w-full items-center justify-between pt-[env(safe-area-inset-top)] sm:h-auto sm:items-start sm:pt-8">
            <HamburgerButton />
            <GlassIconButton label="How DocuMind works" onClick={() => setHelpOpen(true)}>
              <HelpCircle className="h-5 w-5" />
            </GlassIconButton>
            <Link
              href="/documents"
              aria-label="All documents"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white/40 text-ink backdrop-blur-md transition-colors hover:bg-white/60"
            >
              <LayoutGrid className="h-5 w-5" />
            </Link>
          </div>

          {/* ── Install App Banner ─────────────────────────────────────────── */}
          <AnimatePresence>
            {isInstallable && !isInstalled && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-20 w-full max-w-4xl mt-4"
              >
                <div className="flex items-center justify-between bg-[#1a1a2e] rounded-2xl p-4 shadow-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-400 p-2 rounded-xl">
                      <Smartphone className="h-5 w-5 text-[#1a1a2e]" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-white font-bold text-sm">Install DocuMind App</h3>
                      <p className="text-white/60 text-xs">For a faster, full-screen native experience.</p>
                    </div>
                  </div>
                  <button 
                    onClick={promptInstall}
                    className="bg-white text-[#1a1a2e] px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-white/90 active:scale-95 transition-all whitespace-nowrap"
                  >
                    Install Now
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Greeting ───────────────────────────────────────────────────── */}
          <div className="relative z-10 flex w-full max-w-4xl flex-col items-center pt-6 text-center sm:pt-8">
            <motion.div
              key={greeting}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: isLoading ? 0 : 0.1, type: "spring", stiffness: 220, damping: 24 }}
            >
              <StaggeredHeadline
                text={greeting}
                className="text-[36px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl"
              />
              <StaggeredHeadline
                text="How can I help you today?"
                className="text-[36px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl mt-1"
              />
            </motion.div>
          </div>

          {/* Demo slider — desktop only */}
          <div className="hidden sm:flex relative z-10 mt-8 w-full justify-center">
            <DemoSlider />
          </div>

          {/* ── 3 Primary Action Cards ─────────────────────────────────────── */}
          <div className="relative z-10 mt-10 w-full max-w-md flex flex-col gap-3 sm:flex-row sm:max-w-4xl sm:gap-6 sm:justify-center sm:items-start">
            <div id="tour-upload-btn" className="w-full sm:w-auto">
              <ActionCard
                ref={uploadRef}
                icon={<ArrowUp className="h-6 w-6 text-ink" />}
                label="Upload"
                circleColor="#D9CEF2"
                rotate={-8}
                delay={0.05}
                hint={uploadHint}
                onClick={open}
                isArc={false}
              />
            </div>
            <div id="tour-scan-btn" className="w-full sm:w-auto">
              <ActionCard
                icon={<Camera className="h-6 w-6 text-ink" />}
                label="Scan"
                circleColor="#A8D8D8"
                rotate={0}
                delay={0.12}
                badge={scanPages.length > 0 ? `${scanPages.length} page${scanPages.length === 1 ? "" : "s"}` : undefined}
                onClick={handleScan}
                isArc={false}
              />
            </div>
            <div id="tour-ask-btn" className="w-full sm:w-auto">
              <ActionCard
                icon={<Sparkles className="h-6 w-6 text-ink" />}
                label="Ask AI"
                circleColor="#F5C98E"
                rotate={8}
                delay={0.19}
                onClick={handleAsk}
                isArc={false}
              />
            </div>
          </div>

          {/* ── Centered search button ──────────────────────────────────────── */}
          <motion.div
            id="tour-search-btn"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.32, type: "spring", stiffness: 240, damping: 22 }}
            className="relative z-10 mt-6 flex justify-center w-full"
          >
            <MagneticButton
              onClick={openSearch}
              aria-label="Search documents"
              className="flex items-center gap-2.5 h-[52px] px-6 rounded-full bg-[#111] text-cream shadow-2xl shadow-black/20 ring-4 ring-[#111]/8"
            >
              <Search className="h-5 w-5 text-white/90" />
              <span className="text-sm font-semibold">Search documents</span>
            </MagneticButton>
          </motion.div>

          {/* ── More features section ───────────────────────────────────────── */}
          <div className="relative z-10 mt-10 w-full max-w-md sm:max-w-4xl">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mb-3 text-xs font-bold uppercase tracking-widest text-ink/30 px-1"
            >
              More tools
            </motion.p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <FeatureCard
                icon={<Edit3 className="h-5 w-5 text-[#1a1a2e]" />}
                title="Edit Document"
                description="Rename, crop, rotate and annotate pages"
                color="#D9CEF2"
                onClick={() => router.push("/documents")}
                delay={0.38}
              />
              <FeatureCard
                icon={<ScanLine className="h-5 w-5 text-[#1a1a2e]" />}
                title="Batch Scan"
                description="Scan multiple pages in one session"
                color="#A8D8D8"
                onClick={handleScan}
                delay={0.42}
              />
              <FeatureCard
                icon={<FileSearch className="h-5 w-5 text-[#1a1a2e]" />}
                title="Smart Search"
                description="Search across all documents with AI"
                color="#F5C98E"
                onClick={() => router.push("/documents")}
                delay={0.46}
              />
              <FeatureCard
                icon={<Scissors className="h-5 w-5 text-[#1a1a2e]" />}
                title="PDF Tools"
                description="Merge, split, and reorder PDF pages"
                color="#FBD0D0"
                onClick={() => router.push("/documents")}
                delay={0.50}
              />
            </div>
          </div>

          {/* ── Recent documents ────────────────────────────────────────────── */}
          <div className="relative z-10 w-full max-w-md sm:max-w-4xl mt-10 pt-8 border-t border-black/5">
            <div className="flex justify-center w-full">
              <RecentDocuments documents={documents} />
            </div>
          </div>
        </div>

        <AskSheet open={askOpen} onClose={() => setAskOpen(false)} documents={documents} loaded={loaded} />

        <BottomSheet open={helpOpen} onClose={() => setHelpOpen(false)} title="How DocuMind works">
          <ol className="space-y-3 pb-2 text-sm text-ink-soft">
            <li>
              <span className="font-semibold text-ink">Upload</span> photos or PDFs — or drop them anywhere on this page.
              Several files become one multi-page document.
            </li>
            <li>
              <span className="font-semibold text-ink">Scan</span> with your camera. DocuMind finds the page edges,
              straightens it, and captures automatically when you hold steady.
            </li>
            <li>
              <span className="font-semibold text-ink">Ask</span> questions about anything you have scanned — answers cite
              the exact passages.
            </li>
          </ol>
        </BottomSheet>
      </main>
    </>
  );
}
