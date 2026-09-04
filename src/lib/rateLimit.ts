/** 内存滑动窗口限流（模块级单例）。
 *
 * dev 下热重载会重置模块 → 窗口清零，仅影响开发期计数，可接受；
 * 生产是单进程常驻，窗口持续有效；未来若多实例部署需换 Redis 之类共享存储。
 * Map 无限增长防护：超过 5000 个 key 时清扫空桶。
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    const retryAfter = Math.ceil((list[0]! + windowMs - now) / 1000);
    hits.set(key, list);
    return { ok: false, retryAfter };
  }
  list.push(now);
  hits.set(key, list);

  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}

/** 从请求头取客户端 IP（生产在 nginx 反代后面）。
 *  需要 nginx 配置：proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 *  （XFF 首段即真实客户端；取不到时退 x-real-ip，再退 "unknown" 共享桶）。 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** 每日计数器（内存，按服务器本地日期分桶）——防脚本低频长跑刷爆 API 账单。
 *  与 rateLimit 的区别：限流挡"快"，这里挡"久"。
 *  pm2 重启清零可接受（重启后从 0 重新累计，只损失当日已计额度，不会超卖）。
 *  Map 无限增长防护：超过 1000 个 key 时清扫过期日期桶。 */
const dayCounters = new Map<string, { d: string; n: number }>();

export function dailyCount(key: string, limit: number): { ok: boolean; resetIn: number } {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const cur = dayCounters.get(key);
  const entry = cur && cur.d === todayStr ? cur : { d: todayStr, n: 0 };
  if (entry.n >= limit) {
    dayCounters.set(key, entry);
    // 到本地午夜的秒数（Retry-After 用）
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    return { ok: false, resetIn: Math.max(1, Math.ceil((midnight - now.getTime()) / 1000)) };
  }
  entry.n += 1;
  dayCounters.set(key, entry);
  if (dayCounters.size > 1000) {
    for (const [k, v] of dayCounters) if (v.d !== todayStr) dayCounters.delete(k);
  }
  return { ok: true, resetIn: 0 };
}
