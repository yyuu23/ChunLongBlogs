"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Quote, RefreshCw } from "lucide-react";
import { QUOTES, type Quote as QuoteItem } from "@/lib/quotes";
import { useT } from "@/components/providers/LocaleProvider";

/** 本地随机一条（避开当前条目） */
function localPick(current?: QuoteItem): QuoteItem {
  if (QUOTES.length <= 1) return QUOTES[0];
  let next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  while (current && next.text === current.text) {
    next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }
  return next;
}

/**
 * 一言卡：名言与诗词轮换，全部来自本地精选语料（src/lib/quotes.ts，181 条）。
 * 不接在线接口 —— hitotocn 各分类实测：动漫 a/b 之外，"文学 d"是网文台词、
 * "哲学 j"是网络原创句，"诗词 i"库容小（连抽重复率高）且混有约一成半的
 * 现代言情短句，纯度与数量都不及本地库，索性全本地。
 */
export function HitokotoCard() {
  const t = useT();
  // 确定性初始值（按当日日期取模）：SSR 与客户端首渲染一致零 mismatch，且每天不同
  const [quote, setQuote] = useState<QuoteItem>(
    () => QUOTES[new Date().getDate() % QUOTES.length],
  );
  const [spinning, setSpinning] = useState(false);

  const next = useCallback(() => {
    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);
    setQuote((q) => localPick(q));
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
