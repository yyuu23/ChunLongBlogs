import { Megaphone } from "lucide-react";
import { solarTermText } from "@/lib/solar-terms";

/** 公告栏：自动节气 + 可选自定义公告 */
export function AnnouncementBar({ customText }: { customText?: string }) {
  const { text, dateText } = solarTermText();

  return (
    <div className="glass-card flex items-center gap-3 px-5 py-3.5 text-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 text-white">
        <Megaphone className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="font-medium">
          今日 · {text}
        </span>
        <span className="text-xs text-muted">{dateText}</span>
        {customText && (
          <span className="w-full truncate text-muted" title={customText}>
            📢 {customText}
          </span>
        )}
      </div>
    </div>
  );
}
