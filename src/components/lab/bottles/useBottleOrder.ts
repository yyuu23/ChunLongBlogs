"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeBottleOrder, reorderBottleIds } from "@/lib/bottle-order";

const ORDER_KEY = "cl-bottle-order";

export function useBottleOrder<T extends { id: number }>(items: T[] | null) {
  const [storedOrder, setStoredOrder] = useState<number[] | null>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "null") as unknown;
      if (Array.isArray(parsed) && parsed.every((id) => Number.isInteger(id))) {
        setStoredOrder(parsed as number[]);
      }
    } catch {}
  }, []);

  const display = useMemo(
    () => (items ? mergeBottleOrder(items, storedOrder) : null),
    [items, storedOrder],
  );
  const displayRef = useRef(display);
  displayRef.current = display;

  const persistOrder = useCallback((ids: number[]) => {
    setStoredOrder(ids);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    } catch {}
  }, []);

  const moveItem = useCallback((id: number, targetId: number, mode: "before" | "after") => {
    const current = displayRef.current;
    if (!current) return;
    const ids = current.map((item) => item.id);
    const next = reorderBottleIds(ids, id, targetId, mode);
    if (next === ids) return;
    persistOrder(next);
  }, [persistOrder]);

  return { display, displayRef, moveItem, persistOrder };
}
