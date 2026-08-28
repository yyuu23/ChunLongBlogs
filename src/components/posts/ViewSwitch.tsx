"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import type { ReactNode } from "react";

/** 列表/网格双视图切换（偏好记忆在 localStorage） */
export function ViewSwitch({
  listSlot,
  gridSlot,
}: {
  listSlot: ReactNode;
  gridSlot: ReactNode;
}) {
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    try {
      const v = localStorage.getItem("cl-posts-view");
      if (v === "list" || v === "grid") setView(v);
    } catch {}
  }, []);

  const change = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem("cl-posts-view", v);
    } catch {}
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <div className="glass-card flex items-center gap-1 !rounded-full p-1">
          <button
            onClick={() => change("grid")}
            aria-label="网格视图"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
              view === "grid"
                ? "bg-accent-gradient text-white shadow"
                : "text-muted hover-text-accent"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            网格
          </button>
          <button
            onClick={() => change("list")}
            aria-label="列表视图"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
              view === "list"
                ? "bg-accent-gradient text-white shadow"
                : "text-muted hover-text-accent"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            列表
          </button>
        </div>
      </div>
      {view === "grid" ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{gridSlot}</div>
      ) : (
        <div className="flex flex-col gap-4">{listSlot}</div>
      )}
    </div>
  );
}
