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
globalForDb.__clSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export * as tables from "./schema";
