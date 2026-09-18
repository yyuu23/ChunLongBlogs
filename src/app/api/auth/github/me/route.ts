export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/github-user";

/** 客户端组件 hydrate 登录态用（头像/昵称展示） */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
