import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { PhotosManager } from "@/components/admin/PhotosManager";

export const dynamic = "force-dynamic";

export default async function AdminAlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const albumId = Number(id);
  if (!Number.isFinite(albumId)) notFound();

  const [album] = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
  if (!album) notFound();

  const rows = await db
    .select({ id: photos.id, url: photos.url, caption: photos.caption })
    .from(photos)
    .where(eq(photos.albumId, albumId))
    .orderBy(asc(photos.sort), asc(photos.id));

  return <PhotosManager albumId={albumId} albumTitle={album.title} photos={rows} />;
}
