"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { Comments } from "@/components/comments/Comments";
import { cn } from "@/lib/utils";

/** 说说卡片的折叠评论区：默认收起，点开才拉评论（一页几十条说说时省请求） */
export function MomentComments({ momentId }: { momentId: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
        aria-expanded={open}
      >
        <MessageCircle className={cn("h-3.5 w-3.5", open && "text-accent")} />
        {t("moments.commentToggle")}
      </button>
      {open && (
        <div className="mt-3 border-t border-[var(--glass-border)] pt-3">
          <Comments refType="moment" refId={momentId} compact />
        </div>
      )}
    </div>
  );
}
