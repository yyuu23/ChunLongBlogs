import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  albums,
  categories,
  friendLinks,
  moments,
  photos,
  playlists,
  postTags,
  posts,
  siteConfigs,
  songs,
  tags,
} from "@/lib/db/schema";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 导出全部内容为 JSON 备份（GET，浏览器 <a download> 直接触发下载）。
 *
 * 范围：作者创作内容 + 站点配置（10 张表 + siteConfigs）。
 * 有意排除：admin_users（密码哈希，跨部署无意义且危险）、
 * visitors（访客游戏化数据，绑定匿名 UUID）、stars（访客留言，
 * 属"站点记忆"，整库迁移时本就在 db.sqlite 里）、embeddings（可在后台重建）。
 * 注意：图片文件在 public/uploads/，不在本备份内，换服务器需单独拷贝。
 */
export async function GET() {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const [
    categoryRows,
    tagRows,
    postRows,
    postTagRows,
    momentRows,
    friendRows,
    albumRows,
    photoRows,
    playlistRows,
    songRows,
    siteRows,
  ] = await Promise.all([
    db.select().from(categories),
    db.select().from(tags),
    db.select().from(posts),
    db.select().from(postTags),
    db.select().from(moments),
    db.select().from(friendLinks),
    db.select().from(albums),
    db.select().from(photos),
    db.select().from(playlists),
    db.select().from(songs),
    db.select().from(siteConfigs).where(eq(siteConfigs.key, "site")).limit(1),
  ]);

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      categories: categoryRows,
      tags: tagRows,
      posts: postRows,
      postTags: postTagRows,
      moments: momentRows,
      friendLinks: friendRows,
      albums: albumRows,
      photos: photoRows,
      playlists: playlistRows,
      songs: songRows,
    },
    // moments.images 本身是 JSON 字符串列，导出后会"字符串里套字符串"——无损，导入时原样回传
    siteConfig: siteRows[0] ? (JSON.parse(siteRows[0].value) as unknown) : null,
  };

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

  // 紧凑输出（不 pretty-print），体积近乎减半
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="blog-export-${stamp}.json"`,
    },
  });
}
