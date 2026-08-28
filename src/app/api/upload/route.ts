import { NextResponse } from "next/server";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

/** 图片上传：POST multipart/form-data，字段名 file；保存到 public/uploads */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少文件" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: `不支持的图片类型：${file.type || "未知"}` }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "图片不能超过 5MB" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  await pipeline(Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(path.join(dir, name)));

  return NextResponse.json({ url: `/uploads/${name}` });
}
