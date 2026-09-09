import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH ?? "data/db.sqlite";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const globalForDb = globalThis as unknown as { __clSqlite?: Database.Database };

const sqlite = globalForDb.__clSqlite ?? new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
// 写锁冲突时等待而非立刻抛 SQLITE_BUSY（单进程下罕见，给同步事务兜底）
sqlite.pragma("busy_timeout = 5000");
globalForDb.__clSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export * as tables from "./schema";
