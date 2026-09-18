/**
 * 烟花音效（实验室 /lab/fireworks）：双音色引擎。
 *
 * - "sample" 真实档：public/sounds/fireworks/ 下的真实烟花录音（launch×1 +
 *   boom×4 变体 + crackle×1，mp3 兼容 Safari）。首次使用才懒加载
 *   fetch → decodeAudioData → Map 缓存；播放随机变调（0.9~1.15）防复读机感。
 *   任一文件加载失败 → 状态 failed，自动回落合成档并在 UI 提示一次。
 * - "synth" 合成档：四层实时合成（sub thump 低频下坠 / body 扫频主体 /
 *   crack 高频瞬态 / crackle 余烬噼啪），接压缩 + 程序混响总线。
 *   瓶艺音效（bottle-audio 的 bs*）不走总线、完全不受影响。
 *
 * 与瓶艺共享同一个 AudioContext（bottle-audio 的 ac()），零音频文件预置时
 * 也只有合成引擎工作——总下载体积 = 采样档实际用到的 mp3。
 * 所有入口 first 参数为开关（EffectFlags.sound），关闭时零开销。
 * 音量由 fwSetVolume 统一控制（页面滑条，仅作用于烟花，不影响瓶艺音效）。
 *
 * 四种炸开形态各有声部（与 explode() 的 pattern 一一对应）：
 * 球形=经典"咚+砰"、环形=脆而短的高频"啪"、双层菊=先闷后脆的两段、
 * 柳垂=更大更沉的长响 + fwCrackle 余烬。
 *
 * 自动播放策略：AudioContext 惰性创建、被挂起时顺带 resume。开场自动两发
 * 在用户尚未交互时可能静默（ctx 处于 suspended），首次点击发射即手势解锁。
 */
import { ac, tone, noise, jitter } from "@/lib/bottles/audio";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export type FwTimbre = "sample" | "synth";

/** 页面滑条控制的音量（0~1），只作用于烟花音效 */
let volume = 0.8;
export function fwSetVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  if (bus) bus.master.gain.value = volume;
}

let timbre: FwTimbre = "sample";
export function fwSetTimbre(m: FwTimbre) {
  timbre = m;
  if (m === "sample") loadSamples(); // 切到真实档顺手预热
}

/* ---- 合成总线：master(音量) → 压缩器 → destination；炸开声部另送混响 ---- */
interface Bus {
  master: GainNode;
  /** 混响发送总线（低端机为 null——卷积 CPU 开销不值）；声部 → send → convolver → master */
  send: GainNode | null;
}
let bus: Bus | null = null;

function getBus(): Bus | null {
  const c = ac();
  if (!c) return null;
  if (bus) return bus;
  const master = c.createGain();
  master.gain.value = volume;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 24;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  master.connect(comp).connect(c.destination);
  let send: GainNode | null = null;
  // 2 核及以下跳过卷积混响（FFT 卷积实时性吃 CPU）
  if ((navigator.hardwareConcurrency ?? 4) > 2) {
    // 程序生成混响 IR：1.2s 立体声指数衰减噪声（烟花在开阔夜空的那点"堂音"）
    const len = Math.floor(c.sampleRate * 1.2);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const conv = c.createConvolver();
    conv.buffer = ir;
    send = c.createGain();
    send.gain.value = 0.3;
    send.connect(conv).connect(master);
  }
  bus = { master, send };
  return bus;
}

/* ---- 采样引擎 ---- */
export type FwSampleStatus = "idle" | "loading" | "ready" | "failed";

const SAMPLE_FILES: Record<string, string> = {
  launch: "/sounds/fireworks/launch.mp3",
  boom0: "/sounds/fireworks/boom-0.mp3",
  boom1: "/sounds/fireworks/boom-1.mp3",
  boom2: "/sounds/fireworks/boom-2.mp3",
  boom3: "/sounds/fireworks/boom-3.mp3",
  crackle: "/sounds/fireworks/crackle.mp3",
};

let sampleStatus: FwSampleStatus = "idle";
let loadStarted = false;
const buffers = new Map<string, AudioBuffer>();
const statusListeners = new Set<(s: FwSampleStatus) => void>();

/** 订阅采样加载状态（UI 用于失败时提示一次）；返回取消订阅函数 */
export function fwOnSampleStatus(cb: (s: FwSampleStatus) => void): () => void {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

const setStatus = (s: FwSampleStatus) => {
  sampleStatus = s;
  statusListeners.forEach((cb) => cb(s));
};

/** 页面挂载时预热情用（真正解码仍要等 AudioContext 手势解锁后可用的时机） */
export function fwPreloadSamples() {
  loadSamples();
}

async function loadSamples() {
  if (loadStarted) return;
  loadStarted = true;
  const c = ac();
  if (!c) {
    setStatus("failed");
    return;
  }
  setStatus("loading");
  try {
    const results = await Promise.all(
      Object.entries(SAMPLE_FILES).map(async ([key, url]) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(url);
        const raw = await res.arrayBuffer();
        return [key, await c.decodeAudioData(raw)] as const;
      }),
    );
    for (const [key, buf] of results) buffers.set(key, buf);
    setStatus("ready");
  } catch {
    setStatus("failed"); // route() 自动用合成档顶上
  }
}

/** 播放采样（gain 已含 volume）；返回 false 表示没播成（未就绪等） */
function playSample(key: string, gain: number): boolean {
  const c = ac();
  const buf = buffers.get(key);
  const b = c ? getBus() : null;
  if (!c || !buf || !b) return false;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rand(0.9, 1.15); // 每发微变调，避免复读机感
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(b.master); // 真实录音自带堂音，不再送混响
  src.start();
  return true;
}

/** 引擎路由：真实档且采样就绪走采样；否则（加载中/失败/合成档）走合成 */
function route(): "sample" | "synth" {
  if (timbre !== "sample") return "synth";
  if (sampleStatus === "ready") return "sample";
  if (sampleStatus === "idle") loadSamples(); // 首次播放顺手启动加载，这发先用合成顶上
  return "synth";
}

/* ---- 合成引擎：分层声部（接总线，与 tone/noise 原语解耦） ---- */

/** 一个带包络的滤波白噪声层（attack 可到 1~2ms，补齐爆炸瞬态） */
function noiseLayer(
  c: AudioContext,
  t0: number,
  dur: number,
  peak: number,
  filter: BiquadFilterNode,
  attack = 0.002,
): GainNode {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
  return g;
}

/** 一个快速起振的振荡器层（sub thump 等） */
function toneLayer(
  c: AudioContext,
  t0: number,
  freq: number,
  freqEnd: number,
  dur: number,
  peak: number,
  type: OscillatorType = "sine",
): GainNode {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
  return g;
}

/** 把若干声部挂上总线：主体 dry，炸开类声部再送一份混响 */
function toBus(c: AudioContext, layers: GainNode[], wet: boolean) {
  const b = getBus();
  if (!b) return;
  for (const l of layers) {
    l.connect(b.master);
    if (wet && b.send) l.connect(b.send);
  }
}

/** 合成炸开（升级版）：四层结构，variant 对应 explode() 的形态（0 球形 / 1 环形 / 2 双层菊 / 3 柳垂） */
function synthBoom(variant: number, v: number) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const mkFilter = (type: BiquadFilterType, from: number, to: number, q = 0.8) => {
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + 0.3);
    return f;
  };
  switch (variant) {
    case 1: {
      // 环形：脆而短的高频"啪"，像礼炮弹开
      const layers = [
        toneLayer(c, t0, jitter(230, 0.1), 95, 0.13, 0.13 * v, "triangle"),
        noiseLayer(c, t0, 0.16, 0.13 * v, mkFilter("lowpass", 3200, 420)),
        noiseLayer(c, t0, 0.05, 0.12 * v, mkFilter("bandpass", 5200, 3600, 1.2)),
      ];
      toBus(c, layers, true);
      break;
    }
    case 2: {
      // 双层菊：先闷"咚"，约 100ms 后补一层脆"沙"——对应两层花瓣先后绽开
      const layers = [
        toneLayer(c, t0, 142, 46, 0.26, 0.15 * v),
        noiseLayer(c, t0, 0.3, 0.1 * v, mkFilter("lowpass", 1000, 120)),
        noiseLayer(c, t0, 0.06, 0.09 * v, mkFilter("bandpass", 4200, 3000, 1.1)),
      ];
      toBus(c, layers, true);
      setTimeout(() => {
        const c2 = ac();
        if (!c2) return;
        const t1 = c2.currentTime;
        const f1 = c2.createBiquadFilter();
        f1.type = "lowpass";
        f1.Q.value = 0.8;
        f1.frequency.setValueAtTime(3600, t1);
        f1.frequency.exponentialRampToValueAtTime(620, t1 + 0.14);
        const layers2 = [
          noiseLayer(c2, t1, 0.14, 0.08 * v, f1),
          toneLayer(c2, t1, jitter(1700, 0.1), 860, 0.09, 0.045 * v, "triangle"),
        ];
        toBus(c2, layers2, true);
      }, rand(80, 130));
      break;
    }
    case 3: {
      // 柳垂：更大更沉的长响（余烬噼啪由 fwCrackle 补）
      const layers = [
        toneLayer(c, t0, 116, 36, 0.44, 0.2 * v),
        noiseLayer(c, t0, 0.58, 0.15 * v, mkFilter("lowpass", 800, 78)),
        noiseLayer(c, t0, 0.07, 0.08 * v, mkFilter("bandpass", 3400, 2400, 1.1)),
      ];
      toBus(c, layers, true);
      break;
    }
    default: {
      // 球形：经典"咚+砰"——sub 下坠 + 扫频主体 + 高频炸裂瞬态
      const layers = [
        toneLayer(c, t0, 150, 38, 0.3, 0.15 * v),
        noiseLayer(c, t0, 0.36, 0.11 * v, mkFilter("lowpass", 1150, 90)),
        noiseLayer(c, t0, 0.06, 0.1 * v, mkFilter("bandpass", 3600, 2600, 1.2)),
      ];
      toBus(c, layers, true);
    }
  }
}

/* ---- 对外四入口（签名与旧版兼容） ---- */

/** 发射：上升哨音（三角波向上扫频 + 推进气声）或真实发射采样 */
export function fwLaunch(on: boolean, riseSec = 1) {
  if (!on) return;
  if (route() === "sample" && playSample("launch", 0.5 * volume)) return;
  const v = volume;
  tone(jitter(520, 0.08), Math.max(0.4, riseSec * 0.8), 0.04 * v, "triangle", jitter(1420, 0.05));
  noise(Math.max(0.25, riseSec * 0.45), 1300, 480, 0.013 * v);
}

/**
 * 炸开：variant 对应 explode() 的形态（0 球形 / 1 环形 / 2 双层菊 / 3 柳垂），
 * size 0~1 按弹体大小（粒子数）调响度——小弹轻、大弹响。
 */
export function fwBoom(on: boolean, variant = 0, size = 0.6) {
  if (!on) return;
  const v = volume * (0.65 + 0.45 * size);
  if (route() === "sample" && playSample(`boom${variant % 4}`, Math.min(1, v * 0.9))) {
    if (variant === 3) fwCrackle(true);
    return;
  }
  synthBoom(variant, v);
}

/** 柳垂余烬的零星噼啪：合成档为散布短噪声，采样档为 crackle 录音 */
export function fwCrackle(on: boolean) {
  if (!on) return;
  if (route() === "sample" && playSample("crackle", 0.4 * volume)) return;
  const c = ac();
  if (!c) return;
  const n = 2 + Math.floor(rand(0, 3));
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const c2 = ac();
      if (!c2) return;
      const t1 = c2.currentTime;
      const f = c2.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 2.5;
      f.frequency.value = rand(2600, 5200);
      toBus(c2, [noiseLayer(c2, t1, 0.03, 0.028 * volume, f)], false);
    }, rand(250, 1200));
  }
}
