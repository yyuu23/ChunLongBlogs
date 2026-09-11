"use client";

import { useEffect, useState } from "react";
import { getVisitorId } from "@/lib/track";

export interface GithubUser {
  id: number;
  login: string;
  avatarUrl: string;
  bio: string;
}

/** 当前 GitHub 登录访客（null = 未登录）；ready 区分"还在请求"与"确认未登录" */
export function useGithubUser() {
  const [user, setUser] = useState<GithubUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/github/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user: GithubUser | null } | null) => setUser(d?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  return { user, ready };
}

/**
 * OAuth 登录链接（带回跳页与访客 ID）。
 * 必须挂载后再算——SSR 时 window 不存在会渲染出 href=""，与客户端不一致触发水合告警。
 */
export function useLoginUrl() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const returnTo = window.location.pathname + window.location.search;
    setUrl(
      `/api/auth/github/login?returnTo=${encodeURIComponent(returnTo)}&visitorId=${encodeURIComponent(getVisitorId())}`,
    );
  }, []);
  return url;
}
