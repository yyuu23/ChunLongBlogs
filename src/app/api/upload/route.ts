import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { requireAdminApi } from "@/lib/auth";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

/* 不再收 image/svg+xml：SVG 可内嵌 <script>，落盘在同源 public/ 下、直接
 * 导航到该 URL 即同源执行脚本（XSS）。要传矢量图请先自行转 png/webp；
 * 若日后确需 SVG，必须加服务端净化（如 DOMPurify）后再放开。 */
const ALLOWED: Record<string, "raster" | "gif"> = {
  "image/jpeg": "raster",
  "image/png": "raster",
  "image/webp": "raster",
  "image/avif": "raster",
  "image/gif": "gif",
};

/** 图片上传：POST multipart/form-data，字段名 file；保存到 public/uploads。
 *  位图经 sharp 转 WebP（q82、长边≤2560）——手机原图普遍 4000px/3-8MB，
 *  原样直出等于让每个访客为带宽买单；gif 直传保动画。 */
export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少文件" }, { status: 400 });
  }
  const kind = ALLOWED[file.type];
  if (!kind) {
    return NextResponse.json({ error: `不支持的图片类型：${file.type || "未知"}（SVG 请先转为 PNG/WebP）` }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "图片不能超过 5MB" }, { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  let ext: string;
  if (kind === "gif") {
    output = input;
    ext = "gif";
  } else {
    try {
      // rotate() 按 EXIF 方向摆正；fit inside + withoutEnlargement 只缩不放
      output = await sharp(input)
        .rotate()
        .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      ext = "webp";
    } catch (err) {
      // 声明的 MIME 与内容对不上（伪装扩展名的损坏文件）——sharp 解码失败
      logError("upload/sharp", err, { type: file.type, size: file.size });
      return NextResponse.json({ error: "图片解析失败，文件可能已损坏或扩展名与内容不符" }, { status: 400 });
    }
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, name), output);

  return NextResponse.json({ url: `/uploads/${name}` });
}
