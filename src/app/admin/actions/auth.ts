"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { createSession, destroySession } from "@/lib/auth";
import { dailyCount, rateLimit } from "@/lib/rateLimit";

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return "请输入账号和密码";

  const h = await headers();
  const ip = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`login:${ip}`, 5, 60_000).ok) return "尝试过于频繁，请 1 分钟后再试";
  if (!dailyCount(`login-day:${ip}`, 30).ok) return "今日尝试次数过多，请明天再试";

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return "账号或密码错误";
  await createSession(username);
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}
