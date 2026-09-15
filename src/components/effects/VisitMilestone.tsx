"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/providers/LocaleProvider";
import { LogoEgg } from "@/components/effects/LogoEgg";

/**
 * 访客里程碑彩蛋：VisitBeacon 收到 /api/stats 的 milestone 响应（今日第 n 位、
 * n=1 或 10 整倍数）后派发 cl-visit-milestone，这里延迟 1.3s 接住——避开开场
 * Splash（1050ms 完全退场，z-100 会盖住 z-70 的庆祝），然后彩纸 + toast。
 * 只有当日新访客才可能收到 milestone（DB 唯一索引防重复），无需前端频控。
 */
export function VisitMilestone() {
  const t = useT();
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onMilestone = (e: Event) => {
      const value = (e as CustomEvent<{ n: number }>).detail?.n;
      if (!value || value < 1) return;
      timer = setTimeout(() => setN(value), 1300);
    };
    window.addEventListener("cl-visit-milestone", onMilestone);
    return () => {
      window.removeEventListener("cl-visit-milestone", onMilestone);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (n == null) return null;
  return <LogoEgg key={n} trigger={n} message={t("egg.visitorToast", { n })} />;
}
