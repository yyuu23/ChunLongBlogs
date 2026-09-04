"use client";

import { useEffect, useState } from "react";
import { Home } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { usePlayer } from "@/components/music/PlayerProvider";
import { useWeather, isRainy, isSnowy } from "@/lib/weather";
import { timeBucket, type TimeBucket } from "@/lib/timeOfDay";

/** 天空渐变:夜晚 > 雨 > 雪 > 阴 > 按时段;shell(首帧)用中性白天,保证 hydration 恒定 */
function skyGradient(night: boolean, phase: TimeBucket | "shell", rainy: boolean, snowy: boolean, overcast: boolean) {
  if (night) return "linear-gradient(180deg, #0b1026 0%, #151c3f 60%, #1d2547 100%)";
  if (rainy) return "linear-gradient(180deg, #5a6a80 0%, #77879a 60%, #8f9aab 100%)";
  if (snowy) return "linear-gradient(180deg, #93a2b5 0%, #b9c4d0 60%, #d5dce3 100%)";
  if (overcast) return "linear-gradient(180deg, #8fa0b3 0%, #aeb9c6 60%, #c9d1da 100%)";
  switch (phase) {
    case "dawn":
      return "linear-gradient(180deg, #ffd9a0 0%, #ffb997 45%, #c9a7c9 100%)";
    case "morning":
      return "linear-gradient(180deg, #7ec3f0 0%, #a8d8f5 60%, #d8ecfa 100%)";
    case "afternoon":
      return "linear-gradient(180deg, #6db3e8 0%, #9ccbef 55%, #f5e3b8 100%)";
    case "evening":
      return "linear-gradient(180deg, #f0a868 0%, #d67ba0 55%, #8d6bb3 100%)";
    case "lateEvening":
      return "linear-gradient(180deg, #3a3f66 0%, #54487a 60%, #7a5a8f 100%)";
    default:
      return "linear-gradient(180deg, #7ec3f0 0%, #a8d8f5 100%)";
  }
}

/** 星星位置写死(不用 Math.random,避免 hydration 不一致;本身也只在挂载后的夜晚渲染) */
const STARS = [
  { left: "12%", top: "16%", delay: "0s" },
  { left: "28%", top: "34%", delay: "0.7s" },
  { left: "55%", top: "12%", delay: "1.3s" },
  { left: "70%", top: "40%", delay: "0.4s" },
  { left: "86%", top: "22%", delay: "1.8s" },
  { left: "40%", top: "55%", delay: "1s" },
];

const RAINDROPS = [
  { left: "10%", delay: "0s" },
  { left: "24%", delay: "0.35s" },
  { left: "38%", delay: "0.12s" },
  { left: "52%", delay: "0.5s" },
  { left: "66%", delay: "0.22s" },
  { left: "80%", delay: "0.62s" },
  { left: "92%", delay: "0.44s" },
];

/**
 * 站长的小屋:首页一扇随真实天气/时段/音乐变化的小窗。
 * 数据复用 useWeather(与天气卡共享缓存与 in-flight 去重);
 * 天气失败时降级为静态壳 + 按时段亮灯。reduced-motion 由全局熔断接管。
 */
export function HouseWindow() {
  const t = useT();
  const { weather, night } = useWeather();
  const { playing } = usePlayer() ?? {};
  const [phase, setPhase] = useState<TimeBucket | "shell">("shell");

  useEffect(() => {
    const apply = () => setPhase(timeBucket(new Date().getHours()));
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, []);

  const rainy = weather ? isRainy(weather.bucket) : false;
  const snowy = weather ? isSnowy(weather.bucket) : false;
  const overcast =
    weather?.bucket === "overcast" || weather?.bucket === "cloudy" || weather?.bucket === "fog";
  const lampOn = night || phase === "lateEvening" || phase === "dawn";

  return (
    <div className="glass-card glass-hover p-4" aria-label={t("home.houseTitle")}>
      {/* 标题行 */}
      <div className="mb-3 flex items-center gap-2">
        <Home className="h-4 w-4 text-accent" />
        <p className="text-sm font-semibold">{t("home.houseTitle")}</p>
        {weather?.city && <p className="ml-auto text-[0.625rem] text-muted">{weather.city}</p>}
      </div>

      {/* 窗户主体 */}
      <div className="relative h-40 overflow-hidden rounded-xl border-4 border-[#8a6a4f] shadow-inner dark:border-[#6d5340]">
        {/* 天空 */}
        <div className="absolute inset-0 transition-[background] duration-1000" style={{ background: skyGradient(night, phase, rainy, snowy, overcast) }} />

        {/* 星星 */}
        {night &&
          STARS.map((s, i) => (
            <span key={i} className="hw-star" style={{ left: s.left, top: s.top, animationDelay: s.delay }} />
          ))}

        {/* 太阳 / 月亮 */}
        {!night && !rainy && !snowy && !overcast && (
          <span className="hw-sun" style={{ opacity: phase === "lateEvening" ? 0.6 : 1 }} />
        )}
        {night && <span className="hw-moon" />}

        {/* 云(雨/雪/阴天用灰色云,晴天白云) */}
        <div className="hw-cloud" style={{ top: "14%", animationDuration: "34s" }} data-dim={rainy || snowy || overcast || night ? "1" : undefined}>
          <i /><i /><i />
        </div>
        <div className="hw-cloud" style={{ top: "34%", animationDuration: "46s", animationDelay: "-18s" }} data-dim={rainy || snowy || overcast || night ? "1" : undefined}>
          <i /><i /><i />
        </div>

        {/* 雨滴划过玻璃 */}
        {rainy &&
          RAINDROPS.map((d, i) => (
            <span key={i} className="hw-raindrop" style={{ left: d.left, animationDelay: d.delay }} />
          ))}

        {/* 雪积窗台 */}
        {snowy && (
          <>
            <span className="hw-snowdrift" style={{ left: "-6%", height: "16px" }} />
            <span className="hw-snowdrift" style={{ left: "30%", height: "22px", opacity: 0.9 }} />
          </>
        )}

        {/* 屋内暖灯(呼吸) */}
        {lampOn && <span className="hw-lamp" />}

        {/* 窗内剪影:音乐播放时轻轻摇摆 */}
        <div className={`hw-figure${playing ? " hw-sway" : ""}`}>
          <i className="hw-head" />
          <i className="hw-body" />
        </div>

        {/* 窗棂 */}
        <span className="absolute left-1/2 top-0 z-10 h-full w-[3px] -translate-x-1/2 bg-[#8a6a4f]/80 dark:bg-[#6d5340]/80" />
        <span className="absolute left-0 top-1/2 z-10 h-[3px] w-full -translate-y-1/2 bg-[#8a6a4f]/80 dark:bg-[#6d5340]/80" />
      </div>

      {/* 窗台 */}
      <div className="mx-[-6px] mt-[-2px] h-2.5 rounded-b-lg bg-gradient-to-b from-[#a1785a] to-[#7d5a41]" />
    </div>
  );
}
