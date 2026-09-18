/**
 * 本地一键导入 content/posts/ 下的全部 Markdown 文章（按 slug 幂等 upsert，
 * 重复执行安全；不清空任何现有数据——与 seed 的"清空重写"语义无关）。
 * 云端发布请优先用后台「文章 → 从内容目录导入」按钮；此脚本供本地/ssh 场景使用。
 * 用法：npx tsx scripts/import-posts.ts
 */
import { importPostsFromContentDir } from "../src/lib/content/import-markdown";

async function main() {
  const results = await importPostsFromContentDir();
  if (!results.length) {
    console.log("content/posts/ 目录为空或不存在，未导入任何文章。");
    return;
  }
  for (const r of results) {
    const mark = r.outcome === "created" ? "＋" : r.outcome === "updated" ? "↻" : "✗";
    console.log(`${mark} ${r.file} → ${r.slug || "-"} [${r.outcome}]${r.note ? `：${r.note}` : ""}`);
  }
  const created = results.filter((r) => r.outcome === "created").length;
  const updated = results.filter((r) => r.outcome === "updated").length;
  const failed = results.filter((r) => r.outcome === "error").length;
  console.log(`\n导入完成：新建 ${created} · 更新 ${updated} · 失败 ${failed}`);
}

void main();
