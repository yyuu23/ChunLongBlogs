"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ============================================================
 * 深空背景
 *
 * 三层叠加，缺一层都会"少点什么"：
 *   1. 星云背景球   —— 提供色彩与纵深，否则黑底上的白点像屏幕噪点
 *   2. 三层星点     —— 大小/色温/闪烁频率分层，制造视差与"远近"
 *   3. 银河尘埃带   —— 一条斜贯天球的亮带，是"星空感"的关键
 * ========================================================== */

/* ---------- 1. 星云背景球 ---------- */
const nebulaVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nebulaFrag = /* glsl */ `
  varying vec3 vDir;
  uniform float uTime;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i);
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.02 + 1.3;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);

    // 两个尺度的湍流：大团块 + 边缘的丝状结构
    float n1 = fbm(d * 2.1 + vec3(1.3, 0.7, 2.1));
    float n2 = fbm(d * 5.3 - vec3(0.4, 2.2, 1.1));
    float neb = smoothstep(0.34, 0.92, n1 * 0.68 + n2 * 0.42);

    // 银河带：沿一个倾斜平面聚集，用高斯衰减做出"带状"
    float axis = abs(dot(d, normalize(vec3(0.30, 0.88, -0.37))));
    float band = exp(-pow(axis * 3.1, 2.0));
    float dust = smoothstep(0.28, 1.0, fbm(d * 8.0 + 3.0)) * band;
    // 带内的暗尘带，让银河不至于是一条均匀的白练
    dust *= 0.55 + 0.45 * smoothstep(0.15, 0.75, fbm(d * 16.0 - 5.0));

    vec3 col = vec3(0.012, 0.016, 0.042);                    // 深空底
    col += vec3(0.17, 0.09, 0.34) * neb * 0.60;              // 紫
    col += vec3(0.05, 0.15, 0.36) * neb * neb * 0.55;        // 蓝
    col += vec3(0.32, 0.13, 0.24) * pow(neb, 3.0) * 0.45;    // 洋红星云核
    col += vec3(0.44, 0.42, 0.38) * dust * 0.55;             // 银河尘埃
    col += vec3(0.10, 0.14, 0.30) * band * 0.22;             // 银河的漫射辉光

    // 极缓慢的整体呼吸，避免画面死板
    col *= 0.94 + 0.06 * sin(uTime * 0.05);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function Nebula() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: nebulaVert,
        fragmentShader: nebulaFrag,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime;
  });

  return (
    <mesh material={mat} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[1600, 48, 32]} />
    </mesh>
  );
}

/* ---------- 2. 星点 ---------- */
const starVert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3  aColor;
  uniform float uTime;
  uniform float uDpr;
  uniform float uTwinkle;
  varying float vTw;
  varying vec3  vCol;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // 每颗星有自己的闪烁相位与频率，整体才不会像一起呼吸
    float tw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.5 + aPhase * 0.35) + aPhase * 6.283));
    vTw = clamp(tw, 0.15, 1.0);
    vCol = aColor;
    /* 1/z 透视缩放。clamp 是保险：万一将来有星点跑到相机附近，
       也不会被放大成糊满屏幕的光斑。 */
    gl_PointSize = clamp(
      aSize * uDpr * (0.55 + 0.45 * vTw) * (620.0 / max(-mv.z, 1.0)),
      0.0,
      26.0 * uDpr
    );
  }
`;

const starFrag = /* glsl */ `
  varying float vTw;
  varying vec3  vCol;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // 中心亮 + 外围高斯衰减 = 点光源的光晕，而不是一个硬边方块
    float core = smoothstep(0.5, 0.0, d);
    float a = pow(core, 2.6) + pow(core, 8.0) * 0.6;
    gl_FragColor = vec4(vCol * (0.6 + 0.4 * vTw), a * vTw);
  }
`;

function buildStars(count: number, radius: number, sizeMin: number, sizeMax: number) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const c = new THREE.Color();

  for (let i = 0; i < count; i++) {
    /* 球面均匀分布（若直接对角度均匀采样，两极会堆成一团）。
     * 半径抖动只留 ±10%：整个壳层必须待在相机可达范围（maxDistance）之外，
     * 否则缩放到远处时，近处的星会被 gl_PointSize 里的 1/z 放大成大片光斑。 */
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * (0.90 + Math.random() * 0.10);
    const sp = Math.sin(phi);
    pos[i * 3] = sp * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.cos(phi) * r * 0.82; // 稍微压扁，视觉上更像银河系
    pos[i * 3 + 2] = sp * Math.sin(theta) * r;

    // 色温分布：多数冷白，少量暖白，个别橙红（近似真实恒星色指数分布）
    const t = Math.random();
    if (t < 0.7) c.setHSL(0.57 + Math.random() * 0.06, 0.16 + Math.random() * 0.24, 0.78 + Math.random() * 0.22);
    else if (t < 0.9) c.setHSL(0.11 + Math.random() * 0.05, 0.20 + Math.random() * 0.22, 0.78 + Math.random() * 0.2);
    else c.setHSL(0.02 + Math.random() * 0.06, 0.45 + Math.random() * 0.25, 0.64 + Math.random() * 0.2);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;

    // 幂次偏置：绝大多数是暗弱小星，少数亮星
    size[i] = sizeMin + Math.pow(Math.random(), 2.4) * (sizeMax - sizeMin);
    phase[i] = Math.random();
  }
  return { pos, col, size, phase, count };
}

function StarLayer({
  count,
  radius,
  sizeMin,
  sizeMax,
  twinkle,
  drift,
}: {
  count: number;
  radius: number;
  sizeMin: number;
  sizeMax: number;
  twinkle: number;
  drift: number;
}) {
  const dpr = useThree((s) => s.viewport.dpr);
  const ref = useRef<THREE.Points>(null);

  const geo = useMemo(() => {
    const d = buildStars(count, radius, sizeMin, sizeMax);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(d.pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(d.col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(d.size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(d.phase, 1));
    return g;
  }, [count, radius, sizeMin, sizeMax]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDpr: { value: dpr },
          uTwinkle: { value: twinkle },
        },
        vertexShader: starVert,
        fragmentShader: starFrag,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    // dpr 只在初始化时读取，之后由下面 useFrame 兜住
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [twinkle],
  );

  useEffect(() => {
    mat.uniforms.uDpr.value = dpr;
  }, [dpr, mat]);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime;
    // 极缓慢自转：天球在动，但慢到你不会觉得它在转
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * drift;
  });

  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

/* ---------- 组装 ----------
 * 三层壳层半径必须大于 LabScene 里 OrbitControls 的 maxDistance（1000）：
 * 相机拉到最远时仍要待在所有壳层之内，否则 1/z 放大的星点会糊成大光斑。 */
export default function DeepSpace() {
  return (
    <>
      <Nebula />
      {/* 远场：密而小，构成"星尘"底噪 */}
      <StarLayer count={6500} radius={1500} sizeMin={0.9} sizeMax={2.6} twinkle={0.35} drift={0.0012} />
      {/* 中场：主力星点 */}
      <StarLayer count={1800} radius={1900} sizeMin={2.0} sizeMax={4.6} twinkle={0.5} drift={0.0022} />
      {/* 近场：少量亮星带光晕，负责"抓眼" */}
      <StarLayer count={240} radius={2300} sizeMin={4.2} sizeMax={10.0} twinkle={0.72} drift={0.0034} />
    </>
  );
}
