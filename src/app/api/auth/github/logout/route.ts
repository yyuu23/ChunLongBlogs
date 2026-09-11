export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { destroyUserSession } from "@/lib/authUser";

export async function POST() {
  await destroyUserSession();
  return NextResponse.json({ ok: true });
}
