"use client";

import { useEffect, useState } from "react";
import { useT, type T } from "@/components/providers/LocaleProvider";

/* ===== 类型 =====
 * 状态与缓存只保存语言中立的原始数据（天气码分桶 + 数值），
 * 展示文案在渲染时按当前语言生成 —— 切语言后缓存依然有效。
 */
interface WeatherState {
  bucket: WeatherBucket; // 当前天气分桶（weather.codes.* 词典键）
  temp: number;
  city: string;
  wind: number;
  uv: number; // 紫外线指数 0-11+
  aqi: number | null; // 空气质量指数
  todayMax: number;
  todayMin: number;
  tomorrow: { bucket: WeatherBucket; max: number; min: number };
  dayAfter: { bucket: WeatherBucket; max: number; min: number };
  morningRain: boolean;
}

type WeatherBucket =
  | "clear"
  | "cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "showers"
  | "snowShowers"
  | "thunder";

const CACHE_KEY = "cl-weather-v3";
const TTL = 30 * 60 * 1000;

/** WMO weather_code → 图标 + 语义分桶（分桶名即词典键，语言无关） */
function describe(code: number): { emoji: string; bucket: WeatherBucket } {
  if (code === 0) return { emoji: "☀️", bucket: "clear" };
  if (code <= 2) return { emoji: "⛅", bucket: "cloudy" };
  if (code === 3) return { emoji: "☁️", bucket: "overcast" };
  if (code <= 48) return { emoji: "🌫️", bucket: "fog" };
  if (code <= 57) return { emoji: "🌦️", bucket: "drizzle" };
  if (code <= 67) return { emoji: "🌧️", bucket: "rain" };
  if (code <= 77) return { emoji: "🌨️", bucket: "snow" };
  if (code <= 82) return { emoji: "🌧️", bucket: "showers" };
  if (code <= 86) return { emoji: "🌨️", bucket: "snowShowers" };
  return { emoji: "⛈️", bucket: "thunder" };
}

/** 该分桶是否属于"雨天"（逻辑判断基于分桶而非译文，跨语言安全） */
const isRainy = (b: WeatherBucket) => b === "rain" || b === "showers" || b === "thunder" || b === "drizzle";
const isSnowy = (b: WeatherBucket) => b === "snow" || b === "snowShowers";

function uvKey(uv: number) {
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "veryHigh";
  return "extreme";
}

function aqiInfo(aqi: number | null) {
  if (aqi == null) return { key: "moderate", color: "text-muted" };
  if (aqi <= 50) return { key: "good", color: "text-emerald-500" };
  if (aqi <= 100) return { key: "moderate", color: "text-amber-500" };
  if (aqi <= 150) return { key: "lightPollution", color: "text-orange-500" };
  if (aqi <= 200) return { key: "moderatePollution", color: "text-rose-500" };
  return { key: "heavyPollution", color: "text-purple-500" };
}

/** 依据天气/UV/AQI 生成一句生活建议（按当前语言） */
function makeSuggestion(
  t: T,
  s: {
    bucket: WeatherBucket;
    uv: number;
    aqi: number | null;
    maxT: number;
    minT: number;
    morningRain: boolean;
  },
): string {
  const tips: string[] = [];
  const morning = new Date().getHours() < 12;

  if (s.bucket === "clear" && (morning ? s.uv >= 0 : s.uv >= 3))
    tips.push(morning ? t("weather.tips.sunMorning") : t("weather.tips.sunDay"));
  if (s.uv >= 8) tips.push(t("weather.tips.uvHigh"));
  else if (s.uv >= 6) tips.push(t("weather.tips.uvMid"));

  if (isRainy(s.bucket) || s.morningRain)
    tips.push(s.morningRain && morning ? t("weather.tips.rainMorning") : t("weather.tips.rain"));
  if (isSnowy(s.bucket)) tips.push(t("weather.tips.snow"));
  if (s.bucket === "fog") tips.push(t("weather.tips.fog"));

  if (s.aqi != null && s.aqi > 150) tips.push(t("weather.tips.airBad"));
  else if (s.aqi != null && s.aqi <= 50) tips.push(t("weather.tips.airGood"));

  if (s.maxT >= 33) tips.push(t("weather.tips.hot"));
  if (s.minT <= 3) tips.push(t("weather.tips.cold"));

  if (!tips.length) {
    if (s.bucket === "cloudy" || s.bucket === "overcast") tips.push(t("weather.tips.comfy"));
    else tips.push(t("weather.tips.defaultTip"));
  }
  return tips.slice(0, 2).join("；");
}

async function fetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 天气小组件：IP 定位 → Open-Meteo（实况+UV+逐时+2日预报）+ 空气质量；缓存 30 分钟；失败静默隐藏 */
export function WeatherCard() {
  const t = useT();
  const [weather, setWeather] = useState<WeatherState | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as { at: number; data: WeatherState };
          if (Date.now() - parsed.at < TTL) {
            setWeather(parsed.data);
            return;
          }
        }
      } catch {}

      try {
        // 1. 定位（ipwho.is 支持浏览器跨域）
        const locRes = await fetchWithTimeout("https://ipwho.is/", 3500);
        if (!locRes.ok) return;
        const loc = (await locRes.json()) as {
          success?: boolean;
          latitude?: number;
          longitude?: number;
          city?: string;
        };
        if (loc.success === false || loc.latitude == null || loc.longitude == null || cancelled)
          return;

        // 2. 天气（当前 + UV + 逐时降水 + 未来 2 天）
        const wxRes = await fetchWithTimeout(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
            `&current=temperature_2m,weather_code,wind_speed_10m` +
            `&hourly=precipitation_probability` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset` +
            `&forecast_days=3&timezone=auto`,
          5000,
        );
        if (!wxRes.ok || cancelled) return;
        const wx = (await wxRes.json()) as {
          current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number };
          daily?: {
            time?: string[];
            weather_code?: number[];
            temperature_2m_max?: number[];
            temperature_2m_min?: number[];
            uv_index_max?: number[];
          };
          hourly?: { time?: string[]; precipitation_probability?: number[] };
        };
        const cur = wx.current;
        if (cur?.temperature_2m == null || cancelled) return;

        // 3. 空气质量（可失败，独立降级）
        let aqi: number | null = null;
        try {
          const airRes = await fetchWithTimeout(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.latitude}&longitude=${loc.longitude}` +
              `&current=european_aqi,us_aqi&timezone=auto`,
            4000,
          );
          if (airRes.ok) {
            const air = (await airRes.json()) as {
              current?: { us_aqi?: number; european_aqi?: number };
            };
            aqi = Math.round(air.current?.us_aqi ?? air.current?.european_aqi ?? NaN) || null;
          }
        } catch {}

        const curWx = describe(cur.weather_code ?? 0);
        const daily = wx.daily;
        const dayWeather = (i: number) => {
          const d = describe(daily?.weather_code?.[i] ?? 0);
          return {
            bucket: d.bucket,
            max: Math.round(daily?.temperature_2m_max?.[i] ?? 0),
            min: Math.round(daily?.temperature_2m_min?.[i] ?? 0),
          };
        };
        const tomorrow = dayWeather(1);
        const dayAfter = dayWeather(2);

        // 今晨（6-11 点）降水概率 > 40%？
        let morningRain = false;
        const times = wx.hourly?.time ?? [];
        const probs = wx.hourly?.precipitation_probability ?? [];
        const todayStr = new Date().toISOString().slice(0, 10);
        for (let i = 0; i < times.length; i++) {
          if (times[i]?.startsWith(todayStr)) {
            const h = Number(times[i]?.slice(11, 13));
            if (h >= 6 && h <= 11 && (probs[i] ?? 0) > 40) {
              morningRain = true;
              break;
            }
          }
        }

        const uv = Math.round((daily?.uv_index_max?.[0] ?? 0) * 10) / 10;
        const data: WeatherState = {
          bucket: curWx.bucket,
          temp: Math.round(cur.temperature_2m),
          city: loc.city || "",
          wind: Math.round(cur.wind_speed_10m ?? 0),
          uv,
          aqi,
          todayMax: Math.round(daily?.temperature_2m_max?.[0] ?? cur.temperature_2m),
          todayMin: Math.round(daily?.temperature_2m_min?.[0] ?? cur.temperature_2m),
          tomorrow,
          dayAfter,
          morningRain,
        };
        setWeather(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        } catch {}
      } catch {
        // 服务不可达：保持隐藏
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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

/** 分桶 → 图标（渲染期使用） */
function describeByBucket(bucket: WeatherBucket): string {
  const table: Record<WeatherBucket, string> = {
    clear: "☀️",
    cloudy: "⛅",
    overcast: "☁️",
    fog: "🌫️",
    drizzle: "🌦️",
    rain: "🌧️",
    snow: "🌨️",
    showers: "🌧️",
    snowShowers: "🌨️",
    thunder: "⛈️",
  };
  return table[bucket];
}
