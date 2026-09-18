/**
 * 时段分桶:全站统一的时段口径(与 /api/player 的 touchVisit 夜访/晨访判定一致)。
 * 纯函数只收小时数,不读时钟,SSR 安全;渲染层数据只能客户端取,不进服务端 HTML。
 */
export type TimeBucket =
  | "lateNight" // 0-4 深夜
  | "dawn" // 5-7 清晨
  | "morning" // 8-11 上午
  | "afternoon" // 12-17 午后
  | "evening" // 18-22 傍晚
  | "lateEvening"; // 23 将近深夜

export function timeBucket(h: number): TimeBucket {
  if (h < 5) return "lateNight";
  if (h < 8) return "dawn";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  if (h < 23) return "evening";
  return "lateEvening";
}

/** 深夜模式判定(0-4 点),与 timeBucket("lateNight") 同口径 */
export function isNightHour(h: number): boolean {
  return h < 5;
}
