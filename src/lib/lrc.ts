/**
 * LRC 歌词解析：把 "[mm:ss.xx]歌词" 格式解析成带秒数时间轴的行数组。
 * 兼容 [mm:ss] / [mm:ss.xx] / [mm:ss.xxx]，一行可带多个时间戳（ [00:10][01:20]同句词 ）；
 * [ti:]/[ar:] 等元数据标签因分钟位非数字自然被跳过。
 */
export interface LrcLine {
  /** 相对歌曲开头的秒数 */
  time: number;
  text: string;
}

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(raw: string): LrcLine[] {
  if (!raw) return [];
  const lines: LrcLine[] = [];
  for (const line of raw.split(/\r?\n/)) {
    TIME_TAG.lastIndex = 0;
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    let lastEnd = 0;
    while ((m = TIME_TAG.exec(line))) {
      const min = Number(m[1]);
      const sec = Number(m[2]);
      // 小数位按毫秒口径补齐（.5 → 500ms，.50 → 500ms，.050 → 50ms）
      const frac = m[3] ? Number(m[3].padEnd(3, "0")) : 0;
      if (Number.isFinite(min) && Number.isFinite(sec)) {
        stamps.push(min * 60 + sec + frac / 1000);
      }
      lastEnd = TIME_TAG.lastIndex;
    }
    if (!stamps.length) continue;
    const text = line.slice(lastEnd).trim();
    // 纯时间戳行（间奏）保留为空词行，用于把高亮清空；无文本且非首行的场合也有意义
    for (const time of stamps) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}
