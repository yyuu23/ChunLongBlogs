"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useT } from "@/components/providers/LocaleProvider";
import { useGithubUser, useLoginUrl } from "@/components/comments/useGithubUser";
import { getVisitorId, trackEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

interface Liker {
  login: string;
  avatarUrl: string;
}

interface LikeState {
  likes: number;
  liked: boolean;
  likers: Liker[];
}

/**
 * 文章点赞区（读完后、评论区前）：朋友圈式——大号爱心按钮 + 登录用户头像列。
 * 游客可点赞（只进数字），同一浏览器 visitorId 去重，乐观更新失败回滚。
 */
export function PostLike({ slug, postId, initialLikes }: { slug: string; postId: number; initialLikes: number }) {
  const t = useT();
  const { user } = useGithubUser();
  const loginUrl = useLoginUrl();
  const [state, setState] = useState<LikeState>({ likes: initialLikes, liked: false, likers: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const visitorId = getVisitorId();
    fetch(`/api/posts/${encodeURIComponent(slug)}/like?visitorId=${encodeURIComponent(visitorId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Partial<LikeState> | null) => {
        if (!d) return;
        setState((s) => ({
          likes: typeof d.likes === "number" ? d.likes : s.likes,
          liked: Boolean(d.liked),
          likers: Array.isArray(d.likers) ? d.likers : s.likers,
        }));
      })
      .catch(() => {});
  }, [slug]);

  const refreshLikers = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/posts/${encodeURIComponent(slug)}/like?visitorId=${encodeURIComponent(getVisitorId())}`,
      );
      if (!r.ok) return;
      const d = (await r.json()) as { likers?: Liker[] };
      if (Array.isArray(d.likers)) setState((s) => ({ ...s, likers: d.likers! }));
    } catch {}
  }, [slug]);

  async function toggle() {
    if (busy) return;
    const next = !state.liked;
    setBusy(true);
    const prev = state;
    setState((s) => ({ ...s, liked: next, likes: Math.max(0, s.likes + (next ? 1 : -1)) }));
    try {
      const r = await fetch(`/api/posts/${encodeURIComponent(slug)}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: getVisitorId(), action: next ? "like" : "unlike" }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { likes: number; liked: boolean };
      setState((s) => ({ ...s, likes: d.likes, liked: d.liked }));
      if (next) trackEvent("like_post", { postId });
      void refreshLikers();
    } catch {
      setState(prev); // 失败整体回滚
    } finally {
      setBusy(false);
    }
  }

  const { likes, liked, likers } = state;

  return (
    <div className="glass-card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={liked}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border px-6 py-2.5 text-sm font-medium transition-all active:scale-95",
            liked
              ? "border-rose-500/40 bg-rose-500/15 text-rose-400"
              : "border-[var(--glass-border)] bg-transparent text-muted hover:border-rose-500/30 hover:text-rose-400",
          )}
        >
          <Heart className={cn("h-4 w-4 transition-transform group-hover:scale-110", liked && "fill-current")} />
          {liked ? t("posts.liked") : t("posts.like")}
          {likes > 0 && <span className="tabular-nums">{likes}</span>}
        </button>
        {!user && loginUrl && (
          <a
            href={loginUrl}
            className="text-xs text-muted transition-colors hover:text-accent"
          >
            {t("posts.likeGuestHint")}
          </a>
        )}
      </div>

      {likes > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Heart className="h-3.5 w-3.5 shrink-0 fill-rose-400 text-rose-400" />
          {likers.length > 0 ? (
            <>
              <span className="flex flex-wrap items-center gap-1.5">
                {likers.map((l) => (
                  <a
                    key={l.login}
                    href={`https://github.com/${l.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={l.login}
                    className="transition-transform hover:-translate-y-0.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- 外链头像小图，无需优化器 */}
                    <img
                      src={l.avatarUrl}
                      alt={l.login}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-full border border-[var(--glass-border)] object-cover"
                    />
                  </a>
                ))}
              </span>
              <span className="text-xs text-muted">{t("posts.likers", { n: likes })}</span>
            </>
          ) : (
            <span className="text-xs text-muted">{t("posts.likers", { n: likes })}</span>
          )}
        </div>
      )}
    </div>
  );
}
