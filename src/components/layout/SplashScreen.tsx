"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffects } from "@/components/providers/EffectProvider";

const SESSION_KEY = "cl-splash-seen";

/**
 * 开场启动屏：每个会话播放一次（sessionStorage 门控）。
 * - 服务端默认渲染覆盖层，首帧 inline 脚本若发现"已看过"会立即加 .splash-seen 隐藏
 * - 播放完毕 blur + 淡出退场
 */
export function SplashScreen({ siteName, avatar }: { siteName: string; avatar: string }) {
  const { effects, hydrated } = useEffects();
  // 首帧即渲染覆盖层（配合 layout 里的内联脚本对"已看过"的会话立即隐藏）
  const [show, setShow] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {}
    if (seen || !effects.splash) {
      document.documentElement.classList.add("splash-seen");
      setShow(false);
      return;
    }
    // 总时长约 1s：演出加速播放而非砍掉（0.7s 开始退场 + 0.35s 退场动画）
    const t1 = setTimeout(() => setExiting(true), 700);
    const t2 = setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}
      document.documentElement.classList.add("splash-seen");
      setShow(false);
    }, 1050);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [effects.splash]);

  if (hydrated && !show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="splash-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#c2e9fb] via-[#e0c3fc] to-[#fbc2eb] dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950"
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ pointerEvents: exiting ? "none" : "auto" }}
        >
          <motion.div
            animate={exiting ? { scale: 1.15, opacity: 0 } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="relative flex flex-col items-center gap-6"
          >
            {/* 旋转光环 + 头像 */}
            <div className="relative">
              <div
                className="absolute -inset-3 rounded-full opacity-80 blur-md"
                style={{
                  background:
                    "conic-gradient(from 0deg, #818cf8, #f472b6, #facc15, #34d399, #818cf8)",
                  animation: "halo-rotate 2.4s linear infinite",
                }}
              />
              <div className="relative h-24 w-24 overflow-hidden rounded-full ring-4 ring-white/60 dark:ring-slate-800">
                <Image src={avatar} alt={siteName} fill sizes="96px" priority />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 overflow-hidden">
              <motion.p
                initial={{ y: 26, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="font-serif text-2xl font-bold tracking-wide text-slate-800 dark:text-slate-100"
              >
                {siteName}
              </motion.p>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.28, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="text-sm tracking-[0.3em] text-slate-500 dark:text-slate-400"
              >
                LOADING
              </motion.p>
            </div>

            {/* 进度条 */}
            <div className="h-1 w-44 overflow-hidden rounded-full bg-white/50 dark:bg-slate-800">
              <motion.div
                className="h-full rounded-full bg-accent-gradient"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
