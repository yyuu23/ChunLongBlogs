/**
 * 站点统一「业务日」键（YYYY-MM-DD，固定按北京时间 Asia/Shanghai）。
 *
 * 为什么需要它：签到、每日积分额度、节日/天气判定等「过没过一天」的口径
 * 曾在全库混用 UTC（`toISOString().slice(0, 10)`）与服务器本地时间——
 * 北京时间 0-8 点会被算成「前一天」（春节凌晨显示除夕、晨雨查错天、
 * 签到记错日、积分额度早 8 点才刷新）。凡「以天为单位结算」的业务语义
 * 一律走本函数，与部署环境的 TZ 设置解耦（en-CA locale 稳定输出
 * YYYY-MM-DD）。正例参考 credits.ts 的 isDeepSeekPeakNow 同口径。
 *
 * 服务端与客户端组件共用，勿加 server-only。
 */

/** Intl.DateTimeFormat 构建成本高（player 路由每请求多次调用），模块级缓存 */
let cached: Intl.DateTimeFormat | null = null;

/** 取某时刻的北京时间日期键；缺省当前时刻 */
export function dateKey(d: Date = new Date()): string {
  try {
    const fmt = (cached ??= new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }));
    return fmt.format(d);
  } catch {
    // 极端运行环境不认识时区名：退回 UTC 日期，宁可口径统一也不抛错。
    // 构造失败不缓存（cached 复位），环境恢复后下次调用自动重试。
    cached = null;
    return d.toISOString().slice(0, 10);
  }
}
