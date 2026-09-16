import type { PlayerSong, PlayMode } from "@/lib/music-types";

const MODE_KEY = "cl-play-mode";
const VOLUME_KEY = "cl-volume";
const MUTED_KEY = "cl-muted";
const RECENT_KEY = "cl-recent-songs";

export function loadPlayMode(storage: Storage = localStorage): PlayMode {
  try {
    const mode = storage.getItem(MODE_KEY);
    return mode === "repeat-one" || mode === "shuffle" ? mode : "sequential";
  } catch {
    return "sequential";
  }
}

export function savePlayMode(mode: PlayMode, storage: Storage = localStorage) {
  try {
    storage.setItem(MODE_KEY, mode);
  } catch {}
}

export function loadVolumePreference(storage: Storage = localStorage) {
  try {
    const rawVolume = Number.parseFloat(storage.getItem(VOLUME_KEY) ?? "");
    return {
      volume: Number.isFinite(rawVolume) ? Math.min(1, Math.max(0, rawVolume)) : 0.8,
      muted: storage.getItem(MUTED_KEY) === "1",
    };
  } catch {
    return { volume: 0.8, muted: false };
  }
}

export function saveVolumePreference(volume: number, storage: Storage = localStorage) {
  try {
    storage.setItem(VOLUME_KEY, String(volume));
  } catch {}
}

export function saveMutedPreference(muted: boolean, storage: Storage = localStorage) {
  try {
    storage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {}
}

export function recordRecentSong(song: PlayerSong, storage: Storage = localStorage) {
  try {
    const raw = storage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as PlayerSong[]) : [];
    const next = [song, ...list.filter((item) => item.id !== song.id)].slice(0, 12);
    storage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}
