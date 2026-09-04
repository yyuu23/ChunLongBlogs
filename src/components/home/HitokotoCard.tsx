"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Quote, RefreshCw } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";

interface Hitokoto {
  text: string;
  from: string;
}

/** API 不可达时的离线语录（动漫向），保证卡片永远有内容 */
const FALLBACK_QUOTES: Hitokoto[] = [
  { text: "我们所度过的每个平凡的日常，也许就是连续发生的奇迹。", from: "日常" },
  { text: "无论如何都要向前走，哪怕脚步再小。", from: "紫罗兰永恒花园" },
  { text: "只要活着，哪里都是天堂。", from: "EVA" },
  { text: "世界是美丽的，就算充满悲伤和泪水。", from: "Clannad" },
  { text: "有思念你的人在的地方，就是你的归处。", from: "火影忍者" },
  { text: "不要哭，真难看，哭也不会改变什么。", from: "海贼王" },
];

/** 一言卡：动画/漫画分类的一句话 + 出处，点击刷新换一句 */
export function HitokotoCard() {
  const t = useT();
  const [quote, setQuote] = useState<Hitokoto>(FALLBACK_QUOTES[0]);
  const [spinning, setSpinning] = useState(false);

  const next = useCallback(async () => {
    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);
    try {
      const res = await fetch("https://v1.hitokoto.cn/?c=a&c=b&max_length=30", {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as { hitokoto: string; from?: string };
        if (data.hitokoto) {
          setQuote({ text: data.hitokoto, from: data.from || "" });
          return;
        }
      }
    } catch {
      // 网络失败：轮换离线语录
    }
    setQuote((q) => {
      const i = FALLBACK_QUOTES.findIndex((f) => f.text === q.text);
      return FALLBACK_QUOTES[(i + 1) % FALLBACK_QUOTES.length];
    });
  }, []);

  useEffect(() => {
    void next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass-card glass-hover flex min-h-[7.5rem] flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-widest text-muted">
          <Quote className="h-3.5 w-3.5 text-accent" />
          {t("home.hitokotoTitle")}
        </p>
        <button
          type="button"
          onClick={() => void next()}
          aria-label={t("home.hitokotoRefresh")}
          className="glass-button !p-2"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 transition-transform duration-500 ${spinning ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.blockquote
          key={quote.text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="mt-2 flex flex-1 flex-col justify-center"
        >
          <p className="font-serif text-[15px] leading-relaxed">{quote.text}</p>
          {quote.from && (
            <footer className="mt-1.5 text-right text-xs text-muted">—— {quote.from}</footer>
          )}
        </motion.blockquote>
      </AnimatePresence>
    </div>
  );
}
