import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const isWindows = process.platform === "win32";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    hookTimeout: 30_000,
    // better-sqlite3 与各测试自己的 DATABASE_PATH 都是进程级状态。
    // Windows 下串行 fork 隔离，换取稳定性；Linux CI 继续并行。
    pool: isWindows ? "forks" : undefined,
    fileParallelism: !isWindows,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
