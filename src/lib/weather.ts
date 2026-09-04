"use client";

import { useEffect, useState } from "react";
import type { T } from "@/components/providers/LocaleProvider";

/* ===== 类型 =====
 * 状态与缓存只保存语言中立的原始数据（天气码分桶 + 数值），
 * 展示文案在渲染时按当前语言生成 —— 切语言后缓存依然有效。
 */
export interface WeatherState {
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
  /** 当日日出/日落（访客当地时刻的分钟数，open-meteo timezone=auto）；旧缓存无此字段走启发式 */
  sunrise?: number;
  sunset?: number;
}

export type WeatherBucket =
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
export function describe(code: number): { emoji: string; bucket: WeatherBucket } {
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
export const isRainy = (b: WeatherBucket) =>
  b === "rain" || b === "showers" || b === "thunder" || b === "drizzle";
export const isSnowy = (b: WeatherBucket) => b === "snow" || b === "snowShowers";

export function uvKey(uv: number) {
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "veryHigh";
  return "extreme";
}

export function aqiInfo(aqi: number | null) {
  if (aqi == null) return { key: "moderate", color: "text-muted" };
  if (aqi <= 50) return { key: "good", color: "text-emerald-500" };
  if (aqi <= 100) return { key: "moderate", color: "text-amber-500" };
  if (aqi <= 150) return { key: "lightPollution", color: "text-orange-500" };
  if (aqi <= 200) return { key: "moderatePollution", color: "text-rose-500" };
  return { key: "heavyPollution", color: "text-purple-500" };
}

/** 依据天气/UV/AQI 生成一句生活建议（按当前语言） */
export function makeSuggestion(
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

/** 分桶 → 图标（渲染期使用） */
export function describeByBucket(bucket: WeatherBucket): string {
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

async function fetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** "HH:MM"（当地时刻）→ 当日分钟数 */
function hhmmToMinutes(s: string | undefined): number | undefined {
  if (!s || s.length < 16) return undefined;
  const h = Number(s.slice(11, 13));
  const m = Number(s.slice(14, 16));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;
  return h * 60 + m;
}

/**
 * 完整加载链：缓存（30 分钟，过期 stale-while-revalidate）→ IP 定位 → Open-Meteo（实况+UV+逐时+2日预报+日出日落）+ 空气质量。
 * 模块级 in-flight 去重：天气卡与小屋窗同屏时只发一套请求。
 */
let inFlight: Promise<WeatherState | null> | null = null;

export function loadWeather(): Promise<WeatherState | null> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { at: number; data: WeatherState };
        if (Date.now() - parsed.at < TTL) return parsed.data;
      }
    } catch {}

    try {
      // 1. 定位（ipwho.is 支持浏览器跨域）
      const locRes = await fetchWithTimeout("https://ipwho.is/", 3500);
      if (!locRes.ok) return null;
      const loc = (await locRes.json()) as {
        success?: boolean;
        latitude?: number;
        longitude?: number;
        city?: string;
      };
      if (loc.success === false || loc.latitude == null || loc.longitude == null) return null;

      // 2. 天气（当前 + UV + 逐时降水 + 未来 2 天）
      const wxRes = await fetchWithTimeout(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
          `&current=temperature_2m,weather_code,wind_speed_10m` +
          `&hourly=precipitation_probability` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset` +
          `&forecast_days=3&timezone=auto`,
        5000,
      );
      if (!wxRes.ok) return null;
      const wx = (await wxRes.json()) as {
        current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number };
        daily?: {
          time?: string[];
          weather_code?: number[];
          temperature_2m_max?: number[];
          temperature_2m_min?: number[];
          uv_index_max?: number[];
          sunrise?: string[];
          sunset?: string[];
        };
        hourly?: { time?: string[]; precipitation_probability?: number[] };
      };
      const cur = wx.current;
      if (cur?.temperature_2m == null) return null;

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
        tomorrow: dayWeather(1),
        dayAfter: dayWeather(2),
        morningRain,
        sunrise: hhmmToMinutes(daily?.sunrise?.[0]),
        sunset: hhmmToMinutes(daily?.sunset?.[0]),
      };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
      } catch {}
      return data;
    } catch {
      return null; // 服务不可达
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** 现在是否黑夜：优先按日出日落，缺数据时回退 6-19 点启发式 */
function isNightNow(w: WeatherState | null): boolean {
  const now = new Date();
  const m = now.getHours() * 60 + now.getMinutes();
  if (w?.sunrise != null && w?.sunset != null) return m < w.sunrise || m >= w.sunset;
  const h = now.getHours();
  return h < 6 || h >= 19;
}

/**
 * 天气数据源 hook（天气卡与小屋窗共用）：
 * 浏览器空闲后才发请求（不与首屏资源抢连接），night 按日出日落每分钟重算。
 */
export function useWeather(): { weather: WeatherState | null; night: boolean } {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [night, setNight] = useState(false);

  useEffect(() => {
    // 三个外部 API（ipwho.is → open-meteo → air-quality）在大陆访问都慢，
    // 等浏览器空闲再发，避免与首屏字体/图片抢 HTTP/1.1 的有限连接数
    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const start = () => {
      void loadWeather().then((d) => {
        if (d) setWeather(d);
      });
    };
    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(start, { timeout: 3000 });
    } else {
      timerId = setTimeout(start, 2000);
    }
    return () => {
      if (idleId !== null) cancelIdleCallback(idleId);
      if (timerId !== null) clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    const apply = () => setNight(isNightNow(weather));
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, [weather]);

  return { weather, night };
}
