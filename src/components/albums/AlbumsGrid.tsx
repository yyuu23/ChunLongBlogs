"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LazyImage } from "@/components/effects/Typewriter";
import { Lightbox, type LightboxImage } from "@/components/albums/Lightbox";

export interface AlbumData {
  id: number;
  title: string;
  description: string;
  photos: { id: number; url: string; caption: string }[];
}

/** 相册网格 + 灯箱（客户端交互壳，数据由服务端传入） */
export function AlbumsGrid({ albums }: { albums: AlbumData[] }) {
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(
    null,
  );

  const allLightboxImages = (album: AlbumData): LightboxImage[] =>
    album.photos.map((p) => ({ url: p.url, caption: p.caption }));

  return (
    <>
      <div className="flex flex-col gap-10">
        {albums.map((album, ai) => (
          <motion.section
            key={album.id}
            initial={{ y: 26, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: Math.min(ai * 0.06, 0.2) }}
          >
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="font-serif text-xl font-bold">{album.title}</h2>
              <span className="text-xs text-muted">
                {album.description} · {album.photos.length} 张
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {album.photos.map((photo, i) => (
                <button
                  key={photo.id}
                  onClick={() => setLightbox({ images: allLightboxImages(album), index: i })}
                  className="group relative aspect-square overflow-hidden rounded-2xl"
                  aria-label={photo.caption || "查看照片"}
                >
                  <LazyImage
                    src={photo.url}
                    alt={photo.caption || photo.url}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-3 text-left text-xs text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {photo.caption}
                  </span>
                </button>
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      <Lightbox
        images={lightbox?.images ?? []}
        index={lightbox?.index ?? null}
        onClose={() => setLightbox(null)}
        onNavigate={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))}
      />
    </>
  );
}
