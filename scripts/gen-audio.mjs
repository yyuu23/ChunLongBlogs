// 生成演示用免版权环境音 WAV（正弦叠加 pad，22050Hz 单声道 16bit）
// 运行：node scripts/gen-audio.mjs
// 注意：线上演示曲已是 MP3 版（public/music/*.mp3，WAV 约 3 倍大）。
// 重新生成 WAV 后需转 MP3 并同步 songs 表的 url，别直接引用 .wav。
import fs from "node:fs";
import path from "node:path";

const SR = 22050;

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, 44 + i * 2);
  }
  return buf;
}

/** 基频 + 泛音的柔和 pad，缓慢 LFO 起伏，首尾淡入淡出 */
function pad({ seconds, notes, lfo = 0.12, gain = 0.32 }) {
  const n = Math.floor(seconds * SR);
  const out = new Float32Array(n);
  const fade = Math.floor(SR * 2.2);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env =
      Math.min(1, i / fade) * Math.min(1, (n - i) / fade) * (0.75 + 0.25 * Math.sin(2 * Math.PI * lfo * t));
    let s = 0;
    for (const f of notes) {
      s += Math.sin(2 * Math.PI * f * t) * 0.6;
      s += Math.sin(2 * Math.PI * f * 2 * t) * 0.18; // 八度泛音
      s += Math.sin(2 * Math.PI * f * 3.01 * t) * 0.07; // 十二度泛音
    }
    out[i] = (s / (notes.length * 1.6)) * env * gain;
  }
  return out;
}

const tracks = [
  { name: "morning-light.wav", title: "晨光", seconds: 20, notes: [261.63, 329.63, 392.0] }, // C 大三和弦
  { name: "floating.wav", title: "漂浮", seconds: 22, notes: [220.0, 261.63, 329.63] }, // Am7 感
  { name: "stardust.wav", title: "星尘", seconds: 24, notes: [164.81, 246.94, 329.63], lfo: 0.08 }, // Em
];

fs.mkdirSync(path.join("public", "music"), { recursive: true });
for (const t of tracks) {
  const samples = pad(t);
  fs.writeFileSync(path.join("public", "music", t.name), wav(samples));
  console.log(`${t.name} (${t.title}) ${(samples.length / SR).toFixed(1)}s`);
}
console.log("done");
