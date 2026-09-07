"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getVisitorId } from "@/lib/track";

/**
 * 全站 PV/UV 埋点：路由变化时 fire-and-forget 上报。
 * 同一会话同一路径 30 秒内去重（防 React 严格模式双挂载与快速往返刷量）。
 */
export function VisitBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const dedupeKey = `cl-pv-${pathname}`;
    try {
      const last = Number(sessionStorage.getItem(dedupeKey) || 0);
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(dedupeKey, String(Date.now()));
    } catch {}
    void fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "visit", page: pathname, visitorId: getVisitorId() }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
