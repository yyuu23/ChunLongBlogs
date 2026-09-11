/**
 * 烟花音效（实验室 /lab/fireworks）：发射哨音 + 炸开闷响 + 柳垂噼啪。
 * 复用 bottle-audio 的合成原语（tone/noise/jitter），与瓶艺共享同一个
 * AudioContext——零音频文件、零下载体积。所有入口 first 参数为开关
 * （EffectFlags.sound），关闭时零开销。
 *
 * 自动播放策略：AudioContext 惰性创建、被挂起时顺带 resume。开场自动两发
 * 与自动模式在用户尚未交互时可能静默（ctx 处于 suspended），首次点击发射
 * 即手势解锁，属预期行为。
 */
import { tone, noise, jitter } from "./bottle-audio";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** 发射：上升哨音（三角波 520→1450Hz 扫频，火箭约 0.9~1.3s 升空，音随弹走）+ 轻微推进气声 */
export function fwLaunch(on: boolean) {
  if (!on) return;
  tone(jitter(520, 0.08), 0.7, 0.035, "triangle", 1450);
  noise(0.45, 1300, 480, 0.012);
}

/** 炸开：低频下坠"咚"（sine 150→38Hz）+ 低通噪声"砰"；柳垂形态更大更沉 */
export function fwBoom(on: boolean, willow = false) {
  if (!on) return;
  tone(willow ? 118 : 150, willow ? 0.4 : 0.3, willow ? 0.2 : 0.15, "sine", 38);
  noise(willow ? 0.55 : 0.36, willow ? 820 : 1150, 90, willow ? 0.15 : 0.11);
}

/** 柳垂余烬的零星噼啪：散布在余晖坠落期的几个极短小噪声 */
export function fwCrackle(on: boolean) {
  if (!on) return;
  const n = 2 + Math.floor(rand(0, 3));
  for (let i = 0; i < n; i++) {
    setTimeout(() => noise(0.03, 5200, 2400, 0.026), rand(250, 1200));
  }
}
