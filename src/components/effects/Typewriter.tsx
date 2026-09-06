"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";

/** 图片懒加载淡入：加载完成前显示 shimmer 骨架；传入 fallback 后，加载失败（图床挂了/URL 失效）渲染 fallback 而不是永久骨架。
 *  natural = true 时渲染原始宽高比的 <img>（不裁剪、未知尺寸），供瀑布流照片墙使用；容器需为 relative 以承载 shimmer 骨架。 */
export function LazyImage({
  src,
  alt,
  fill,
  width,
  height,
  className,
  sizes,
  priority,
  fallback,
  natural,
}: {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fallback?: ReactNode;
  natural?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (natural) {
    return (
      <>
        {!loaded && !failed && <div className="shimmer-bg absolute inset-0" aria-hidden />}
        {failed ? (
          fallback ?? null
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            className={`${className ?? ""} transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
      </>
    );
  }
  return (
    <>
      {!loaded && !failed && <div className="shimmer-bg absolute inset-0" aria-hidden />}
      {failed ? (
        fallback ?? null
      ) : (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          width={width}
          height={height}
          sizes={sizes}
          /* Next 16 起废弃 priority 改名 preload（语义相同：LCP 图预加载），
           * 这里做映射，调用方继续用 priority 命名 */
          preload={priority}
          className={`transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}
