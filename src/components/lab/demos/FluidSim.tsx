"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers/LocaleProvider";
import { accentColor, parseRgb, rand } from "@/lib/demo-utils";

/**
 * 流体模拟实验（/lab/fluid）：手指/鼠标划过，像搅动一池彩色烟雾。
 *
 * Jos Stam「Stable Fluids」的 WebGL 精简实现（参考 MIT 开源
 * Pavel Dobryakov / WebGL-Fluid-Simulation 的思路自写，不整包引入）：
 * - 半拉格朗日平流 → 散度 → Jacobi 迭代解压力（20 次）→ 梯度减除；
 * - 模拟分辨率固定 128、染料 256；无 bloom/sunrays/shading 后处理——染料直出；
 * - WebGL2 优先（RGBA16F 需 EXT_color_buffer_float），WebGL1 回退
 *   OES_texture_half_float；half-float 线性过滤不可用则整面板降级提示；
 * - 指针划动注入速度 + 染料（色相从主题色出发全局漂移）；
 * - 空闲每 3~6s 一次柔和自动扰动；webglcontextlost/restored 处理；
 * - DPR 钳制 ≤2、document.hidden 跳步（不累积大 dt）、reduced-motion 关自动扰动。
 */

interface FluidEngine {
  splat: (x: number, y: number, dx: number, dy: number, color: [number, number, number]) => void;
  step: (dt: number) => void;
  render: () => void;
  resize: () => void;
  destroy: () => void;
}

/* ---------- shader 源码 ---------- */

const VERT = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAG_ADVECTION = `
precision highp float; precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
void main () {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  vec4 result = texture2D(uSource, coord);
  float decay = 1.0 + dissipation * dt;
  gl_FragColor = result / decay;
}`;

const FRAG_DIVERGENCE = `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uVelocity, vL).x;
  float R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y;
  float B = texture2D(uVelocity, vB).y;
  vec2 C = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }
  float div = 0.5 * (R - L + T - B);
  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}`;

const FRAG_PRESSURE = `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main () {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float divergence = texture2D(uDivergence, vUv).x;
  float pressure = (L + R + B + T - divergence) * 0.25;
  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
}`;

const FRAG_GRADIENT = `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity -= vec2(R - L, T - B);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`;

const FRAG_SPLAT = `
precision highp float; precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main () {
  vec2 p = vUv - point.xy;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  vec3 base = texture2D(uTarget, vUv).xyz;
  gl_FragColor = vec4(base + splat, 1.0);
}`;

const FRAG_CLEAR = `
precision mediump float; precision mediump sampler2D;
varying highp vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
void main () {
  gl_FragColor = value * texture2D(uTexture, vUv);
}`;

const FRAG_DISPLAY = `
precision highp float; precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uTexture;
void main () {
  vec3 c = texture2D(uTexture, vUv).rgb;
  gl_FragColor = vec4(c, 1.0);
}`;

/* ---------- 引擎 ---------- */

const SIM_RES = 128;
const DYE_RES = 256;
const PRESSURE_ITER = 20;
const PRESSURE = 0.8;
const VELOCITY_DISSIPATION = 2.4;
const DENSITY_DISSIPATION = 1.1;
const SPLAT_RADIUS = 0.0022;

interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
}
interface DoubleFBO {
  read: FBO;
  write: FBO;
  swap: () => void;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
  return shader;
}

/** 初始化流体引擎；不支持 half-float 渲染时返回 null（组件显示降级面板） */
function initFluid(canvas: HTMLCanvasElement): FluidEngine | null {
  const params = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
  let gl = canvas.getContext("webgl2", params) as WebGL2RenderingContext | null;
  let halfFloat: number;
  if (gl) {
    // WebGL2 渲染到 RGBA16F 需 EXT_color_buffer_float；half-float 线性过滤是核心功能
    if (!gl.getExtension("EXT_color_buffer_float")) gl = null;
    else halfFloat = gl.HALF_FLOAT;
  }
  let isGL2 = !!gl;
  let internalFormat: number;
  if (!gl) {
    const gl1 = canvas.getContext("webgl", params) as WebGLRenderingContext | null;
    if (!gl1) return null;
    const ext = gl1.getExtension("OES_texture_half_float");
    const linear = gl1.getExtension("OES_texture_half_float_linear");
    if (!ext || !linear) return null;
    gl = gl1 as unknown as WebGL2RenderingContext;
    halfFloat = (ext as OES_texture_half_float).HALF_FLOAT_OES;
    internalFormat = gl1.RGBA;
    isGL2 = false;
  } else {
    internalFormat = gl.RGBA16F;
  }
  const g = gl as unknown as WebGLRenderingContext;

  const vs = compile(g, g.VERTEX_SHADER, VERT);
  const sources: [string, string][] = [
    ["advection", FRAG_ADVECTION],
    ["divergence", FRAG_DIVERGENCE],
    ["pressure", FRAG_PRESSURE],
    ["gradient", FRAG_GRADIENT],
    ["splat", FRAG_SPLAT],
    ["clear", FRAG_CLEAR],
    ["display", FRAG_DISPLAY],
  ];
  const progs: Record<string, WebGLProgram> = {};
  for (const [name, src] of sources) {
    const fs = vs && compile(g, g.FRAGMENT_SHADER, src);
    if (!vs || !fs) return null;
    const p = g.createProgram();
    if (!p) return null;
    g.attachShader(p, vs);
    g.attachShader(p, fs);
    g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) return null;
    progs[name] = p;
  }

  // 全屏 quad（一个 VBO + IBO，所有 pass 共用）
  g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), g.STATIC_DRAW);
  g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, g.createBuffer());
  g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), g.STATIC_DRAW);
  g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
  g.enableVertexAttribArray(0);

  const createFBO = (w: number, h: number): FBO => {
    const texture = g.createTexture()!;
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, texture);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texImage2D(g.TEXTURE_2D, 0, internalFormat, w, h, 0, g.RGBA, halfFloat as number, null);
    const fbo = g.createFramebuffer()!;
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, texture, 0);
    g.viewport(0, 0, w, h);
    g.clearColor(0, 0, 0, 1);
    g.clear(g.COLOR_BUFFER_BIT);
    return { texture, fbo, width: w, height: h };
  };
  const createDouble = (w: number, h: number): DoubleFBO => {
    const d: DoubleFBO = {
      read: createFBO(w, h),
      write: createFBO(w, h),
      swap() {
        const t = d.read;
        d.read = d.write;
        d.write = t;
      },
    };
    return d;
  };

  const resByAspect = (base: number): [number, number] => {
    const aspect = Math.max(1, canvas.width / Math.max(1, canvas.height));
    return aspect > 1 ? [Math.round(base * aspect), base] : [base, Math.round(base / aspect)];
  };

  let velocity = createDouble(...resByAspect(SIM_RES));
  let pressure = createDouble(...resByAspect(SIM_RES));
  let divergence = createFBO(...resByAspect(SIM_RES));
  let dye = createDouble(...resByAspect(DYE_RES));

  const blit = (target: FBO | null) => {
    if (target == null) {
      g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
    } else {
      g.viewport(0, 0, target.width, target.height);
      g.bindFramebuffer(g.FRAMEBUFFER, target.fbo);
    }
    g.drawElements(g.TRIANGLES, 6, g.UNSIGNED_SHORT, 0);
  };
  const loc = (name: string, u: string) => g.getUniformLocation(progs[name]!, u);
  const setTexel = (name: string, w: number, h: number) =>
    g.uniform2f(loc(name, "texelSize"), 1 / w, 1 / h);
  const bindTex = (unit: number, texture: WebGLTexture) => {
    g.activeTexture(unit === 0 ? g.TEXTURE0 : g.TEXTURE1);
    g.bindTexture(g.TEXTURE_2D, texture);
  };

  const step = (dt: number) => {
    g.disable(g.BLEND);

    // ① 速度场自平流
    g.useProgram(progs.advection!);
    setTexel("advection", velocity.read.width, velocity.read.height);
    bindTex(0, velocity.read.texture);
    g.uniform1i(loc("advection", "uVelocity"), 0);
    bindTex(1, velocity.read.texture);
    g.uniform1i(loc("advection", "uSource"), 1);
    g.uniform1f(loc("advection", "dt"), dt);
    g.uniform1f(loc("advection", "dissipation"), VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    // ② 散度
    g.useProgram(progs.divergence!);
    setTexel("divergence", velocity.read.width, velocity.read.height);
    bindTex(0, velocity.read.texture);
    g.uniform1i(loc("divergence", "uVelocity"), 0);
    blit(divergence);

    // ③ 压力衰减 + Jacobi 迭代
    g.useProgram(progs.clear!);
    setTexel("clear", pressure.read.width, pressure.read.height);
    bindTex(0, pressure.read.texture);
    g.uniform1i(loc("clear", "uTexture"), 0);
    g.uniform1f(loc("clear", "value"), PRESSURE);
    blit(pressure.write);
    pressure.swap();

    g.useProgram(progs.pressure!);
    setTexel("pressure", pressure.read.width, pressure.read.height);
    for (let i = 0; i < PRESSURE_ITER; i++) {
      bindTex(0, pressure.read.texture);
      g.uniform1i(loc("pressure", "uPressure"), 0);
      bindTex(1, divergence.texture);
      g.uniform1i(loc("pressure", "uDivergence"), 1);
      blit(pressure.write);
      pressure.swap();
    }

    // ④ 梯度减除 → 无散速度场
    g.useProgram(progs.gradient!);
    setTexel("gradient", velocity.read.width, velocity.read.height);
    bindTex(0, pressure.read.texture);
    g.uniform1i(loc("gradient", "uPressure"), 0);
    bindTex(1, velocity.read.texture);
    g.uniform1i(loc("gradient", "uVelocity"), 1);
    blit(velocity.write);
    velocity.swap();

    // ⑤ 染料平流
    g.useProgram(progs.advection!);
    setTexel("advection", velocity.read.width, velocity.read.height);
    bindTex(0, velocity.read.texture);
    g.uniform1i(loc("advection", "uVelocity"), 0);
    bindTex(1, dye.read.texture);
    g.uniform1i(loc("advection", "uSource"), 1);
    g.uniform1f(loc("advection", "dissipation"), DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();
  };

  const render = () => {
    g.useProgram(progs.display!);
    bindTex(0, dye.read.texture);
    g.uniform1i(loc("display", "uTexture"), 0);
    blit(null);
  };

  const splat = (x: number, y: number, dx: number, dy: number, color: [number, number, number]) => {
    g.useProgram(progs.splat!);
    setTexel("splat", velocity.read.width, velocity.read.height);
    bindTex(0, velocity.read.texture);
    g.uniform1i(loc("splat", "uTarget"), 0);
    g.uniform1f(loc("splat", "aspectRatio"), canvas.width / Math.max(1, canvas.height));
    g.uniform2f(loc("splat", "point"), x, y);
    g.uniform3f(loc("splat", "color"), dx, dy, 0);
    g.uniform1f(loc("splat", "radius"), SPLAT_RADIUS * 0.5);
    blit(velocity.write);
    velocity.swap();

    bindTex(0, dye.read.texture);
    g.uniform1i(loc("splat", "uTarget"), 0);
    g.uniform3f(loc("splat", "color"), color[0], color[1], color[2]);
    g.uniform1f(loc("splat", "radius"), SPLAT_RADIUS);
    blit(dye.write);
    dye.swap();
  };

  return {
    splat,
    step,
    render,
    resize() {
      const [sw, sh] = resByAspect(SIM_RES);
      const [dw, dh] = resByAspect(DYE_RES);
      if (sw !== velocity.read.width || sh !== velocity.read.height) {
        velocity = createDouble(sw, sh);
        pressure = createDouble(sw, sh);
        divergence = createFBO(sw, sh);
      }
      if (dw !== dye.read.width || dh !== dye.read.height) {
        dye = createDouble(dw, dh);
      }
    },
    destroy() {
      g.bindFramebuffer(g.FRAMEBUFFER, null);
    },
  };
}

/* ---------- 组件 ---------- */

/** rgb → 色相（主题色联动的起始色） */
function hueOf([r, g, b]: [number, number, number]): number {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  if (d === 0) return 0.08;
  let h = 0;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return (h / 6 + 1) % 1;
}
function hsvRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const tt = v * (1 - (1 - f) * s);
  const table: [number, number, number][] = [
    [v, tt, p],
    [q, v, p],
    [p, v, tt],
    [p, q, v],
    [tt, p, v],
    [v, p, q],
  ];
  return table[i % 6]!.map((c) => c * 0.28) as [number, number, number]; // 注入量压暗些，颜色更耐看
}

export default function FluidSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unsupported, setUnsupported] = useState(false);
  const t = useT();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const accent = accentColor();
    let hue = hueOf(parseRgb(accent) ?? [255, 196, 110]);
    const nextColor = (): [number, number, number] => {
      hue = (hue + rand(0.01, 0.045)) % 1;
      return hsvRgb(hue, rand(0.7, 1), 1);
    };

    let fluid: FluidEngine | null = null;
    let raf = 0;
    let disposed = false;
    let last = performance.now();
    let lastInputAt = 0;
    let autoTimer: ReturnType<typeof setTimeout> | null = null;

    const resize = () => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      fluid?.resize();
    };

    const start = () => {
      fluid = initFluid(canvas);
      if (!fluid) {
        setUnsupported(true);
        return;
      }
      resize();
      // 开场招呼：中央一次柔和双色扰动
      fluid.splat(0.5, 0.5, rand(-60, 60), rand(20, 120), nextColor());
      fluid.splat(0.45, 0.55, rand(-60, 60), rand(20, 120), nextColor());
    };

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (fluid && !document.hidden) {
        fluid.step(dt);
        fluid.render();
      }
      if (!disposed) raf = requestAnimationFrame(loop);
    };

    const scheduleAuto = () => {
      if (disposed || reduced) return;
      autoTimer = setTimeout(() => {
        autoTimer = null;
        // 空闲（近 4s 无输入）才自动扰动，不打扰正在玩的人
        if (performance.now() - lastInputAt > 4000 && fluid) {
          const x = rand(0.2, 0.8);
          const y = rand(0.3, 0.8);
          const a = rand(0, Math.PI * 2);
          fluid.splat(x, y, Math.cos(a) * 90, Math.sin(a) * 90, nextColor());
        }
        scheduleAuto();
      }, rand(3000, 6000));
    };

    const pos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / rect.width, y: 1 - (e.clientY - rect.top) / rect.height };
    };
    let prev = { x: 0, y: 0 };
    let hasPrev = false;
    const onDown = (e: PointerEvent) => {
      prev = pos(e);
      hasPrev = true;
      lastInputAt = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.buttons === 0) return; // 鼠标需按住；触摸天然是按下
      const p = pos(e);
      lastInputAt = performance.now();
      if (hasPrev) {
        const dx = (p.x - prev.x) * canvas.width;
        const dy = (p.y - prev.y) * canvas.height;
        if (Math.abs(dx) + Math.abs(dy) > 1) fluid?.splat(p.x, p.y, dx * 6, dy * 6, nextColor());
      }
      prev = p;
      hasPrev = true;
    };
    const onLeave = () => {
      hasPrev = false;
    };
    const onLost = (e: Event) => {
      e.preventDefault(); // 允许 restored 事件
      fluid?.destroy();
      fluid = null;
    };
    const onRestored = () => {
      start();
      last = performance.now();
    };
    const onVisibility = () => {
      last = performance.now(); // 停更回来不累积大 dt
    };

    start();
    raf = requestAnimationFrame(loop);
    scheduleAuto();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (autoTimer) clearTimeout(autoTimer);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("visibilitychange", onVisibility);
      fluid?.destroy();
    };
  }, []);

  if (unsupported) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[2rem] bg-[#0a0e1e] text-center shadow-2xl">
        <p className="text-sm text-white/70">{t("lab.fluidUnsupported")}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-[#0a0e1e] shadow-2xl">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair"
        style={{ touchAction: "none" }}
        aria-label={t("lab.fluidHint")}
      />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[11px] tracking-widest text-white/35">
        {t("lab.fluidHint")}
      </p>
    </div>
  );
}
