/** 播放器与收藏模块共享的歌曲契约；放在 lib，避免数据层反向依赖 UI Provider。 */
export interface PlayerSong {
  id: number;
  title: string;
  artist: string;
  cover: string;
  url: string;
  /** LRC 歌词原文（歌词面板逐行滚动用；最近播放/收藏队列里同样携带） */
  lrc?: string;
}

export type PlayMode = "sequential" | "repeat-one" | "shuffle";
