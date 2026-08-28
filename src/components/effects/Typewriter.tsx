"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/** 打字机效果：逐字输出 + 闪烁光标 */
export function Typewriter({
  text,
  speed = 90,
  className,
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    setN(0);
    if (!text) return;
    const timer = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(timer);
          return v;
        }
        return v + 1;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span className={className}>
      {text.slice(0, n)}
      <span
        aria-hidden
        className="ml-0.5 inline-block w-[2px] animate-[caret-blink_1s_step-end_infinite] bg-current align-middle"
        style={{ height: "1em" }}
      />
    </span>
  );
}

/** 图片懒加载淡入：加载完成前显示 shimmer 骨架 */
export function LazyImage({
  src,
  alt,
  fill,
  width,
  height,
  className,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="shimmer-bg absolute inset-0" aria-hidden />}
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        className={`transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}
