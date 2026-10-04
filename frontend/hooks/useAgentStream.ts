"use client";

/**
 * Subscribes to the real-time agent WebSocket stream for a document and
 * accumulates every received event into an ordered timeline for display.
 */

import { useEffect, useRef, useState } from "react";

import { connectAgentStream } from "@/lib/websocket";
import type { AgentStreamEvent } from "@/types";

export function useAgentStream(documentId: string) {
  const [events, setEvents] = useState<AgentStreamEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const handleRef = useRef<ReturnType<typeof connectAgentStream> | null>(null);

  useEffect(() => {
    setIsConnected(true);
    handleRef.current = connectAgentStream(
      documentId,
      (event) => {
        setEvents((previous) => [...previous, event]);
      },
      () => setIsConnected(false)
    );

    return () => {
      handleRef.current?.close();
      setIsConnected(false);
    };
  }, [documentId]);

  return { events, isConnected };
}
