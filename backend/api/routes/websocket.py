"""
Real-time agent stream over WebSocket.

Exposes `WS /ws/{document_id}` so the frontend can subscribe to a live feed
of agent decisions/actions as a document moves through the pipeline. The
`ConnectionManager` singleton is also imported by the agent supervisor to
broadcast events as they happen.
"""

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import get_settings
from utils.logger import logger

router = APIRouter(tags=["websocket"])
settings = get_settings()


class ConnectionManager:
    """Tracks active WebSocket connections grouped by document id and broadcasts events."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, document_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(document_id, set()).add(websocket)
        logger.info(f"WebSocket connected for document {document_id}")

    async def disconnect(self, document_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            connections = self._connections.get(document_id)
            if connections and websocket in connections:
                connections.remove(websocket)
                if not connections:
                    self._connections.pop(document_id, None)
        logger.info(f"WebSocket disconnected for document {document_id}")

    async def broadcast(self, document_id: str, event: dict) -> None:
        """Send a JSON event to every subscriber of a document, dropping dead sockets."""
        connections = self._connections.get(document_id, set()).copy()
        if not connections:
            return
        payload = json.dumps(event, default=str)
        dead: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_text(payload)
            except Exception:
                dead.append(websocket)
        if dead:
            async with self._lock:
                for websocket in dead:
                    self._connections.get(document_id, set()).discard(websocket)


manager = ConnectionManager()


async def broadcast_agent_event(
    document_id: str, agent_name: str, action: str, decision: str | None = None, reasoning: str | None = None
) -> None:
    """Convenience helper used by agents to broadcast a structured event over the WebSocket."""
    await manager.broadcast(
        document_id,
        {
            "type": "agent_event",
            "document_id": document_id,
            "agent_name": agent_name,
            "action": action,
            "decision": decision,
            "reasoning": reasoning,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@router.websocket("/ws/{document_id}")
async def agent_stream(websocket: WebSocket, document_id: str) -> None:
    """Stream real-time agent decisions/actions for a given document."""
    await manager.connect(document_id, websocket)
    try:
        while True:
            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(), timeout=settings.ws_heartbeat_seconds
                )
                logger.debug(f"Received WS message for {document_id}: {message}")
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "heartbeat"}))
    except WebSocketDisconnect:
        await manager.disconnect(document_id, websocket)
