"use client";

import { useT } from "@/components/providers/LocaleProvider";
import { useWeather, describeByBucket, uvKey, aqiInfo, makeSuggestion } from "@/lib/weather";

/** 天气小组件：数据走 useWeather（与小屋窗共用一套请求/缓存），失败静默隐藏 */
export function WeatherCard() {
  const t = useT();
  const { weather } = useWeather();

  if (!weather) return null;

  const emoji = describeByBucket(weather.bucket);
  const aqiCur = aqiInfo(weather.aqi);

  return (
    <div className="glass-card glass-hover p-4">
      {/* 当前 */}
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight">
            {weather.temp}°C <span className="text-sm font-normal text-muted">{t(`weather.codes.${weather.bucket}`)}</span>
          </p>
          <p className="text-xs text-muted">
            {weather.city || t("weather.localCity")} · {t("weather.windSpeed", { n: weather.wind })}
          </p>
        </div>
      </div>

      {/* 指标条：紫外线 + 空气质量 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-accent-soft px-2.5 py-1.5">
          <p className="text-[10px] text-muted">{t("weather.uv.label")}</p>
          <p className="text-xs font-semibold">
            {weather.uv} · {t(`weather.uv.${uvKey(weather.uv)}`)}
          </p>
        </div>
        <div className="rounded-xl bg-accent-soft px-2.5 py-1.5">
          <p className="text-[10px] text-muted">{t("weather.aqi.label")}</p>
          <p className={`text-xs font-semibold ${aqiCur.color}`}>
            {weather.aqi ?? "—"} · {t(`weather.aqi.${aqiCur.key}`)}
          </p>
        </div>
      </div>

      {/* 未来两天 */}
      <div className="mt-2.5 flex gap-2">
        {(
          [
            [t("weather.tomorrow"), weather.tomorrow],
            [t("weather.dayAfter"), weather.dayAfter],
          ] as const
        ).map(([label, d]) => (
          <div key={label} className="flex flex-1 items-center gap-2 rounded-xl px-2 py-1.5" style={{ background: "color-mix(in srgb, var(--glass-bg) 60%, transparent)" }}>
            <span className="text-lg leading-none">{describeByBucket(d.bucket)}</span>
            <div className="min-w-0 text-[11px] leading-tight">
              <p className="text-muted">{label}</p>
              <p className="font-medium">
                {d.min}° / {d.max}° {t(`weather.codes.${d.bucket}`)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 生活建议 */}
      <p className="mt-2.5 rounded-xl bg-accent-soft px-3 py-2 text-xs leading-relaxed">
        💡 {makeSuggestion(t, {
          bucket: weather.bucket,
          uv: weather.uv,
          aqi: weather.aqi,
          maxT: weather.todayMax,
          minT: weather.todayMin,
          morningRain: weather.morningRain,
        })}
      </p>
    </div>
  );
}
