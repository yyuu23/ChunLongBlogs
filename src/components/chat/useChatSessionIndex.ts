"use client";

import { useEffect, useState } from "react";
import {
  lastActiveId,
  loadSessions,
  newSessionId,
  rememberActive,
  removeSession,
  saveSessions,
  titleOf,
  type ChatSessionMeta,
} from "@/lib/chatSessions";

export function useChatSessionIndex(onBeforeSwitch: () => void) {
  const [activeId, setActiveId] = useState(() => lastActiveId() ?? newSessionId());
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const activate = (id: string) => {
    setActiveId(id);
    rememberActive(id);
  };

  const switchTo = (id: string) => {
    onBeforeSwitch();
    activate(id);
  };

  const touchSession = (currentText?: string) => {
    setSessions((previous) => {
      const existing = previous.find((session) => session.id === activeId);
      const meta: ChatSessionMeta = {
        id: activeId,
        title: existing?.title ?? titleOf(currentText ?? "对话"),
        updatedAt: Date.now(),
      };
      return saveSessions([meta, ...previous.filter((session) => session.id !== activeId)]);
    });
  };

  const dropFromIndex = (id: string) => {
    setSessions((previous) => saveSessions(previous.filter((session) => session.id !== id)));
  };

  const dropSession = (id: string) => {
    setSessions((previous) => removeSession(previous, id));
    if (id === activeId) {
      onBeforeSwitch();
      activate(newSessionId());
    }
  };

  return {
    activeId,
    sessions,
    switchTo,
    startNew: () => switchTo(newSessionId()),
    touchSession,
    dropFromIndex,
    dropSession,
  };
}
