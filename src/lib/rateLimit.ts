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
