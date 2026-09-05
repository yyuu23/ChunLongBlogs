"use client";

import type { PlayerSong } from "@/components/music/PlayerProvider";

/**
 * 本地收藏歌曲（cl-fav-songs）：纯访客侧数据，不上报服务端。
 * 与最近播放同款模式 —— localStorage 读写失败静默 + 跨组件/跨标签页事件同步。
 */

const KEY = "cl-fav-songs";
/** 同页其它组件实时感知（音乐馆列表 ↔ 迷你播放条） */
const CHANGE_EVENT = "cl-fav-change";
const MAX = 200;

export function loadFavorites(): PlayerSong[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as PlayerSong[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function isFavorite(id: number): boolean {
  return loadFavorites().some((s) => s.id === id);
}

/** 收藏/取消，返回切换后的状态（true = 已收藏） */
export function toggleFavorite(song: PlayerSong): boolean {
  const list = loadFavorites();
  const exists = list.some((s) => s.id === song.id);
  const next = exists
    ? list.filter((s) => s.id !== song.id)
    : [song, ...list].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return !exists;
}

/** 订阅收藏变化（本页 CustomEvent + 其它标签页 storage），返回退订函数 */
export function subscribeFavorites(cb: (list: PlayerSong[]) => void): () => void {
  const emit = () => cb(loadFavorites());
  window.addEventListener(CHANGE_EVENT, emit);
  window.addEventListener("storage", emit);
  return () => {
    window.removeEventListener(CHANGE_EVENT, emit);
    window.removeEventListener("storage", emit);
  };
}
