import { describe, expect, it } from "vitest";
import { mergeBottleOrder, reorderBottleIds } from "@/lib/bottle-order";
import {
  loadPlayMode,
  loadVolumePreference,
  recordRecentSong,
} from "@/lib/music-preferences";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("bottle order", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it("keeps stored bottles first and appends newly earned bottles", () => {
    expect(mergeBottleOrder(items, [2, 1]).map((item) => item.id)).toEqual([2, 1, 3]);
  });

  it("moves an item relative to a target without mutating the source", () => {
    const source = [1, 2, 3];
    expect(reorderBottleIds(source, 1, 3, "after")).toEqual([2, 3, 1]);
    expect(source).toEqual([1, 2, 3]);
  });
});

describe("music preferences", () => {
  it("normalizes playback preferences and deduplicates recents", () => {
    const storage = memoryStorage();
    storage.setItem("cl-play-mode", "invalid");
    storage.setItem("cl-volume", "2");
    expect(loadPlayMode(storage)).toBe("sequential");
    expect(loadVolumePreference(storage)).toEqual({ volume: 1, muted: false });

    const first = { id: 1, title: "One", artist: "A", cover: "", url: "/one.mp3" };
    recordRecentSong(first, storage);
    recordRecentSong({ ...first, title: "One updated" }, storage);
    expect(JSON.parse(storage.getItem("cl-recent-songs")!)).toEqual([
      { ...first, title: "One updated" },
    ]);
  });
});
