/**
 * 白噪音机引擎（实验室 /lab/noise）：混合双引擎。
 *
 * - 合成层（零下载体积）：白/粉/棕噪音由 Web Audio 实时生成——纯数学信号
 *   程序合成与录音无差别甚至更纯净；循环 buffer 首尾做 5ms 交叉淡化，
 *   无缝循环（随机信号循环点本就统计不可闻，crossfade 双保险）。
 *   粉噪用 Paul Kellet 近似滤波，棕噪用积分法（-6dB/oct）。
 * - 素材层（真实自然声）：public/sounds/ambient/ 下 Mixkit 免商用采样
 *   （15~30s 稳态环境音，本就是 loop 制作），bufferSource(loop=true)
 *   采样级无缝循环；按需 fetch→decodeAudioData→Map 缓存，单场景单次下载，
 *   失败只影响该场景（状态回调通知 UI 显示提示，合成层不受影响）。
 *
 * 与烟花/瓶艺共享 bottle-audio 的 AudioContext 单例（全库无 suspend 调用，
 * 不互相干扰）。通道拓扑 channelGain → master → destination（+ analyser 探针）。
 * 这是"主动聆听"（与音乐播放器同类），不接 EffectFlags.sound 音效总开关。
 * 所有入口在组件 unmount 时须调 noiseStopAll()（ctx 常驻复用）。
 */
import { ac } from "@/lib/bottles/audio";

export type NoiseChannelId =
  | "white"
  | "pink"
  | "brown"
  | "rain"
  | "fire"
  | "crickets"
  | "stream"
  | "forest"
  | "waves";

export interface NoiseChannelDef {
  id: NoiseChannelId;
  kind: "synth" | "sample";
  /** sample 专属：/sounds/ambient/ 下的文件名 */
  file?: string;
}

export const NOISE_CHANNELS: NoiseChannelDef[] = [
  { id: "white", kind: "synth" },
  { id: "pink", kind: "synth" },
  { id: "brown", kind: "synth" },
  { id: "rain", kind: "sample", file: "rain.mp3" },
  { id: "fire", kind: "sample", file: "fire.mp3" },
  { id: "crickets", kind: "sample", file: "crickets.mp3" },
  { id: "stream", kind: "sample", file: "stream.mp3" },
  { id: "forest", kind: "sample", file: "forest.mp3" },
  { id: "waves", kind: "sample", file: "waves.mp3" },
];

/* ---------- 状态 ---------- */

interface RunningChannel {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

const running = new Map<NoiseChannelId, RunningChannel>();
/** 用户意图：想开着哪些通道（素材加载是异步的，就绪时要看用户是否还想要它） */
const desired = new Set<NoiseChannelId>();
const sampleBuffers = new Map<string, AudioBuffer>();
const sampleState = new Map<string, "loading" | "ready" | "failed">();
const statusListeners = new Set<(id: NoiseChannelId, state: "loading" | "ready" | "failed") => void>();

let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let masterVol = 0.8;

function getMaster(): GainNode | null {
  const c = ac();
  if (!c) return null;
  if (!master) {
    master = c.createGain();
    master.gain.value = masterVol;
    master.connect(c.destination);
  }
  return master;
}

/** 订阅素材通道加载状态（失败提示等）；返回取消订阅 */
export function noiseOnChannelStatus(
  cb: (id: NoiseChannelId, state: "loading" | "ready" | "failed") => void,
): () => void {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

const emitStatus = (id: NoiseChannelId, state: "loading" | "ready" | "failed") => {
  statusListeners.forEach((cb) => cb(id, state));
};

/* ---------- 合成层 buffer ---------- */

const synthBuffers = new Map<NoiseChannelId, AudioBuffer>();

/** 尾部 N 样本与头部交叉淡化（seamless loop） */
function crossfadeEdges(data: Float32Array, len: number, n: number) {
  for (let i = 0; i < n; i++) {
    const t = i / n;
    data[len - n + i] = data[len - n + i]! * (1 - t) + data[i]! * t;
  }
}

function makeSynthBuffer(id: "white" | "pink" | "brown"): AudioBuffer | null {
  const c = ac();
  if (!c) return null;
  const seconds = id === "white" ? 2 : 4;
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  if (id === "white") {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else if (id === "pink") {
    // Paul Kellet 精确滤波近似（-3dB/oct）
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    // 棕噪音：白噪积分（-6dB/oct）
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  }
  crossfadeEdges(data, len, Math.floor(c.sampleRate * 0.005));
  return buf;
}

/* ---------- 素材层 ---------- */

async function loadSample(def: NoiseChannelDef): Promise<AudioBuffer | null> {
  const c = ac();
  if (!c || !def.file) return null;
  if (sampleBuffers.has(def.file)) return sampleBuffers.get(def.file)!;
  if (sampleState.get(def.file) === "loading") return null; // 已在加载中
  sampleState.set(def.file, "loading");
  emitStatus(def.id, "loading");
  try {
    const res = await fetch(`/sounds/ambient/${def.file}`);
    if (!res.ok) throw new Error(def.file);
    const raw = await res.arrayBuffer();
    const buf = await c.decodeAudioData(raw);
    // 循环接缝：尾部 20ms 与头部交叉淡化（环境音稳态，短 crossfade 足以消除咔嗒）
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const data = buf.getChannelData(ch);
      crossfadeEdges(data, data.length, Math.floor(buf.sampleRate * 0.02));
    }
    sampleBuffers.set(def.file, buf);
    sampleState.set(def.file, "ready");
    emitStatus(def.id, "ready");
    return buf;
  } catch {
    sampleState.set(def.file, "failed");
    emitStatus(def.id, "failed");
    return null;
  }
}

/* ---------- 通道控制 ---------- */

function startChannel(id: NoiseChannelId, buf: AudioBuffer, vol: number): boolean {
  const c = ac();
  const m = getMaster();
  if (!c || !m) return false;
  stopChannel(id); // 幂等：先停旧的
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(gain).connect(m);
  src.start();
  running.set(id, { src, gain });
  return true;
}

function stopChannel(id: NoiseChannelId) {
  const ch = running.get(id);
  if (!ch) return;
  try {
    ch.src.stop();
  } catch {}
  ch.src.disconnect();
  ch.gain.disconnect();
  running.delete(id);
}

/** 开通道。合成层立即响；素材层首次会触发懒加载（loading 期间静默，就绪自动开播，失败回调状态） */
export function noisePlay(id: NoiseChannelId, vol = 0.7) {
  const def = NOISE_CHANNELS.find((d) => d.id === id);
  if (!def) return;
  desired.add(id);
  if (def.kind === "synth") {
    const key = id as "white" | "pink" | "brown";
    if (!synthBuffers.has(key)) {
      const made = makeSynthBuffer(key);
      if (made) synthBuffers.set(key, made);
    }
    const buf = synthBuffers.get(key);
    if (buf) startChannel(id, buf, vol);
    return;
  }
  void loadSample(def).then((buf) => {
    // 加载完成时用户可能已关掉该通道——只在"仍想要"时开播
    if (!buf || !desired.has(id)) return;
    startChannel(id, buf, vol);
  });
}

export function noiseStop(id: NoiseChannelId) {
  desired.delete(id);
  stopChannel(id);
}

export function noiseStopAll() {
  desired.clear();
  for (const id of [...running.keys()]) stopChannel(id);
}

/** 全部通道淡出后停止（睡眠定时器用）；不影响后续重新播放的音量 */
export function noiseFadeOutAll(fadeSec = 8) {
  const m = getMaster();
  const c = ac();
  if (!m || !c) return;
  const t0 = c.currentTime;
  m.gain.cancelScheduledValues(t0);
  m.gain.setValueAtTime(m.gain.value, t0);
  m.gain.linearRampToValueAtTime(0.0001, t0 + fadeSec);
  setTimeout(() => {
    noiseStopAll();
    // 恢复 master 音量供下次使用
    const c2 = ac();
    if (c2 && master) {
      master.gain.cancelScheduledValues(c2.currentTime);
      master.gain.setValueAtTime(masterVol, c2.currentTime);
    }
  }, fadeSec * 1000 + 100);
}

export function noiseSetMasterVolume(v: number) {
  masterVol = Math.min(1, Math.max(0, v));
  const c = ac();
  if (master && c) {
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(masterVol, c.currentTime);
  }
}

export function noiseSetChannelVolume(id: NoiseChannelId, v: number) {
  const ch = running.get(id);
  if (ch) ch.gain.gain.value = Math.min(1, Math.max(0, v));
}

export function noiseIsPlaying(id: NoiseChannelId): boolean {
  return running.has(id);
}

/** 可视化探针（惰性创建；master 的并行分支，不影响输出链） */
export function noiseAnalyser(): AnalyserNode | null {
  const c = ac();
  const m = getMaster();
  if (!c || !m) return null;
  if (!analyser) {
    analyser = c.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    m.connect(analyser);
  }
  return analyser;
}
