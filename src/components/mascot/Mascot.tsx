"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffects } from "@/components/providers/EffectProvider";

const MASCOT_LINES = [
  "欢迎来到 ChunLong Blog～",
  "今天也要元气满满哦！",
  "点击我有惊喜(っ´ω`c)",
  "听说左下角的音乐很好听？",
  "把窗口拖来拖去也很好玩呢",
  "要不要看看实验室的星星？",
  "喵呜～",
];

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
  const { effects, hydrated } = useEffects();
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showBubble = (text: string) => {
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 3200);
  };

  useEffect(() => {
    if (hydrated && !effects.mascot) return;
    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let app: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let model: any = null;

    (async () => {
      try {
        await loadCore();
        const PIXI = (await import("pixi.js")).default ?? (await import("pixi.js"));
        const { Live2DModel } = await import("pixi-live2d-display/cubism2");
        if (destroyed || !wrapRef.current) return;

        // pixi-live2d-display 需要全局 PIXI
        (window as unknown as { PIXI: unknown }).PIXI = PIXI;

        app = new PIXI.Application({
          backgroundAlpha: 0,
          width: 260,
          height: 340,
          antialias: true,
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
        app.stage.addChild(model);

        // 点击命中区：随机动作 + 台词
        model.on("hit", (hitAreas: string[]) => {
          const area = hitAreas?.[0];
          if (area === "head") {
            model.motion("flick_head");
            showBubble("别摸头啦 (*/ω＼*)");
          } else {
            model.motion("tap_body");
            showBubble(MASCOT_LINES[Math.floor(Math.random() * MASCOT_LINES.length)]);
          }
        });

        // 指针事件：点击 vs 拖拽
        let dragging = false;
        let moved = false;
        let last = { x: 0, y: 0 };
        const onDown = (e: PointerEvent) => {
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
            showBubble(MASCOT_LINES[Math.floor(Math.random() * MASCOT_LINES.length)]);
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
        };

        showBubble("你好呀，我是看板娘 ✨");
      } catch {
        // 模型加载失败（罕见）：静默隐藏
      }
    })();

    return () => {
      destroyed = true;
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
