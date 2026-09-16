import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { identityDigest } from "./identity";

export interface QuotaResult {
  ok: boolean;
  retryAfter: number;
}

let lastCleanup = 0;
let tableReady = false;

function ensureQuotaTable() {
  if (tableReady) return;
  db.$client.exec(`
    CREATE TABLE IF NOT EXISTS write_quota_counters (
      key TEXT PRIMARY KEY NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS write_quota_expires_idx ON write_quota_counters (expires_at);
  `);
  tableReady = true;
}

export function requestIpDigest(request: Request): string {
  return identityDigest("ip", clientIp(request));
}

export function burstQuota(
  policy: string,
  kind: "ip" | "visitor" | "user",
  identity: string,
  limit: number,
  windowMs: number,
): QuotaResult {
  if (kind === "ip" && identity === "unknown") return { ok: true, retryAfter: 0 };
  const digest = identityDigest(kind, identity);
  return rateLimit(`write:${policy}:${kind}:${digest}`, limit, windowMs);
}

/** 固定窗口持久配额；同步事务保证同一 SQLite 进程内的读改写原子。 */
export function persistentQuota(
  policy: string,
  kind: "ip" | "visitor" | "user" | "global",
  identity: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): QuotaResult {
  if (kind === "ip" && identity === "unknown") return { ok: true, retryAfter: 0 };
  ensureQuotaTable();
  const bucket = Math.floor(now / windowMs) * windowMs;
  const expiresAt = bucket + windowMs;
  const digest = kind === "global" ? "global" : identityDigest(kind, identity);
  const key = `${policy}:${kind}:${digest}:${bucket}`;

  const result = db.$client.transaction(() => {
    const row = db.$client.prepare("SELECT count FROM write_quota_counters WHERE key = ?").get(key) as
      | { count: number }
      | undefined;
    if (row && row.count >= limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((expiresAt - now) / 1000)) };
    }
    db.$client
      .prepare(
        `INSERT INTO write_quota_counters (key, count, expires_at) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = count + 1, expires_at = excluded.expires_at`,
      )
      .run(key, expiresAt);
    return { ok: true, retryAfter: 0 };
  })();

  if (now - lastCleanup > 60 * 60_000) {
    lastCleanup = now;
    db.$client.prepare("DELETE FROM write_quota_counters WHERE expires_at < ?").run(now);
  }
  return result;
}
