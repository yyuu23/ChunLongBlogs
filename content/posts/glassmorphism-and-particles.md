---
title: 毛玻璃与粒子：这个博客的视觉配方
slug: glassmorphism-and-particles
description: 拆解本站的视觉与动效实现：分层背景、glass 工具类、CSS 关键帧粒子、Canvas 点击特效与 framer-motion。
cover: /assets/covers/cover-2.svg
category: tech
tags: [CSS, 动效, React]
date: 2026-08-24
pinned: true
---

很多人问这个站"看起来像果冻一样"的效果怎么做的，这篇文章一次讲清楚。核心配方只有四层。

## 第一层：背景三明治

整站背景是一个固定定位的容器，从下到上依次是：

1. **背景图轮播**（Ken Burns 缓放 + 交叉淡入）
2. **毛玻璃遮罩**：`backdrop-blur` 让所有背景都变柔和
3. **流动渐变**：一个 400% 尺寸的渐变块做 15 秒循环动画

```css
.gradient-flow {
  background: linear-gradient(-45deg, #a18cd1, #fbc2eb, #a1c4fd, #c2e9fb);
  background-size: 400% 400%;
  animation: gradient-move 15s ease infinite;
}

@keyframes gradient-move {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

## 第二层：毛玻璃卡片

所有卡片共用一个工具类，亮暗两套配色：

```css
.glass-card {
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.12);
}

.dark .glass-card {
  background: rgba(15, 23, 42, 0.5);
  border-color: rgba(255, 255, 255, 0.08);
}
```

> [!WARNING]
> `backdrop-filter` 在部分旧浏览器不可用，`@supports` 里记得给降级背景色。

## 第三层：粒子，但不花哨

樱花与萤火虫都不是 Canvas，而是**随机参数化的 DOM 元素 + CSS 关键帧 + 负延迟**：

```tsx
{Array.from({ length: 40 }, (_, i) => (
  <span
    key={i}
    style={{
      left: `${rand(0, 100)}vw`,
      animationDuration: `${rand(6, 12)}s`,
      animationDelay: `-${rand(0, 12)}s`, // 负延迟：首屏即满屏
    }}
    className="petal"
  />
))}
```

负延迟是关键——页面加载时所有粒子"已经在半路上"，不需要等一个完整的动画周期。

## 第四层：交互动效

点击爆破用 Canvas 实现（约 30 行）：每次 `pointerdown` 生成 10 个带初速度与重力的粒子，`requestAnimationFrame` 里更新透明度，透明度归零即回收。

卡片 3D 倾斜则是纯数学：鼠标相对卡片中心的偏移映射为 `rotateX/rotateY`（±6°），加上 `perspective: 1000px`。

亮色与暗色的粒子切换用 1 秒的透明度过渡做交叉淡化，配合 `transition-colors duration-700` 的卡片，整个主题切换就是"丝滑"本身。

> [!NOTE]
    性能优先：粒子数量在移动端减半，`prefers-reduced-motion` 时全部关闭。

## 小结

| 效果 | 技术 | 成本 |
| --- | --- | --- |
| 背景流动 | CSS gradient animation | 极低 |
| 毛玻璃 | backdrop-filter | 低 |
| 樱花/萤火虫 | DOM + keyframes | 低 |
| 点击爆破 | Canvas 2D | 低 |
| 卡片倾斜 | mouse 事件 + transform | 极低 |

动效的秘诀不是多，而是**所有元素遵循同一套缓动语言**。
