"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbox, type LightboxImage } from "@/components/albums/Lightbox";
import { LazyImage } from "@/components/effects/Typewriter";

export interface AlbumData {
  id: number;
  title: string;
  description: string;
  photos: { id: number; url: string; caption: string }[];
}

/* ============ 拍立得照片（随机微旋转 + 胶带 + 悬停摆正） ============ */

function PolaroidPhoto({
  photo,
  index,
  onClick,
}: {
  photo: { id: number; url: string; caption: string };
  index: number;
  onClick: () => void;
}) {
  const rotation = useMemo(() => {
    const seed = photo.id * 37 + index * 13;
    return ((seed % 7) - 3) * 0.9;
  }, [photo.id, index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: rotation * 2 }}
      animate={{ opacity: 1, y: 0, rotate: rotation }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.08, 0.6), ease: "easeOut" }}
      whileHover={{
        rotate: 0,
        scale: 1.04,
        zIndex: 10,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      }}
      onClick={onClick}
      className="group relative cursor-pointer break-inside-avoid"
      style={{ transformOrigin: "center center" }}
    >
      <div className="relative rounded-sm bg-white p-2 pb-6 shadow-lg ring-1 ring-black/5 transition-shadow duration-300 group-hover:shadow-2xl dark:bg-slate-800 dark:ring-white/10">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2px]">
          <LazyImage
            src={photo.url}
            alt={photo.caption || "照片"}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
        </div>
        {photo.caption && (
          <div className="absolute inset-x-0 bottom-1.5 text-center">
            <span className="font-serif text-xs italic tracking-wide text-slate-400 dark:text-slate-500">
              {photo.caption}
            </span>
          </div>
        )}
      </div>
      {/* 胶带装饰 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-2 left-3 h-3.5 w-9 -rotate-6 rounded-sm bg-amber-200/60 dark:bg-amber-300/25"
        style={{ backdropFilter: "blur(2px)" }}
      />
    </motion.div>
  );
}

/* ============ 相册卡：封面堆叠 → 悬停扇形散开 → 点击展开整行 ============ */

const STACK_ANGLES = [-4, 0, 3];
const FAN_ANGLES = [-13, 0, 13];
const FAN_Y = [-6, -12, -6];

function AlbumCard({
  album,
  isExpanded,
  onToggle,
  onPhotoClick,
}: {
  album: AlbumData;
  isExpanded: boolean;
  onToggle: () => void;
  onPhotoClick: (index: number) => void;
}) {
  const covers = album.photos.slice(0, 3).reverse();

  return (
    <div
      className={`glass-card overflow-hidden ${
        isExpanded ? "sm:col-span-2 lg:col-span-3" : ""
      } cursor-pointer transition-shadow hover:shadow-xl`}
      onClick={onToggle}
    >
      {/* 封面：三张堆叠照片 */}
      <div className="relative px-4 pb-4 pt-6 md:px-6">
        <motion.div
          className="relative mx-auto h-40 max-w-[250px] md:h-48"
          initial="rest"
          animate={isExpanded ? "hover" : "rest"}
          whileHover="hover"
        >
          {covers.map((photo, i) => (
            <motion.div
              key={photo.id}
              className="absolute inset-0"
              variants={{
                rest: {
                  rotate: STACK_ANGLES[i] ?? 0,
                  y: i * 12,
                  scale: 1 - i * 0.04,
                  zIndex: i + 1,
                },
                hover: {
                  rotate: FAN_ANGLES[i] ?? 0,
                  y: FAN_Y[i] ?? 0,
                  scale: i === 1 ? 1 : 0.95,
                },
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10">
                <LazyImage
                  src={photo.url}
                  alt={photo.caption || album.title}
                  fill
                  sizes="250px"
                  className="object-cover"
                />
              </div>
            </motion.div>
          ))}
          {/* 数量徽标 */}
          <div className="absolute -bottom-2 right-0 z-20 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/30">
            {album.photos.length} 张
          </div>
        </motion.div>

        <div className="mt-6 text-center">
          <h3 className="font-serif text-lg font-bold">{album.title}</h3>
          <p className="mt-1 text-xs text-muted">{album.description}</p>
          {!isExpanded && (
            <p className="mt-2 text-[11px] tracking-widest text-muted opacity-70">
              点击展开照片墙 ↓
            </p>
          )}
        </div>
      </div>

      {/* 展开：拍立得照片墙 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="overflow-hidden"
          >
            <div className="px-4 pb-6 md:px-6">
              <div className="rounded-2xl bg-white/30 p-4 dark:bg-white/5 md:p-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {album.photos.map((photo, i) => (
                    <PolaroidPhoto key={photo.id} photo={photo} index={i} onClick={() => onPhotoClick(i)} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============ 页面级：网格 + 单相册展开、其余淡出 ============ */

export function AlbumsGrid({ albums }: { albums: AlbumData[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ album: AlbumData; index: number } | null>(null);
  const expandedRef = useRef<HTMLDivElement>(null);

  // 点击展开区域外部时收起
  useEffect(() => {
    if (expandedId === null) return;
    const handler = (e: MouseEvent) => {
      if (lightbox) return;
      if (expandedRef.current && !expandedRef.current.contains(e.target as Node)) {
        setExpandedId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expandedId, lightbox]);

  const lightboxImages: LightboxImage[] =
    lightbox?.album.photos.map((p) => ({ url: p.url, caption: p.caption })) ?? [];

  return (
    <>
      <div className="grid select-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((album, i) => {
          const isExpanded = expandedId === album.id;
          const isHidden = expandedId !== null && !isExpanded;
          return (
            <AnimatePresence key={album.id}>
              {!isHidden && (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.25 } }}
                  transition={{
                    duration: 0.45,
                    delay: expandedId === null ? Math.min(i * 0.1, 0.4) : 0,
                  }}
                  className={isExpanded ? "sm:col-span-2 lg:col-span-3" : ""}
                >
                  <div ref={isExpanded ? expandedRef : undefined}>
                    <AlbumCard
                      album={album}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedId((prev) => (prev === album.id ? null : album.id))}
                      onPhotoClick={(index) => setLightbox({ album, index })}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </div>

      <Lightbox
        images={lightboxImages}
        index={lightbox?.index ?? null}
        onClose={() => setLightbox(null)}
        onNavigate={(idx) => setLightbox((l) => (l ? { ...l, index: idx } : l))}
      />
    </>
  );
}
