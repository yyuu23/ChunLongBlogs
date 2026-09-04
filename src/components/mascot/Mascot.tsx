"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffects } from "@/components/providers/EffectProvider";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { trackEvent } from "@/lib/track";

/** 加载本地 Cubism2 core 脚本（幂等） */
async function loadCore() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { Live2D?: unknown; __clCoreLoaded?: boolean };
  if (w.Live2D || w.__clCoreLoaded) return;
  w.__clCoreLoaded = true;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/live2d/core/live2d.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("core load failed"));
    document.head.appendChild(s);
  });
}

/**
 * Live2D 看板娘：左下角常驻小人
 * 待机自动呼吸/眨眼，点击触发随机动作 + 台词气泡，可拖动
 */
export function Mascot() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const { effects, hydrated, isNight } = useEffects();
  const t = useT();
  const { tArr } = useLocale();
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // 深夜标志走 ref 供模型闭包读取：不进下方 effect deps，避免日夜翻转时销毁重建 2MB 模型
  const nightRef = useRef(false);
  nightRef.current = isNight;

  const showBubble = (text: string) => {
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 3200);
  };

  /** 随机台词（词典数组，随语言切换；深夜换瞌睡词） */
  const randomLine = () => {
    const lines = tArr(nightRef.current ? "mascot.nightLines" : "mascot.lines");
    return lines[Math.floor(Math.random() * lines.length)] ?? "";
  };

  useEffect(() => {
    if (hydrated && !effects.mascot) return;
    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let app: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let model: any = null;
    // 空闲门控的取消句柄
    let startIdleId: number | null = null;
    let startTimerId: ReturnType<typeof setTimeout> | null = null;

    const start = async () => {
      try {
        await loadCore();
        // 全部使用 @pixi v6（pixi-live2d-display 自带的 peer 依赖），不再引入
        // pixi.js v7 —— 消除双份 PIXI（v7 的 436KB chunk 整体消失）。
        // 关键：@pixi/app v6.5 只自动注册 ResizePlugin，创建 app.ticker 并
        // 挂载 render 循环的 TickerPlugin 位于 @pixi/ticker，必须手动注册，
        // 否则 canvas 只会空白透明（元素在、事件在、但从未渲染过一帧）
        const { Application } = await import("@pixi/app");
        const { Ticker, TickerPlugin } = await import("@pixi/ticker");
        const { extensions } = await import("@pixi/core");
        const { Live2DModel } = await import("pixi-live2d-display/cubism2");
        // 先 remove 再 add：effect 重跑（dev 严格模式/开关特效）时保持幂等
        try {
          extensions.remove(TickerPlugin);
        } catch {}
        extensions.add(TickerPlugin);
        // registerTicker 是官方 API，注册后 bundle 不再读 window.PIXI 兜底
        Live2DModel.registerTicker(Ticker);
        if (destroyed || !wrapRef.current) return;

        app = new Application({
          backgroundAlpha: 0,
          width: 260,
          height: 340,
          antialias: true,
          autoStart: true,
        });
        app.view.style.touchAction = "none";
        wrapRef.current.appendChild(app.view);

        model = await Live2DModel.from("/live2d/shizuku/shizuku.model.json", {
          autoInteract: false,
        });
        if (destroyed) return;
        model.scale.set(0.13);
        model.anchor.set(0.5, 1);
        model.position.set(130, 340);
        // 模型基类与舞台现在同属 @pixi v6，不再有跨版本混搭。看板娘的
        // 点击/拖拽由下方 DOM 指针事件处理，这里让模型不参与 pixi 事件命中
        // （v6 的写法是 interactive = false）
        model.interactive = false;
        model.interactiveChildren = false;
        app.stage.addChild(model);

        // 标签页切后台时冻结渲染循环（呼吸/物理暂停），切回无缝续播
        const onVisibility = () => {
          if (!app?.ticker) return;
          if (document.hidden) app.ticker.stop();
          else app.ticker.start();
        };
        document.addEventListener("visibilitychange", onVisibility);

        // 长时间无人互动降到 30fps 省电（呼吸/待机动作依旧播放），
        // 指针靠近或点击立即恢复满帧并重新计时
        let dimTimer: ReturnType<typeof setTimeout> | null = null;
        const undim = () => {
          if (dimTimer) {
            clearTimeout(dimTimer);
            dimTimer = null;
          }
          // 0 = 不限帧；深夜瞌睡状态即使有人互动也只回到 12fps（呼吸都变慢了）
          if (app?.ticker) app.ticker.maxFPS = nightRef.current ? 12 : 0;
        };
        const scheduleDim = () => {
          if (dimTimer) clearTimeout(dimTimer);
          dimTimer = setTimeout(() => {
            dimTimer = null;
            if (app?.ticker) app.ticker.maxFPS = nightRef.current ? 12 : 30;
          }, 10000);
        };
        app.view.addEventListener("pointerenter", undim);
        app.view.addEventListener("pointerleave", scheduleDim);

        // 点击命中区：随机动作 + 台词
        model.on("hit", (hitAreas: string[]) => {
          const area = hitAreas?.[0];
          if (area === "head") {
            model.motion("flick_head");
            showBubble(t("mascot.flickHead"));
            trackEvent("pat_mascot"); // 摸头攒好感（服务端按单日上限结算）
          } else {
            model.motion("tap_body");
            showBubble(randomLine());
          }
        });

        // 指针事件：点击 vs 拖拽
        let dragging = false;
        let moved = false;
        let last = { x: 0, y: 0 };
        const onDown = (e: PointerEvent) => {
          undim(); // 点击即恢复满帧并重置空闲计时
          dragging = true;
          moved = false;
          last = { x: e.clientX, y: e.clientY };
        };
        const onMove = (e: PointerEvent) => {
          if (!dragging) return;
          const dx = e.clientX - last.x;
          const dy = e.clientY - last.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
          last = { x: e.clientX, y: e.clientY };
          model.position.x += dx;
          model.position.y += dy;
          // 限制在舞台内
          model.position.x = Math.max(40, Math.min(220, model.position.x));
          model.position.y = Math.max(120, Math.min(340, model.position.y));
        };
        const onUp = () => {
          if (dragging && !moved) {
            // 原地点击 → 触发动作
            model.motion("tap_body");
            showBubble(randomLine());
          }
          dragging = false;
        };
        app.view.addEventListener("pointerdown", onDown);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        (model as unknown as { __cleanup?: () => void }).__cleanup = () => {
          app.view.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          document.removeEventListener("visibilitychange", onVisibility);
          app.view.removeEventListener("pointerenter", undim);
          app.view.removeEventListener("pointerleave", scheduleDim);
          if (dimTimer) clearTimeout(dimTimer);
        };
        scheduleDim(); // 初始：加载后无人互动满 10s 即降帧

        showBubble(t(nightRef.current ? "mascot.nightGreeting" : "mascot.greeting"));
      } catch {
        // 模型加载失败（罕见）：静默隐藏
      }
    };

    // 等浏览器空闲再启动整条加载链（live2d core + pixi + 约 2MB 模型），
    // 不与首屏字体/图片抢 HTTP/1.1 的有限连接；看板娘晚 1-4 秒登场，登场后效果不变
    if (typeof requestIdleCallback === "function") {
      startIdleId = requestIdleCallback(() => start(), { timeout: 4000 });
    } else {
      startTimerId = setTimeout(start, 2500);
    }

    return () => {
      destroyed = true;
      if (startIdleId !== null) cancelIdleCallback(startIdleId);
      if (startTimerId !== null) clearTimeout(startTimerId);
      clearTimeout(bubbleTimer.current);
      try {
        model?.__cleanup?.();
      } catch {}
      try {
        model?.destroy();
      } catch {}
      try {
        app?.destroy(true);
      } catch {}
    };
  }, [hydrated, effects.mascot]);

  if (hydrated && !effects.mascot) return null;

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 z-40 hidden md:block" aria-hidden>
      <div ref={wrapRef} className="pointer-events-auto cursor-grab active:cursor-grabbing" />
      {/* 深夜瞌睡：头顶 Zzz 轻轻上浮；说话时让位给气泡 */}
      {isNight && !bubble && (
        <div className="cl-zzz" aria-hidden>
          <span>Z</span>
          <span>z</span>
          <span>z</span>
        </div>
      )}
      <AnimatePresence>
        {bubble && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            className="glass-card absolute bottom-[19rem] left-3 max-w-52 !rounded-2xl px-3.5 py-2 text-xs"
          >
            {bubble}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
