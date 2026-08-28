"use client";

import { useEffect, useState } from "react";

interface WeatherState {
  emoji: string;
  temp: number;
  desc: string;
  city: string;
  wind: number;
}

const CACHE_KEY = "cl-weather";
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

async function fetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 天气小组件：IP 定位（3s 超时）→ Open-Meteo 实况；缓存 30 分钟；失败静默隐藏 */
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
        // ipwho.is 官方支持浏览器跨域；失败则整卡静默隐藏
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

        const wxRes = await fetchWithTimeout(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code,wind_speed_10m`,
          4000,
        );
        if (!wxRes.ok || cancelled) return;
        const wx = (await wxRes.json()) as {
          current?: {
            temperature_2m?: number;
            weather_code?: number;
            wind_speed_10m?: number;
          };
        };
        const cur = wx.current;
        if (cur?.temperature_2m == null || cancelled) return;

        const { emoji, desc } = describe(cur.weather_code ?? 0);
        const data: WeatherState = {
          emoji,
          temp: Math.round(cur.temperature_2m),
          desc,
          city: loc.city || "本地",
          wind: Math.round(cur.wind_speed_10m ?? 0),
        };
        setWeather(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        } catch {}
      } catch {
        // 定位或天气服务不可达：保持隐藏
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!weather) return null;

  return (
    <div className="glass-card glass-hover flex items-center gap-4 px-5 py-4">
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
  );
}
