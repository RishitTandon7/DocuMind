"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Wifi, WifiOff } from "lucide-react";

import { formatTimestamp } from "@/lib/utils";
import type { AgentLogEntry, AgentStreamEvent } from "@/types";

interface TimelineItem {
  key: string;
  agentName: string;
  action: string;
  decision?: string | null;
  reasoning?: string | null;
  timestamp: string;
}

function mergeTimeline(logs: AgentLogEntry[], liveEvents: AgentStreamEvent[]): TimelineItem[] {
  const fromLogs: TimelineItem[] = logs.map((log) => ({
    key: log.id,
    agentName: log.agent_name,
    action: log.action,
    decision: log.decision,
    reasoning: log.reasoning,
    timestamp: log.timestamp,
  }));

  const fromEvents: TimelineItem[] = liveEvents
    .filter((event) => event.type === "agent_event")
    .map((event, index) => ({
      key: `live_${index}_${event.timestamp}`,
      agentName: event.agent_name ?? "Agent",
      action: event.action ?? "",
      decision: event.decision,
      reasoning: event.reasoning,
      timestamp: event.timestamp ?? new Date().toISOString(),
    }));

  const merged = new Map<string, TimelineItem>();
  for (const item of [...fromLogs, ...fromEvents]) {
    merged.set(`${item.agentName}_${item.action}_${item.timestamp}`, item);
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

interface AgentActivityTabProps {
  logs: AgentLogEntry[];
  liveEvents: AgentStreamEvent[];
  isConnected: boolean;
}

export function AgentActivityTab({ logs, liveEvents, isConnected }: AgentActivityTabProps) {
  const timeline = mergeTimeline(logs, liveEvents);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [timeline.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-ink-soft">Live agent decisions as they happen</p>
        <span
          className={
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium " +
            (isConnected ? "border-success/30 bg-success/10 text-success" : "border-black/10 bg-black/5 text-ink-soft")
          }
        >
          {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {isConnected ? "Live" : "Offline"}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {timeline.length === 0 ? (
          <p className="py-10 text-center text-xs text-ink-soft">Waiting for agents to start…</p>
        ) : (
          <AnimatePresence initial={false}>
            {timeline.map((item, index) => (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 260, damping: 26, filter: { duration: 0.4 } }}
                className="flex gap-3"
              >
                <div className="mt-1.5 flex flex-col items-center">
                  <motion.span
                    key={`${item.key}-dot`}
                    animate={index === timeline.length - 1 ? { scale: [1, 1.6, 1] } : {}}
                    transition={{ duration: 0.5, repeat: index === timeline.length - 1 ? 1 : 0 }}
                    className="h-2 w-2 shrink-0 rounded-full bg-accent"
                  />
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{item.agentName}</p>
                    <span className="shrink-0 font-mono text-[10px] text-ink-soft">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft">
                    {item.action}
                    {item.decision ? ` · ${item.decision}` : ""}
                  </p>
                  {item.reasoning && (
                    <p className="mt-1 rounded-xl bg-black/5 p-2 text-[11px] leading-relaxed text-ink-soft">
                      {item.reasoning}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
