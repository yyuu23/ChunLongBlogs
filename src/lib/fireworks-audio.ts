/**
 * 烟花音效（实验室 /lab/fireworks）：发射哨音 + 按形态区分的炸开声 + 柳垂噼啪。
 * 复用 bottle-audio 的合成原语（tone/noise/jitter），与瓶艺共享同一个
 * AudioContext——零音频文件、零下载体积。所有入口 first 参数为开关
 * （EffectFlags.sound），关闭时零开销。
 *
 * 四种炸开形态各有声部（与 explode() 的 pattern 一一对应）：
 * 球形=经典"咚+砰"、环形=脆而短的高频"啪"、双层菊=先闷后脆的两段、
 * 柳垂=更大更沉的长响；同形态再按弹体大小（粒子数）微调响度，
 * 叠加 jitter 音高微随机，每发听起来都不完全一样。
 *
 * 音量由 fwSetVolume 统一控制（页面滑条，仅作用于烟花，不影响瓶艺音效）。
 *
 * 自动播放策略：AudioContext 惰性创建、被挂起时顺带 resume。开场自动两发
 * 与自动模式在用户尚未交互时可能静默（ctx 处于 suspended），首次点击发射
 * 即手势解锁，属预期行为。
 */
import { tone, noise, jitter } from "./bottle-audio";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** 页面滑条控制的音量（0~1），只作用于烟花音效 */
let volume = 0.8;
export function fwSetVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
}

/** 发射：上升哨音（三角波向上扫频，时长对齐该发火箭的实际升空时间）+ 轻微推进气声 */
export function fwLaunch(on: boolean, riseSec = 1) {
  if (!on) return;
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
  switch (variant) {
    case 1:
      // 环形：脆而短的高频"啪"，像礼炮弹开
      tone(jitter(230, 0.1), 0.13, 0.13 * v, "triangle", 95);
      noise(0.16, 3200, 420, 0.13 * v);
      break;
    case 2:
      // 双层菊：先闷"咚"，约 100ms 后补一层脆"沙"——对应两层花瓣先后绽开
      tone(142, 0.26, 0.15 * v, "sine", 46);
      noise(0.3, 1000, 120, 0.1 * v);
      setTimeout(() => {
        noise(0.14, 3600, 620, 0.08 * v);
        tone(jitter(1700, 0.1), 0.09, 0.045 * v, "triangle", 860);
      }, rand(80, 130));
      break;
    case 3:
      // 柳垂：更大更沉的长响（余烬噼啪由 fwCrackle 补）
      tone(116, 0.44, 0.2 * v, "sine", 36);
      noise(0.58, 800, 78, 0.15 * v);
      break;
    default:
      // 球形：经典"咚+砰"
      tone(150, 0.3, 0.15 * v, "sine", 38);
      noise(0.36, 1150, 90, 0.11 * v);
  }
}

/** 柳垂余烬的零星噼啪：散布在余晖坠落期的几个极短小噪声 */
export function fwCrackle(on: boolean) {
  if (!on) return;
  const v = volume;
  const n = 2 + Math.floor(rand(0, 3));
  for (let i = 0; i < n; i++) {
    setTimeout(() => noise(0.03, 5200, 2400, 0.028 * v), rand(250, 1200));
  }
}
