"use client";

import { useState } from "react";

function defaultScheduleValue(now = new Date()) {
  const next = new Date(now.getTime() + 86_400_000);
  next.setHours(9, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

export function usePostSchedule() {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(defaultScheduleValue);

  return {
    isOpen,
    value,
    setValue,
    toggle: () => setIsOpen((open) => !open),
    close: () => setIsOpen(false),
    toIso: (fallback?: string | null) => new Date(fallback || value || Date.now()).toISOString(),
  };
}
