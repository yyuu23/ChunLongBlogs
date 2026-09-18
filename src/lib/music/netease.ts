import "server-only";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
  Referer: "https://music.163.com/",
};
const DETAIL_BATCH = 200;
const MAX_TRACKS = 500;
const LYRIC_BATCH = 8;
const LYRIC_PAUSE_MS = 250;

export interface NeteaseTrack {
  title: string;
  artist: string;
  cover: string;
  url: string;
  duration: number;
  sort: number;
  lrc: string;
}

export type NeteasePlaylistResult =
  | {
      ok: true;
      pid: string;
      title: string;
      cover: string;
      rows: NeteaseTrack[];
      wantedCount: number;
      lyricsCount: number;
    }
  | { ok: false; error: string };

async function fetchLyric(id: number): Promise<string> {
  try {
    const response = await fetch(`https://music.163.com/api/song/lyric?id=${id}&lv=1&tv=-1`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return "";
    const data = (await response.json()) as { nolyric?: boolean; lrc?: { lyric?: string } };
    return data.nolyric ? "" : (data.lrc?.lyric ?? "").trim();
  } catch {
    return "";
  }
}

export async function fetchNeteaseLyrics(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  for (let i = 0; i < ids.length; i += LYRIC_BATCH) {
    const batch = ids.slice(i, i + LYRIC_BATCH);
    const results = await Promise.all(batch.map(async (id) => [id, await fetchLyric(id)] as const));
    for (const [id, lyric] of results) if (lyric) map.set(id, lyric);
    if (i + LYRIC_BATCH < ids.length) await new Promise((resolve) => setTimeout(resolve, LYRIC_PAUSE_MS));
  }
  return map;
}

export function neteaseIdFromUrl(url: string): number | null {
  const match = url.match(/[?&]id=(\d+)/);
  return match ? Number(match[1]) : null;
}

function toHttps(url: string | undefined | null): string {
  return (url ?? "").replace(/^http:\/\//, "https://");
}

function parsePlaylistId(input: string): string | null {
  const value = input.trim();
  if (/^\d+$/.test(value)) return value;
  return value.match(/[?&]id=(\d+)/)?.[1] ?? null;
}

export async function loadNeteasePlaylist(input: string): Promise<NeteasePlaylistResult> {
  const pid = parsePlaylistId(input);
  if (!pid) return { ok: false, error: "请输入网易云歌单链接或数字 ID" };
  try {
    const playlistResponse = await fetch(`https://music.163.com/api/v6/playlist/detail?id=${pid}&n=1000`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
    if (!playlistResponse.ok) {
      return { ok: false, error: `网易云歌单接口请求失败（HTTP ${playlistResponse.status}）` };
    }
    const playlistData = (await playlistResponse.json()) as {
      code?: number;
      msg?: string;
      playlist?: {
        name?: string;
        coverImgUrl?: string;
        trackIds?: Array<{ id: number }>;
      };
    };
    if (playlistData.code !== 200) {
      return {
        ok: false,
        error: `网易云返回错误码 ${playlistData.code ?? "未知"}${playlistData.msg ? `：${playlistData.msg}` : ""}（歌单可能不存在或为私密）`,
      };
    }
    const playlist = playlistData.playlist;
    if (!playlist) return { ok: false, error: "网易云未返回歌单数据（接口结构可能已变化）" };

    const ids = (playlist.trackIds ?? []).map((track) => track.id).filter(Number.isFinite);
    if (!ids.length) return { ok: false, error: `歌单「${playlist.name ?? pid}」里没有歌曲` };
    const wanted = ids.slice(0, MAX_TRACKS);

    type Detail = { name?: string; ar?: Array<{ name?: string }>; al?: { picUrl?: string }; dt?: number };
    const detailMap = new Map<number, Detail>();
    for (let i = 0; i < wanted.length; i += DETAIL_BATCH) {
      const batch = wanted.slice(i, i + DETAIL_BATCH);
      const response = await fetch("https://music.163.com/api/v3/song/detail", {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ c: JSON.stringify(batch.map((id) => ({ id }))) }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return { ok: false, error: `曲目详情接口请求失败（HTTP ${response.status}）` };
      const data = (await response.json()) as { songs?: Array<Detail & { id: number }> };
      for (const song of data.songs ?? []) detailMap.set(song.id, song);
    }
    if (!detailMap.size) return { ok: false, error: `拿到 ${wanted.length} 个曲目 ID，但详情接口未返回任何曲目` };

    const lyricMap = await fetchNeteaseLyrics(wanted);
    const rows = wanted.flatMap((id, index): NeteaseTrack[] => {
      const detail = detailMap.get(id);
      if (!detail) return [];
      return [
        {
          title: detail.name ?? `未知曲目 ${id}`,
          artist: (detail.ar ?? []).map((artist) => artist.name).filter(Boolean).join(" / "),
          cover: toHttps(detail.al?.picUrl),
          url: `https://music.163.com/song/media/outer/url?id=${id}.mp3`,
          duration: Math.round((detail.dt ?? 0) / 1000),
          sort: index + 1,
          lrc: lyricMap.get(id) ?? "",
        },
      ];
    });

    return {
      ok: true,
      pid,
      title: playlist.name || `网易云歌单 ${pid}`,
      cover: toHttps(playlist.coverImgUrl),
      rows,
      wantedCount: wanted.length,
      lyricsCount: lyricMap.size,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `导入失败：${error.message}` : "导入失败" };
  }
}
