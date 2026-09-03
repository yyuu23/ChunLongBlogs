import { asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { AlbumsManager } from "@/components/admin/AlbumsManager";

export const dynamic = "force-dynamic";

export default async function AdminAlbumsPage() {
  const rows = await db
    .select({
      id: albums.id,
      title: albums.title,
      description: albums.description,
      cover: albums.cover,
      // 同 lib/posts.ts：sql`` 里插值列会丢表前缀，子查询裸 id 绑到内层 photos.id 计数恒 0，手写限定名
      photoCount: sql<number>`(SELECT count(*) FROM photos ph WHERE ph.album_id = albums.id)`,
    })
    .from(albums)
    .orderBy(asc(albums.createdAt));

  return (
    <div>
      <h1 className="mx-auto mb-6 max-w-4xl text-xl font-bold">相册管理</h1>
      <AlbumsManager albums={rows.map((r) => ({ ...r, photoCount: Number(r.photoCount) }))} />
    </div>
  );
}
