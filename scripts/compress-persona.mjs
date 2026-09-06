/**
 * AI 拟人图压缩管线：public/assets/persona/*.png（母版）→ 同目录 .webp（部署用）。
 *
 * 立绘显示高度仅 160~176px，原图 ~1100×2000+、单张 2MB+，纯属浪费带宽；
 * resize 到高 400px（约 2.3 倍 retina 余量）、头像到高 96px，WebP q82 保留透明通道。
 * 原始 PNG 请移到项目根 assets-src/persona/ 保存（不随 public 部署分发）；
 * 换图后重跑：node scripts/compress-persona.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

// 母版（PNG）与产物（webp）分开放：母版不随 public 部署分发
const SRC_DIR = path.resolve("assets-src/persona");
const OUT_DIR = path.resolve("public/assets/persona");
const FULL_HEIGHT = 400;
const AVATAR_HEIGHT = 128;
// 头像显示仅 24~32px 但会被进一步缩放采样，线稿类小图给更高的质量参数防糊
const FULL_QUALITY = 82;
const AVATAR_QUALITY = 92;

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function compress(file) {
  const src = path.join(SRC_DIR, file);
  const isFull = file.includes("-full.");
  const out = path.join(OUT_DIR, file.replace(/\.png$/, ".webp"));
  const before = fs.statSync(src).size;

  let pipeline = sharp(src).resize({ height: isFull ? FULL_HEIGHT : AVATAR_HEIGHT, withoutEnlargement: true });
  if (isFull) pipeline = pipeline.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const info = await pipeline
    .webp({ quality: isFull ? FULL_QUALITY : AVATAR_QUALITY, alphaQuality: 95 })
    .toFile(out);

  const after = info.size;
  console.log(
    `${file.replace(/\.png$/, "")}: ${kb(before)} → ${kb(after)} webp (${info.width}×${info.height})，省 ${Math.round((1 - after / before) * 100)}%`,
  );
  return { before, after };
}

const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".png"));
if (!files.length) {
  console.log(`在 ${SRC_DIR} 没找到 PNG 母版`);
  process.exit(0);
}

let totalBefore = 0;
let totalAfter = 0;
for (const f of files) {
  const r = await compress(f);
  totalBefore += r.before;
  totalAfter += r.after;
}
console.log(`\n合计：${kb(totalBefore)} → ${kb(totalAfter)}（省 ${Math.round((1 - totalAfter / totalBefore) * 100)}%）`);
