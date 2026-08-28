import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

// drizzle-kit 不自动读 .env，这里手动加载（不覆盖已有环境变量）
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)?\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

const dbPath = process.env.DATABASE_PATH ?? "data/db.sqlite";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbPath,
  },
});
