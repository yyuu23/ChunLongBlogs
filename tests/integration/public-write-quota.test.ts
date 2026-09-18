import { beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

beforeAll(() => {
  process.env.AUTH_SECRET = "persistent-quota-test-secret-that-is-long-enough";
  process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "cl-quota-")), "quota.sqlite");
});

describe("persistent public-write quota", () => {
  it("survives a module reload, like a PM2 process restart", async () => {
    const firstModule = await import("@/lib/public-write/quota");
    const now = Date.now();
    expect(firstModule.persistentQuota("restart", "visitor", "visitor-a", 1, 86_400_000, now).ok).toBe(true);

    vi.resetModules();
    const reloadedModule = await import("@/lib/public-write/quota");
    const result = reloadedModule.persistentQuota(
      "restart",
      "visitor",
      "visitor-a",
      1,
      86_400_000,
      now + 1,
    );
    expect(result.ok).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
