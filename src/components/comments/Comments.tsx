"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle, Reply, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { useGithubUser, useLoginUrl } from "@/components/comments/useGithubUser";
import { GithubIcon } from "@/components/comments/GithubIcon";
import { getVisitorId } from "@/lib/track";
import { cn, relativeTime } from "@/lib/utils";

export interface CommentItem {
  id: number;
  content: string;
  deleted: boolean;
  createdAt: number;
  author: { id: number; login: string; avatarUrl: string } | null;
  replyTo: string | null;
  replies: CommentItem[];
}

/** 事件处理器里现算登录跳转（此时必在浏览器） */
function loginUrl() {
  const returnTo = window.location.pathname + window.location.search;
  return `/api/auth/github/login?returnTo=${encodeURIComponent(returnTo)}&visitorId=${encodeURIComponent(
    getVisitorId(),
  )}`;
}

/**
 * 原生评论区（文章/说说共用）：GitHub OAuth 登录后可评论、一层回复、删自己的。
 * 未登录展示登录引导；OAuth 回跳失败通过 ?cl_auth_error= 传回提示。
 */
export function Comments({ refType, refId, compact = false }: { refType: "post" | "moment"; refId: number; compact?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const { user, ready } = useGithubUser();
  const loginHref = useLoginUrl();
  const [items, setItems] = useState<CommentItem[] | null>(null);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; login: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/comments?refType=${refType}&refId=${refId}`);
      const d = (await r.json()) as { comments?: CommentItem[] };
      setItems(Array.isArray(d.comments) ? d.comments : []);
    } catch {
      setItems([]);
    }
  }, [refType, refId]);

  useEffect(() => {
    void load();
  }, [load]);

  // OAuth 回跳失败提示（callback 路由带回 ?cl_auth_error=xx）
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("cl_auth_error")) {
      setAuthError(true);
      url.searchParams.delete("cl_auth_error");
      window.history.replaceState({}, document.title, url.toString());
    }
  }, []);

  const countTotal = (list: CommentItem[]): number => list.reduce((n, c) => n + 1 + countTotal(c.replies), 0);

  async function submit() {
    const text = content.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refType, refId, parentId: replyTo?.id, content: text }),
      });
      if (r.status === 401) {
        window.location.href = loginUrl();
        return;
      }
      if (!r.ok) {
        const d = (await r.json().catch(() => null)) as { error?: string } | null;
        setError(d?.error || t("posts.commentSubmitFail"));
        return;
      }
      setContent("");
      setReplyTo(null);
      await load();
    } catch {
      setError(t("posts.commentSubmitFail"));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm(t("posts.commentConfirmDelete"))) return;
    try {
      const r = await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
      if (r.ok) await load();
    } catch {}
  }

  async function logout() {
    await fetch("/api/auth/github/logout", { method: "POST" }).catch(() => {});
    window.location.reload();
  }

  const total = items ? countTotal(items) : 0;

  return (
    <div className={cn("flex flex-col gap-4", compact ? "text-sm" : "text-[0.95rem]")}>
      {/* 标题 + 计数 */}
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted" />
        <span className="font-medium">{t("posts.comments")}</span>
        {items && total > 0 && <span className="text-xs text-muted">{t("posts.commentCount", { n: total })}</span>}
      </div>

      {authError && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          {t("posts.commentAuthFail")}
        </p>
      )}

      {/* 输入区 */}
      {!ready ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      ) : user ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- 外链头像小图 */}
              <img
                src={user.avatarUrl}
                alt={user.login}
                referrerPolicy="no-referrer"
                className="h-7 w-7 shrink-0 rounded-full border border-[var(--glass-border)] object-cover"
              />
              <a
                href={`https://github.com/${user.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-medium hover-text-accent"
              >
                {user.login}
              </a>
            </div>
            <button type="button" onClick={logout} className="shrink-0 text-xs text-muted transition-colors hover:text-accent">
              {t("posts.commentLogout")}
            </button>
          </div>
          {replyTo && (
            <div className="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-1.5 text-xs text-accent">
              <span>{t("posts.commentReplyTo", { name: replyTo.login })}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="text-muted hover:text-accent">
                ✕
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 1000))}
              placeholder={t("posts.commentPlaceholder")}
              rows={compact ? 2 : 3}
              maxLength={1000}
              className="w-full resize-y rounded-xl border border-[var(--glass-border)] bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-accent"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs tabular-nums text-muted">{content.length}/1000</span>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !content.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-solid px-4 py-1.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {submitting ? t("posts.commentSubmitting") : t("posts.commentSubmit")}
              </button>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs text-muted">{t("posts.commentLoginHint")}</p>
          {loginHref && (
            <a
              href={loginHref}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
            >
              <GithubIcon className="text-base" />
              {t("posts.commentLogin")}
            </a>
          )}
        </div>
      )}

      {/* 列表 */}
      {items === null ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">—</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((c) => (
            <li key={c.id}>
              <CommentNode
                comment={c}
                currentUserId={user?.id}
                locale={locale}
                t={t}
                onReply={user ? (id, login) => setReplyTo({ id, login }) : undefined}
                onDelete={remove}
                compact={compact}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentNode({
  comment,
  currentUserId,
  locale,
  t,
  onReply,
  onDelete,
  compact,
  depth = 0,
}: {
  comment: CommentItem;
  currentUserId?: number;
  locale: ReturnType<typeof useLocale>["locale"];
  t: ReturnType<typeof useT>;
  onReply?: (id: number, login: string) => void;
  onDelete: (id: number) => void;
  compact?: boolean;
  depth?: number;
}) {
  const avatarSize = depth === 0 ? "h-9 w-9" : "h-7 w-7";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {comment.author ? (
          <a href={`https://github.com/${comment.author.login}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- 外链头像小图 */}
            <img
              src={comment.author.avatarUrl}
              alt={comment.author.login}
              loading="lazy"
              referrerPolicy="no-referrer"
              className={cn(avatarSize, "rounded-full border border-[var(--glass-border)] object-cover")}
            />
          </a>
        ) : (
          <div className={cn(avatarSize, "shrink-0 rounded-full bg-accent-soft")} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {comment.author ? (
              <a
                href={`https://github.com/${comment.author.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover-text-accent"
              >
                {comment.author.login}
              </a>
            ) : (
              <span className="text-sm text-muted">GitHub</span>
            )}
            {comment.replyTo && <span className="text-xs text-muted"> @{comment.replyTo}</span>}
            <span className="text-xs text-muted">{relativeTime(comment.createdAt, locale)}</span>
          </div>
          {comment.deleted ? (
            <p className="mt-1 text-sm italic text-muted">{t("posts.commentDeleted")}</p>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{comment.content}</p>
          )}
          {!comment.deleted && comment.author && (
            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
              {onReply && (
                <button
                  type="button"
                  onClick={() => onReply(comment.id, comment.author!.login)}
                  className="inline-flex items-center gap-1 transition-colors hover:text-accent"
                >
                  <Reply className="h-3 w-3" />
                  {t("posts.commentReply")}
                </button>
              )}
              {currentUserId === comment.author.id && (
                <button
                  type="button"
                  onClick={() => onDelete(comment.id)}
                  className="inline-flex items-center gap-1 transition-colors hover:text-rose-400"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("posts.commentDelete")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {comment.replies.length > 0 && (
        <ul className={cn("ml-6 flex flex-col gap-3 border-l border-[var(--glass-border)] pl-4", compact && "ml-4")}>
          {comment.replies.map((r) => (
            <li key={r.id}>
              <CommentNode
                comment={r}
                currentUserId={currentUserId}
                locale={locale}
                t={t}
                onReply={onReply}
                onDelete={onDelete}
                compact={compact}
                depth={depth + 1}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
