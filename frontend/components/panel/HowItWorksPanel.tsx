"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { AgentActivityTab } from "@/components/panel/AgentActivityTab";
import { OperationsTab } from "@/components/panel/OperationsTab";
import { PipelineTab } from "@/components/panel/PipelineTab";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import type {
  AgentLogEntry,
  AgentStreamEvent,
  DIPOperationsResponse,
  GraphResponse,
  OCRResponse,
} from "@/types";

type TabKey = "pipeline" | "activity" | "operations";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pipeline", label: "Pipeline" },
  { key: "activity", label: "Agent activity" },
  { key: "operations", label: "Operations" },
];

interface HowItWorksPanelProps {
  isOpen: boolean;
  onClose: () => void;
  dip: DIPOperationsResponse | null;
  ocr: OCRResponse | null;
  graph: GraphResponse | null;
  agentLogs: AgentLogEntry[];
  liveEvents: AgentStreamEvent[];
  isConnected: boolean;
}

export function HowItWorksPanel({
  isOpen,
  onClose,
  dip,
  ocr,
  graph,
  agentLogs,
  liveEvents,
  isConnected,
}: HowItWorksPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("pipeline");
  const isMobile = useIsMobile();

  // Unlike BottomSheet, this panel never listened for Escape — if that's someone's habit for
  // dismissing an overlay, it silently did nothing and left the panel (and its full-screen
  // backdrop) open, which then reads as "the rest of the UI stopped responding".
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
          />

          <motion.div
            drag={isMobile ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
            initial={isMobile ? { y: "100%" } : { x: "100%" }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: "100%" } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className={cn(
              "fixed z-50 flex flex-col border border-black/10 bg-[#FDF6EC]/80 backdrop-blur-xl",
              isMobile
                ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-4xl border-b-0"
                : "inset-y-0 right-0 w-full max-w-md border-r-0"
            )}
          >
            {isMobile && (
              <div className="flex justify-center pt-3">
                <div className="h-1.5 w-12 rounded-full bg-black/15" />
              </div>
            )}

            <div className="flex items-center justify-between px-6 pb-2 pt-5">
              <h2 className="text-lg font-bold tracking-tightest text-ink">How it works</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1 px-6 pb-4">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
                    activeTab === tab.key ? "text-cream" : "text-ink-soft hover:text-ink"
                  )}
                >
                  {activeTab === tab.key && (
                    <motion.span
                      layoutId="panel-tab-indicator"
                      transition={{ type: "spring", stiffness: 340, damping: 30 }}
                      className="absolute inset-0 rounded-full bg-ink"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8">
              {activeTab === "pipeline" && <PipelineTab dip={dip} ocr={ocr} graph={graph} />}
              {activeTab === "activity" && (
                <AgentActivityTab logs={agentLogs} liveEvents={liveEvents} isConnected={isConnected} />
              )}
              {activeTab === "operations" && <OperationsTab dip={dip} />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
