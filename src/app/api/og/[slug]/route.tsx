import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { pickAutoCoverStyle } from "@/components/posts/AutoCover";
import { getPostBySlug } from "@/lib/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 无封面文章的社交分享图（og:image）：用 next/og 渲染 1200×630 PNG，
 * 视觉与前台 AutoCover 渐变一致（共用 pickAutoCoverStyle）。
 *
 * Satori 的内置字体不含中文字形，这里加载 public/fonts/simhei.ttf（黑体，
 * 仅 400 字重——Satori 不做 faux bold，靠字号与深色 ink 保证可读性）。
 * 字体读取失败时降级为无文字纯渐变，仍比分享卡无图强。
 *
 * 有真实封面的文章 metadata 直接指向封面地址，不会走到这里；
 * 本路由对有封面文章 302 到封面，只是手敲 URL 时的兜底。
 */

let fontPromise: Promise<Buffer | null> | null = null;
function loadFont(): Promise<Buffer | null> {
  fontPromise ??= readFile(join(process.cwd(), "public", "fonts", "simhei.ttf")).catch(
    () => null,
  );
  return fontPromise;
}

/** Satori 没有 line-clamp：手动分两行、每行 26 字，超长加省略号（Array.from 防止切断 emoji） */
function wrapTitle(title: string): string[] {
  const chars = Array.from(title);
  if (chars.length <= 26) return [title];
  if (chars.length <= 52) {
    return [chars.slice(0, 26).join(""), chars.slice(26).join("")];
  }
  return [chars.slice(0, 26).join(""), `${chars.slice(26, 50).join("")}…`];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.status !== "published") {
    return new Response("Not Found", { status: 404 });
  }
  if (post.cover) {
    return new Response(null, {
      status: 302,
      headers: { Location: new URL(post.cover, request.url).toString() },
    });
  }

  const { palette, angle, blobA, blobB, bandY } = pickAutoCoverStyle(post.slug);
  const font = await loadFont();
  const lines = wrapTitle(post.title);

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            backgroundImage: `linear-gradient(${angle}deg, ${palette.from}, ${palette.to})`,
          }}
        >
          {/* 装饰光斑：Satori 不支持 filter:blur，用低透明度纯色圆近似 */}
          <div
            style={{
              position: "absolute",
              left: `${blobA.x}%`,
              top: `${blobA.y}%`,
              width: `${(blobA.r / 100) * 1200}px`,
              height: `${(blobA.r / 100) * 1200}px`,
              borderRadius: "9999px",
              background: "rgba(255,255,255,0.3)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${blobB.x}%`,
              top: `${blobB.y}%`,
              width: `${(blobB.r / 100) * 1200}px`,
              height: `${(blobB.r / 100) * 1200}px`,
              borderRadius: "9999px",
              background: "rgba(255,255,255,0.2)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "-25%",
              top: `${bandY}%`,
              width: "150%",
              height: "33%",
              transform: "rotate(-12deg)",
              background:
                "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.25), rgba(255,255,255,0))",
            }}
          />
          {font && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                maxWidth: "85%",
                color: palette.ink,
                fontSize: lines.length > 1 ? 58 : 72,
                lineHeight: 1.35,
                textAlign: "center",
                fontFamily: "SimHei",
              }}
            >
              {lines.map((line) => (
                <div key={line} style={{ display: "flex" }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: font ? [{ name: "SimHei", data: font, weight: 400, style: "normal" }] : [],
      },
    );
  } catch (e) {
    return new Response(
      `OG image render failed: ${e instanceof Error ? e.message : "unknown"}`,
      { status: 500 },
    );
  }
}
