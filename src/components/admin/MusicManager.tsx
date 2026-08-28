"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2, Pencil, X, Check, CloudDownload, Loader2, ArrowLeft } from "lucide-react";
import {
  savePlaylist,
  deletePlaylist,
  saveSong,
  deleteSong,
  importNetease,
} from "@/app/admin/actions";
import { UploadButton } from "@/components/admin/UploadButton";

interface PlaylistRow {
  id: number;
  title: string;
  description: string;
  cover: string;
  songCount: number;
}
interface SongRow {
  id: number;
  title: string;
  artist: string;
  cover: string;
  url: string;
  lrc: string;
}

const EMPTY_PL = { id: 0, title: "", description: "", cover: "" };
const input =
  "rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400";

/** 后台音乐管理：歌单列表 + 每歌单的歌曲编辑 + 网易云导入 */
export function MusicManager({
  playlists,
  songs,
}: {
  playlists: PlaylistRow[];
  songs: Record<number, SongRow[]>;
}) {
  const [pending, startTransition] = useTransition();
  const [plForm, setPlForm] = useState<typeof EMPTY_PL | null>(null);
  const [openPl, setOpenPl] = useState<number | null>(null);
  const [songForm, setSongForm] = useState<SongRow & { playlistId: number } | null>(null);
  const [neteaseId, setNeteaseId] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const submitPlaylist = () => {
    if (!plForm || !plForm.title.trim()) return;
    startTransition(() => {
      void savePlaylist({ ...plForm, id: plForm.id || undefined });
      setPlForm(null);
    });
  };

  const submitSong = () => {
    if (!songForm || !songForm.title.trim() || !songForm.url.trim()) return;
    startTransition(() => {
      void saveSong({
        ...songForm,
        id: songForm.id || undefined,
      });
      setSongForm(null);
    });
  };

  const doImport = async () => {
    if (!neteaseId.trim()) return;
    setImporting(true);
    setMessage("");
    const r = await importNetease(neteaseId);
    setImporting(false);
    if ("error" in r && r.error) setMessage(`❌ ${r.error}`);
    else if ("ok" in r) {
      setMessage(`✅ 成功导入 ${r.count} 首`);
      setNeteaseId("");
    }
  };

  return (
    <div className={`mx-auto flex max-w-4xl flex-col gap-6 ${pending ? "opacity-60" : ""}`}>
      {/* 网易云导入 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CloudDownload className="h-4 w-4 text-indigo-400" /> 从网易云导入歌单
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={neteaseId}
            onChange={(e) => setNeteaseId(e.target.value)}
            placeholder="歌单 ID（网址里 id= 后面的数字）"
            className={`${input} min-w-56 flex-1`}
          />
          <button
            onClick={doImport}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudDownload className="h-3.5 w-3.5" />}
            导入
          </button>
        </div>
        {message && <p className="mt-2 text-xs text-slate-500">{message}</p>}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          拉取歌单的名称/歌手/封面，音频走网易云官方外链。VIP 歌曲可能无法播放（前台会显示"音频不可用"），介意的话可在下方手动替换音频地址。
        </p>
      </section>

      {/* 歌单列表 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold">歌单（{playlists.length}）</h2>
          {plForm ? (
            <button onClick={() => setPlForm(null)} className="flex items-center gap-1 text-xs text-slate-500">
              <X className="h-3.5 w-3.5" /> 取消编辑
            </button>
          ) : (
            <button
              onClick={() => setPlForm({ ...EMPTY_PL })}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-3.5 py-1.5 text-xs font-medium text-white"
            >
              <Plus className="h-3.5 w-3.5" /> 新建歌单
            </button>
          )}
        </div>

        {plForm && (
          <div className="grid gap-3 border-b border-slate-100 bg-indigo-50/40 p-5 sm:grid-cols-2">
            <input value={plForm.title} onChange={(e) => setPlForm({ ...plForm, title: e.target.value })} placeholder="歌单名称" className={input} />
            <input value={plForm.description} onChange={(e) => setPlForm({ ...plForm, description: e.target.value })} placeholder="简介" className={input} />
            <div className="flex items-center gap-2 sm:col-span-2">
              <input value={plForm.cover} onChange={(e) => setPlForm({ ...plForm, cover: e.target.value })} placeholder="封面 URL（可上传）" className={`${input} flex-1`} />
              <UploadButton onUploaded={([url]) => setPlForm({ ...plForm, cover: url })} label="上传封面" />
              <button onClick={submitPlaylist} className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs text-white">
                <Check className="h-3.5 w-3.5" /> 保存
              </button>
            </div>
          </div>
        )}

        <ul className="divide-y divide-slate-100">
          {playlists.map((pl) => (
            <li key={pl.id} className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {pl.cover ? (
                  <img src={pl.cover} alt={pl.title} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">🎧</span>
                )}
                <button
                  onClick={() => setOpenPl(openPl === pl.id ? null : pl.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium">{pl.title}</p>
                  <p className="truncate text-xs text-slate-400">{pl.songCount} 首 · {pl.description}</p>
                </button>
                <button onClick={() => setPlForm({ ...pl })} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500" title="编辑">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => confirm(`删除歌单「${pl.title}」及全部歌曲？`) && startTransition(() => deletePlaylist(pl.id))}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* 展开的歌曲管理 */}
              {openPl === pl.id && (
                <div className="mt-3 rounded-xl bg-slate-50 p-4">
                  <div className="mb-3 flex justify-between">
                    <p className="text-xs font-semibold text-slate-500">歌曲（{songs[pl.id]?.length ?? 0}）</p>
                    <button
                      onClick={() => setSongForm({ id: 0, title: "", artist: "", cover: "", url: "", lrc: "", playlistId: pl.id })}
                      className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs text-indigo-600"
                    >
                      <Plus className="h-3 w-3" /> 添加歌曲
                    </button>
                  </div>
                  {songForm?.playlistId === pl.id && (
                    <div className="mb-3 grid gap-2 rounded-xl border border-indigo-200 bg-white p-3 sm:grid-cols-2">
                      <input value={songForm.title} onChange={(e) => setSongForm({ ...songForm, title: e.target.value })} placeholder="歌名 *" className={input} />
                      <input value={songForm.artist} onChange={(e) => setSongForm({ ...songForm, artist: e.target.value })} placeholder="歌手" className={input} />
                      <input value={songForm.cover} onChange={(e) => setSongForm({ ...songForm, cover: e.target.value })} placeholder="封面 URL（留空用歌单封面）" className={`${input} text-xs`} />
                      <div className="flex items-center gap-2">
                        <input value={songForm.url} onChange={(e) => setSongForm({ ...songForm, url: e.target.value })} placeholder="音频地址 *（直链或上传）" className={`${input} flex-1 text-xs`} />
                        <UploadButton onUploaded={([url]) => setSongForm({ ...songForm, url })} label="上传" />
                      </div>
                      <textarea value={songForm.lrc} onChange={(e) => setSongForm({ ...songForm, lrc: e.target.value })} placeholder="歌词（.lrc 文本，可空）" rows={3} className={`${input} resize-y font-mono text-xs sm:col-span-2`} />
                      <div className="flex gap-2 sm:col-span-2">
                        <button onClick={submitSong} className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs text-white">
                          <Check className="h-3.5 w-3.5" /> 保存歌曲
                        </button>
                        <button onClick={() => setSongForm(null)} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500">取消</button>
                      </div>
                    </div>
                  )}
                  <ul className="flex flex-col gap-1">
                    {(songs[pl.id] ?? []).map((s) => (
                      <li key={s.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.title}</span>
                          <span className="block truncate text-xs text-slate-400">{s.artist} · {s.url.slice(0, 60)}</span>
                        </span>
                        <button onClick={() => setSongForm({ ...s, playlistId: pl.id, lrc: s.lrc ?? "" })} className="rounded-lg p-1 text-slate-400 opacity-0 transition-opacity hover:text-indigo-500 group-hover:opacity-100" title="编辑">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => confirm(`删除「${s.title}」？`) && startTransition(() => deleteSong(s.id))}
                          className="rounded-lg p-1 text-slate-400 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                    {!(songs[pl.id] ?? []).length && (
                      <li className="py-3 text-center text-xs text-slate-400">还没有歌曲</li>
                    )}
                  </ul>
                </div>
              )}
            </li>
          ))}
          {!playlists.length && <li className="px-5 py-8 text-center text-sm text-slate-400">还没有歌单</li>}
        </ul>
      </section>

      <p className="text-center text-xs text-slate-400">
        <Link href="/music" target="_blank" className="inline-flex items-center gap-1 hover:text-indigo-500">
          <ArrowLeft className="h-3 w-3" /> 前往前台音乐馆查看效果
        </Link>
      </p>
    </div>
  );
}
