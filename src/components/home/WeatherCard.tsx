"use client";

import { useEffect, useState } from "react";

/* ===== 类型 ===== */
interface WeatherState {
  emoji: string;
  temp: number;
  desc: string;
  city: string;
  wind: number;
  uv: number; // 紫外线指数 0-11+
  aqi: number | null; // 空气质量指数
  aqiLabel: string;
  tomorrow: { emoji: string; max: number; min: number; desc: string };
  dayAfter: { emoji: string; max: number; min: number; desc: string };
  suggestion: string;
  hourlyMorningRain: boolean;
}

const CACHE_KEY = "cl-weather-v2";
const TTL = 30 * 60 * 1000;

/** WMO weather_code → 描述 + 图标 */
function describe(code: number): { emoji: string; desc: string } {
  if (code === 0) return { emoji: "☀️", desc: "晴" };
  if (code <= 2) return { emoji: "⛅", desc: "多云" };
  if (code === 3) return { emoji: "☁️", desc: "阴" };
  if (code <= 48) return { emoji: "🌫️", desc: "雾" };
  if (code <= 57) return { emoji: "🌦️", desc: "毛毛雨" };
  if (code <= 67) return { emoji: "🌧️", desc: "雨" };
  if (code <= 77) return { emoji: "🌨️", desc: "雪" };
  if (code <= 82) return { emoji: "🌧️", desc: "阵雨" };
  if (code <= 86) return { emoji: "🌨️", desc: "阵雪" };
  return { emoji: "⛈️", desc: "雷暴" };
}

function uvLabel(uv: number) {
  if (uv < 3) return "弱";
  if (uv < 6) return "中等";
  if (uv < 8) return "强";
  if (uv < 11) return "很强";
  return "极强";
}

function aqiInfo(aqi: number | null) {
  if (aqi == null) return { label: "—", color: "text-muted" };
  if (aqi <= 50) return { label: "优", color: "text-emerald-500" };
  if (aqi <= 100) return { label: "良", color: "text-amber-500" };
  if (aqi <= 150) return { label: "轻度污染", color: "text-orange-500" };
  if (aqi <= 200) return { label: "中度污染", color: "text-rose-500" };
  return { label: "重度污染", color: "text-purple-500" };
}

/** 依据天气/UV/AQI 生成一句生活建议 */
function makeSuggestion(s: {
  desc: string;
  uv: number;
  aqi: number | null;
  maxT: number;
  minT: number;
  morningRain: boolean;
}): string {
  const tips: string[] = [];
  const morning = new Date().getHours() < 12;

  if (s.desc === "晴" && (morning ? s.uv >= 0 : s.uv >= 3))
    tips.push(morning ? "今天上午有太阳，多去晒晒太阳吧 ☀️" : "今天阳光不错，适合出门走走 ☀️");
  if (s.uv >= 8) tips.push("紫外线很强，出门记得防晒 🧴");
  else if (s.uv >= 6) tips.push("紫外线偏强，建议涂点防晒 🕶️");

  if (["雨", "阵雨", "雷暴", "毛毛雨"].includes(s.desc) || s.morningRain)
    tips.push(s.morningRain && morning ? "上午有雨，出门带把伞 ☔" : "有雨，记得带伞 ☔");
  if (["雪", "阵雪"].includes(s.desc)) tips.push("下雪路滑，出行小心 🌨️");
  if (s.desc === "雾") tips.push("有雾，开车注意安全 🌫️");

  if (s.aqi != null && s.aqi > 150) tips.push("空气质量不佳，减少户外运动 😷");
  else if (s.aqi != null && s.aqi <= 50) tips.push("空气很清新，适合开窗通风 🍃");

  if (s.maxT >= 33) tips.push("天气炎热，多喝水补水 💧");
  if (s.minT <= 3) tips.push("气温较低，注意保暖 🧣");

  if (!tips.length) {
    if (["多云", "阴"].includes(s.desc)) tips.push("天气舒适，适合出去散散步 🚶");
    else tips.push("今天也是适合认真生活的一天 ✨");
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

        const { emoji, desc } = describe(cur.weather_code ?? 0);
        const daily = wx.daily;
        const dayWeather = (i: number) => {
          const code = daily?.weather_code?.[i] ?? 0;
          const d = describe(code);
          return {
            emoji: d.emoji,
            desc: d.desc,
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
          emoji,
          temp: Math.round(cur.temperature_2m),
          desc,
          city: loc.city || "本地",
          wind: Math.round(cur.wind_speed_10m ?? 0),
          uv,
          aqi,
          aqiLabel: aqiInfo(aqi).label,
          tomorrow,
          dayAfter,
          hourlyMorningRain: morningRain,
          suggestion: makeSuggestion({
            desc,
            uv,
            aqi,
            maxT: daily?.temperature_2m_max?.[0] ?? cur.temperature_2m,
            minT: daily?.temperature_2m_min?.[0] ?? cur.temperature_2m,
            morningRain,
          }),
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

  return (
    <div className="glass-card glass-hover p-4">
      {/* 当前 */}
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {weather.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight">
            {weather.temp}°C <span className="text-sm font-normal text-muted">{weather.desc}</span>
          </p>
          <p className="text-xs text-muted">
            {weather.city} · 风速 {weather.wind} km/h
          </p>
        </div>
      </div>

      {/* 指标条：紫外线 + 空气质量 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-accent-soft px-2.5 py-1.5">
          <p className="text-[10px] text-muted">紫外线</p>
          <p className="text-xs font-semibold">
            {weather.uv} · {uvLabel(weather.uv)}
          </p>
        </div>
        <div className="rounded-xl bg-accent-soft px-2.5 py-1.5">
          <p className="text-[10px] text-muted">空气质量</p>
          <p className={`text-xs font-semibold ${aqiInfo(weather.aqi).color}`}>
            {weather.aqi ?? "—"} · {weather.aqiLabel}
          </p>
        </div>
      </div>

      {/* 未来两天 */}
      <div className="mt-2.5 flex gap-2">
        {(
          [
            ["明天", weather.tomorrow],
            ["后天", weather.dayAfter],
          ] as const
        ).map(([label, d]) => (
          <div key={label} className="flex flex-1 items-center gap-2 rounded-xl px-2 py-1.5" style={{ background: "color-mix(in srgb, var(--glass-bg) 60%, transparent)" }}>
            <span className="text-lg leading-none">{d.emoji}</span>
            <div className="min-w-0 text-[11px] leading-tight">
              <p className="text-muted">{label}</p>
              <p className="font-medium">
                {d.min}° / {d.max}° {d.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 生活建议 */}
      <p className="mt-2.5 rounded-xl bg-accent-soft px-3 py-2 text-xs leading-relaxed">
        💡 {weather.suggestion}
      </p>
    </div>
  );
}
