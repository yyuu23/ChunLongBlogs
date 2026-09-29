"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

/**
 * 悬浮聊天窗的按需加载壳：
 * - Next 16 的 ssr:false 只允许在 Client Component 使用（(site)/layout.tsx
 *   是 RSC，直接在那里 dynamic 会构建报错），所以包一层客户端组件；
 * - 挂载时机三选一先到：requestIdleCallback（3s 超时兜底）/ 首次指针交互 /
 *   搜索空态派发的 cl-open-chat——聊天窗及其依赖（react-markdown、KaTeX、
 *   附件上传逻辑）不再进每页首屏 bundle；
 * - cl-open-chat 在挂载前到达时缓存事件、立即挂载并重放一次（SearchPalette
 *   的 prefill 唤起路径不受影响）。悬浮窗本身无持久化会话语义（见 useChat
 *   persistKey 注释），延迟挂载没有状态可丢。
 */
const FloatingChatWidget = dynamic(
  () => import("./FloatingChatWidget").then((m) => ({ default: m.FloatingChatWidget })),
  { ssr: false, loading: () => null },
);

export function LazyFloatingChat() {
  const [mounted, setMounted] = useState(false);
  const pendingEvent = useRef<CustomEvent<{ prefill?: string }> | null>(null);

  useEffect(() => {
    if (mounted) return;
    const mount = () => setMounted(true);

    // 1) 空闲挂载（Safari 无 rIC 时用定时器兜底，3s 是耐心上限）
    const hasRic = "requestIdleCallback" in window;
    const idleHandle = hasRic ? window.requestIdleCallback(mount, { timeout: 3000 }) : -1;
    const idleTimer = hasRic ? -1 : window.setTimeout(mount, 3000);

    // 2) 首次交互立即挂载（有人要动手了就别再等空闲）
    const onPointer = () => mount();
    window.addEventListener("pointerdown", onPointer, { once: true });

    // 3) 搜索空态唤起：缓存事件并立即挂载，重放逻辑见下个 effect
    const onOpenChat = (e: Event) => {
      pendingEvent.current = e as CustomEvent<{ prefill?: string }>;
      mount();
    };
    window.addEventListener("cl-open-chat", onOpenChat);

    return () => {
      if (idleHandle >= 0) window.cancelIdleCallback(idleHandle);
      if (idleTimer >= 0) window.clearTimeout(idleTimer);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("cl-open-chat", onOpenChat);
    };
  }, [mounted]);

  // 挂载完成后重放缓存的 cl-open-chat：组件内的监听器在其自身 effect 里
  // 注册，延迟 50ms 确保 commit 与监听器就绪后再派发，prefill 不丢
  useEffect(() => {
    if (!mounted || !pendingEvent.current) return;
    const e = pendingEvent.current;
    pendingEvent.current = null;
    const t = window.setTimeout(() => window.dispatchEvent(e), 50);
    return () => window.clearTimeout(t);
  }, [mounted]);

  return mounted ? <FloatingChatWidget /> : null;
}
