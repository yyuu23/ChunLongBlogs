# 白噪音机环境音素材来源

全部来自 [Mixkit](https://mixkit.co/free-sound-effects/)（[Mixkit License](https://mixkit.co/license/)：可商用、无需署名）。
下载日期：2026-09-15。原始 preview 为较长的 VBR 立体声，入库时统一截取 45 秒并转码为
mono 48kbps（循环接缝由前端解码后的 20ms 交叉淡化处理，见 `src/lib/lab/noise-audio.ts`）。
仅在用户进入 `/lab/noise` 且点开对应场景时按需加载。

逐文件来源页与 SHA-256 见仓库根目录 `THIRD_PARTY_NOTICES.md`。

| 文件 | 原名 | Mixkit sfx ID |
|---|---|---|
| `rain.mp3` | Light rain loop | 2472 |
| `fire.mp3` | Campfire crackles | 1736 |
| `crickets.mp3` | Night crickets near the swamp | 368 |
| `stream.mp3` | Natural ambience with flowing water and birds | 1247 |
| `forest.mp3` | Forest birds singing | 492 |
| `waves.mp3` | Sea waves loop | 1194 |
