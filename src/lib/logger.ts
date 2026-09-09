import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 最小文件日志（零依赖，服务端专用——依赖 node:fs）：
 * 错误同时落到 stderr（pm2 日志会收走）和 data/logs/errors.log 的 JSON 行，
 * 供线上排障 grep。文件超 2MB 时只保留最近一半，避免无限增长。
 * 全部包裹 try/catch——日志自身永远不能成为新的故障源。
 */

const LOG_DIR = path.join(process.cwd(), "data", "logs");
const LOG_FILE = path.join(LOG_DIR, "errors.log");
const MAX_BYTES = 2 * 1024 * 1024;

function write(level: "error" | "info", scope: string, message: string, extra?: Record<string, unknown>) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    try {
      if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > MAX_BYTES) {
        const buf = readFileSync(LOG_FILE);
        writeFileSync(LOG_FILE, buf.subarray(buf.length - Math.floor(MAX_BYTES / 2)));
      }
    } catch {}
    appendFileSync(LOG_FILE, `${JSON.stringify({ t: new Date().toISOString(), level, scope, msg: message, ...(extra ?? {}) })}\n`);
  } catch {
    /* 落盘失败只能放弃——不能让日志把请求打挂 */
  }
  if (level === "error") console.error(`[${scope}] ${message}`);
}

/** err 为 unknown（catch 到的任何东西）；stack 与业务上下文放 extra */
export function logError(scope: string, err: unknown, extra?: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : String(err);
  write("error", scope, message, { stack: err instanceof Error ? err.stack : undefined, ...extra });
}

export function logInfo(scope: string, message: string, extra?: Record<string, unknown>) {
  write("info", scope, message, extra);
}
