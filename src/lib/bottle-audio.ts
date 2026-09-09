/**
 * 漂流瓶音效（Web Audio 全合成，零音频文件、零下载体积）：
 * 玻璃轻响/水声/开瓶/风铃全部由振荡器与滤波噪声实时生成，每次音高微随机，
 * 比固定采样更"活"。AudioContext 惰性创建（首次调用才建），被浏览器挂起时
 * 顺带 resume（音效总由用户手势触发，符合自动播放策略）。
 * 所有入口 first 参数为开关（EffectFlags.sound），关闭时零开销。
 */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 音高微随机（±6%）：同一动作每次响得略不同，避免"电子复读机"感 */
const jitter = (f: number, r = 0.06) => f * (1 + (Math.random() * 2 - 1) * r);

function tone(freq: number, dur: number, peak: number, type: OscillatorType = "sine", freqEnd?: number) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

/** 滤波白噪声：扫频低通，做水声/撞击闷响 */
function noise(dur: number, from: number, to: number, peak: number) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** 拿起：双音玻璃轻响（高频短衰减） */
export function bsPickup(on: boolean) {
  if (!on) return;
  tone(jitter(1850), 0.16, 0.1);
  tone(jitter(2800), 0.12, 0.05);
}

/** 放下/撞板：低一点的叮 + 一点闷响；vel 0~1 随撞击速度调音量 */
export function bsPutdown(on: boolean, vel = 0.6) {
  if (!on) return;
  const v = Math.min(1, Math.max(0.1, vel));
  tone(jitter(920), 0.16, 0.04 + 0.08 * v);
  noise(0.04, 2600, 900, 0.05 * v);
}

/** 摇晃：水声（低通扫频白噪声） */
export function bsSlosh(on: boolean) {
  if (!on) return;
  noise(0.26, 640, 220, 0.12);
}

/** 开瓶：短噪声"噗" + 音高下坠的三角波"啵" */
export function bsPop(on: boolean) {
  if (!on) return;
  noise(0.05, 3200, 700, 0.18);
  tone(210, 0.13, 0.16, "triangle", 65);
}

/** 风铃（节日瓶摇晃 / 投影开场）：五声音阶三连音 */
export function bsChime(on: boolean) {
  if (!on) return;
  [880, 1174.66, 1567.98].forEach((f, i) => {
    setTimeout(() => tone(jitter(f, 0.02), 0.9, 0.055), i * 130);
  });
}
