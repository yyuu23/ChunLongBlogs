import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { Images } from "lucide-react";
import { PageTransition } from "@/components/effects/PageTransition";
import { AlbumsGrid, type AlbumData } from "@/components/albums/AlbumsGrid";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "相册" };

export default async function AlbumsPage() {
  const [albumRows, photoRows] = await Promise.all([
    db.select().from(albums).orderBy(asc(albums.createdAt)),
    db.select().from(photos).orderBy(asc(photos.sort), asc(photos.id)),
  ]);

  const data: AlbumData[] = albumRows.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    photos: photoRows
      .filter((p) => p.albumId === a.id)
      .map((p) => ({ id: p.id, url: p.url, caption: p.caption })),
  }));

  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,64rem)] pb-8">
        <header className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-pink-400 to-rose-400 text-white">
            <Images className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-3xl font-black">相册</h1>
            <p className="text-sm text-muted">
              {albumRows.length} 本相册 · {photoRows.length} 张照片 · 点击查看大图
            </p>
          </div>
        </header>

        <AlbumsGrid albums={data} />
      </div>
    </PageTransition>
  );
}
