import { beforeAll, describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  attachAnonymousVisitorCookie,
  resolveAnonymousVisitor,
} from "@/lib/public-write/identity";
import { assertSameOrigin } from "@/lib/public-write/guard";
import { PublicWriteError, readJson } from "@/lib/public-write/json";

beforeAll(() => {
  process.env.AUTH_SECRET = "public-write-test-secret-that-is-long-enough";
});

describe("anonymous visitor session", () => {
  it("adopts a legacy id once, then the signed cookie overrides request input", async () => {
    const firstRequest = new Request("https://blog.test/api/player");
    const first = await resolveAnonymousVisitor(firstRequest, "v-legacy");
    expect(first).toEqual({ visitorId: "v-legacy", issueCookie: true });

    const response = await attachAnonymousVisitorCookie(
      NextResponse.json({ ok: true }),
      firstRequest,
      first,
    );
    const setCookie = response.headers.get("set-cookie")!;
    expect(setCookie).toContain("cl_visitor=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Secure");

    const cookie = setCookie.split(";", 1)[0]!;
    const next = await resolveAnonymousVisitor(
      new Request("https://blog.test/api/player", { headers: { cookie } }),
      "v-attacker",
    );
    expect(next).toEqual({ visitorId: "v-legacy", issueCookie: false });
  });

  it("replaces a tampered token instead of trusting it", async () => {
    const result = await resolveAnonymousVisitor(
      new Request("https://blog.test/api/player", {
        headers: { cookie: "cl_visitor=not-a-jwt" },
      }),
      "v-migrated",
    );
    expect(result).toEqual({ visitorId: "v-migrated", issueCookie: true });
  });
});

describe("public JSON guard", () => {
  const schema = z.object({ value: z.string().max(4) }).strict();

  it("rejects unsupported media types", async () => {
    const promise = readJson(new Request("https://blog.test/api/write", { method: "POST", body: "{}" }), schema);
    await expect(promise).rejects.toMatchObject<Partial<PublicWriteError>>({ status: 415 });
  });

  it("checks both declared and actual payload sizes", async () => {
    const declared = readJson(
      new Request("https://blog.test/api/write", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": "999" },
        body: "{}",
      }),
      schema,
      32,
    );
    await expect(declared).rejects.toMatchObject<Partial<PublicWriteError>>({ status: 413 });

    const actual = readJson(
      new Request("https://blog.test/api/write", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "0123456789" }),
      }),
      schema,
      12,
    );
    await expect(actual).rejects.toMatchObject<Partial<PublicWriteError>>({ status: 413 });
  });

  it("rejects cross-origin browser writes but permits requests without Origin", () => {
    expect(() =>
      assertSameOrigin(
        new Request("https://blog.test/api/write", {
          headers: { origin: "https://evil.test" },
        }),
      ),
    ).toThrowError(PublicWriteError);
    expect(() => assertSameOrigin(new Request("https://blog.test/api/write"))).not.toThrow();
  });
});
