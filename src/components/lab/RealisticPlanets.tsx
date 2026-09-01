"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { PLANETS, TEX, type PlanetDef, type PlanetId } from "./planetConfig";

/** 恒星位于世界原点 —— 昼夜晨昏线、夜面灯光、环的受光都据此计算 */
const SUN_WORLD = new THREE.Vector3(0, 0, 0);

/* ============================================================
 * 1. 夜面城市灯光
 * 只在背光半球点亮的加性层。地球绕到恒星背面时，
 * 城市灯光会从夜半球"浮"出来 —— 这是整个真实模式最打动人的一帧。
 * ========================================================== */
const nightVert = /* glsl */ `
  varying vec2 vUvN;
  varying vec3 vWN;
  varying vec3 vWP;
  void main() {
    vUvN = uv;
    vWN  = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP  = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const nightFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3  uSun;
  uniform vec3  uColor;
  uniform float uIntensity;
  varying vec2 vUvN;
  varying vec3 vWN;
  varying vec3 vWP;
  void main() {
    vec3  L = normalize(uSun - vWP);
    float d = dot(normalize(vWN), L);
    // 背光面 = 1，向阳面 = 0，中间平滑过渡出晨昏线
    float night = 1.0 - smoothstep(-0.18, 0.12, d);

    vec3  c   = texture2D(uMap, vUvN).rgb;
    float lum = max(max(c.r, c.g), c.b);

    /* 这条曲线的关键是「别把 lum 乘两遍」。
     * 这张夜光图 99% 的像素 sRGB 亮度在 0.3 以下（中位数仅 0.078），
     * 早先写成 c * pow(lum, 1.35)，实际是 lum^2.35 —— 整张图被压成全黑。
     * 现在贴图只贡献色相，亮度完全由下面这条曲线决定：
     *   smoothstep(0.020, 0.060, lum)  压掉海洋本底（线性 0.020 ≈ sRGB 0.15，
     *                                  是「有没有城市」的分界）
     *   pow(lum, 0.5)                  平方根抬暗部，让郊野微光浮出来
     *   pow(lum, 4.0)                  只有核心城区触发，爆出光晕
     */
    float m   = smoothstep(0.020, 0.060, lum) * pow(lum, 0.5);
    float hot = pow(lum, 4.0);

    vec3 hue = c / max(lum, 1e-4);                     // 归一化，只留色相
    vec3 col = mix(hue, uColor, 0.65) * (m * 1.6 + hot * 2.0);

    gl_FragColor = vec4(col * uIntensity * night, 1.0);
  }
`;

function NightLights({
  radius,
  map,
  color = "#ffd0a0",
  intensity = 2.0,
}: {
  radius: number;
  map: THREE.Texture;
  color?: string;
  intensity?: number;
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: map },
          uSun: { value: SUN_WORLD.clone() },
          uColor: { value: new THREE.Color(color) },
          uIntensity: { value: intensity },
        },
        vertexShader: nightVert,
        fragmentShader: nightFrag,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [map, color, intensity],
  );
  useEffect(() => () => mat.dispose(), [mat]);

  /* renderOrder 1：先画夜灯，云层（2）再叠上去，云才会遮住城市灯光 */
  return (
    <mesh material={mat} renderOrder={1}>
      <sphereGeometry args={[radius, 64, 48]} />
    </mesh>
  );
}

/* ============================================================
 * 2. 大气 Fresnel 边缘光
 * 性价比最高的一层：加上它，星球立刻从"贴图球"变成"有空气的天体"。
 * sunLit = true 时辉光只在受光侧亮，晨昏线附近留一圈夕阳色的过渡。
 * ========================================================== */
const atmoVert = /* glsl */ `
  varying vec3 vWN;
  varying vec3 vWP;
  void main() {
    vWN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const atmoFrag = /* glsl */ `
  uniform vec3  uColor;
  uniform float uIntensity;
  uniform float uPower;
  uniform vec3  uSun;
  uniform float uSunLit;
  varying vec3 vWN;
  varying vec3 vWP;
  void main() {
    vec3 V = normalize(cameraPosition - vWP);
    // 只在球体边缘亮（视线与法线接近垂直处）
    float f = pow(1.0 - abs(dot(normalize(vWN), V)), uPower);
    float lit = 1.0;
    if (uSunLit > 0.5) {
      vec3 L = normalize(uSun - vWP);
      lit = 0.16 + 0.84 * smoothstep(-0.45, 0.35, dot(normalize(vWN), L));
    }
    gl_FragColor = vec4(uColor, clamp(f * uIntensity * lit, 0.0, 1.0));
  }
`;

export function Atmosphere({
  radius,
  color,
  intensity = 1,
  power = 3,
  sunLit = true,
}: {
  radius: number;
  color: string;
  intensity?: number;
  power?: number;
  sunLit?: boolean;
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uIntensity: { value: intensity },
          uPower: { value: power },
          uSun: { value: SUN_WORLD.clone() },
          uSunLit: { value: sunLit ? 1 : 0 },
        },
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    // 参数变化不重建材质，只同步 uniform
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    mat.uniforms.uColor.value.set(color);
    mat.uniforms.uIntensity.value = intensity;
    mat.uniforms.uPower.value = power;
    mat.uniforms.uSunLit.value = sunLit ? 1 : 0;
  }, [mat, color, intensity, power, sunLit]);
  useEffect(() => () => mat.dispose(), [mat]);

  return (
    <mesh material={mat} renderOrder={4}>
      <sphereGeometry args={[radius, 32, 24]} />
    </mesh>
  );
}

/* ============================================================
 * 3. 行星环
 * 环贴图是「半径条带」：u = 半径归一，v 固定 0.5。
 * RingGeometry 默认 UV 是按方形映射的，必须重写，否则贴图会错乱。
 *
 * 受光不用 Lambert —— 环的法线垂直于环面，而恒星几乎就在环面里，
 * 按 N·L 算会全黑。真实环的亮度取决于太阳相对环面的仰角：
 * 土星 26.7° 侧照偏暗，天王星 97.8° 近乎正照所以更亮。
 * ========================================================== */
const ringVert = /* glsl */ `
  varying vec2 vUvR;
  varying vec3 vRN;
  varying vec3 vRP;
  void main() {
    vUvR = uv;
    vRN  = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vRP  = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ringFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uAlpha;
  uniform vec3  uSun;
  uniform float uOpacity;
  varying vec2 vUvR;
  varying vec3 vRN;
  varying vec3 vRP;
  void main() {
    vec4  tex = texture2D(uMap, vUvR);
    float a   = texture2D(uAlpha, vUvR).r;
    vec3  L   = normalize(uSun - vRP);
    // 太阳相对环面的仰角正弦：0 = 正侧照（环与阳光平行），1 = 正照
    float elev = abs(dot(L, normalize(vRN)));
    float lit  = 0.40 + 0.60 * elev;
    gl_FragColor = vec4(tex.rgb * lit, a * uOpacity);
  }
`;

function PlanetRing({
  inner,
  outer,
  map,
  alphaMap,
  opacity = 1,
}: {
  inner: number;
  outer: number;
  map: THREE.Texture;
  alphaMap: THREE.Texture;
  opacity?: number;
}) {
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(inner, outer, 180, 1);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const s = (v.length() - inner) / (outer - inner);
      uv.setXY(i, s, 0.5);
    }
    uv.needsUpdate = true;
    return g;
  }, [inner, outer]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: map },
          uAlpha: { value: alphaMap },
          uSun: { value: SUN_WORLD.clone() },
          uOpacity: { value: opacity },
        },
        vertexShader: ringVert,
        fragmentShader: ringFrag,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    [map, alphaMap, opacity],
  );

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  return (
    <mesh geometry={geo} material={mat} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3} />
  );
}

/* ============================================================
 * 4. 单颗真实行星
 * 层级：轨道倾角 → 公转 → 定位 → 自转轴倾角 → 自转（地表/云/夜灯）→ 环 → 大气
 * 公转用绝对时间，切换前后行星不会跳位。
 * ========================================================== */
function RealPlanet({
  def,
  onClick,
  tex,
}: {
  def: PlanetDef;
  onClick: () => void;
  tex: Record<string, THREE.Texture>;
}) {
  const orbitGroup = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const cfg = TEX[def.id];

  const map = tex[def.id];
  const normalMap = cfg.normal ? tex[`${def.id}_normal`] : null;
  const nightMap = cfg.night ? tex[`${def.id}_night`] : null;
  const cloudMap = cfg.clouds ? tex[`${def.id}_clouds`] : null;
  const ringMap = cfg.ring ? tex[`${def.id}_ring`] : null;
  const ringAlpha = cfg.ringAlpha ? tex[`${def.id}_ring_alpha`] : null;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (orbitGroup.current) {
      orbitGroup.current.rotation.y = (t * Math.PI * 2) / def.period + def.phase;
    }
    // 自转用 delta 累加，切走再切回来不会瞬移
    if (spin.current) spin.current.rotation.y += delta * cfg.spin;
    // 云层比地表转得略快一点
    if (clouds.current && cfg.cloudSpin) {
      clouds.current.rotation.y += delta * (cfg.cloudSpin - cfg.spin);
    }
  });

  return (
    /* 轨道倾角：真实值，让各行星不共面 —— 也顺带避免外圈轨道在视觉上打架 */
    <group rotation={[THREE.MathUtils.degToRad(def.incl), 0, 0]}>
      <group ref={orbitGroup}>
        <group
          position={[def.orbit, 0, 0]}
          scale={hovered ? 1.14 : 1}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = "auto";
          }}
        >
          {/* 自转轴倾角（地球 23.4°、土星 26.7°、天王星 97.8° 侧躺） */}
          <group rotation={[0, 0, cfg.axial]}>
            {/* 自转：地表 + 云 + 夜灯一起转，城市灯光才不会飘 */}
            <group ref={spin}>
              <mesh renderOrder={0}>
                <sphereGeometry args={[def.r, 64, 48]} />
                {/* 不用 emissiveMap：那会让夜半球自己发光，晨昏线就被冲平了。
                    昼夜完全交给场景里那盏点光源。 */}
                <meshStandardMaterial
                  map={map}
                  normalMap={normalMap}
                  normalScale={normalMap ? new THREE.Vector2(0.7, 0.7) : undefined}
                  roughness={cfg.rough}
                  metalness={0}
                />
              </mesh>

              {/* 夜灯球比地表大 2%：太小会在近 1 / 远 4000 的深度精度下和地表 z-fighting，
                  出现麻点甚至整片消失。2% 在视觉上看不出来。 */}
              {nightMap && <NightLights radius={def.r * 1.02} map={nightMap} />}

              {cloudMap && (
                <mesh ref={clouds} renderOrder={2}>
                  <sphereGeometry args={[def.r * 1.014, 48, 32]} />
                  <meshStandardMaterial
                    map={cloudMap}
                    transparent
                    opacity={0.42}
                    depthWrite={false}
                    roughness={1}
                    metalness={0}
                  />
                </mesh>
              )}
            </group>

            {/* 环垂直于自转轴，所以放在倾角组里但不参与自转 */}
            {ringMap && ringAlpha && (
              <PlanetRing
                inner={def.r * (cfg.ringInner ?? 1.38)}
                outer={def.r * (cfg.ringOuter ?? 2.1)}
                map={ringMap}
                alphaMap={ringAlpha}
                opacity={def.id === "uranus" ? 0.75 : 1}
              />
            )}
          </group>

          {/* 大气不随自转，始终包裹整颗星 */}
          {cfg.atmo && (
            <Atmosphere
              radius={def.r * 1.17}
              color={cfg.atmo}
              intensity={cfg.atmoIntensity ?? 0.6}
              power={cfg.atmoPower ?? 3}
            />
          )}
        </group>
      </group>
    </group>
  );
}

/* ============================================================
 * 5. 真实模式行星系统
 * ========================================================== */
export default function RealisticSystem({
  onOpen,
}: {
  onOpen: (def: PlanetDef) => void;
}) {
  const gl = useThree((s) => s.gl);

  /** 贴图清单由配置推导，加行星只改 planetConfig，不用碰这里 */
  const texMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of PLANETS) {
      const c = TEX[p.id as PlanetId];
      m[p.id] = c.map;
      if (c.normal) m[`${p.id}_normal`] = c.normal;
      if (c.night) m[`${p.id}_night`] = c.night;
      if (c.clouds) m[`${p.id}_clouds`] = c.clouds;
      if (c.ring) m[`${p.id}_ring`] = c.ring;
      if (c.ringAlpha) m[`${p.id}_ring_alpha`] = c.ringAlpha;
    }
    return m;
  }, []);

  const tex = useTexture(texMap) as unknown as Record<string, THREE.Texture>;

  // 颜色空间与采样质量：albedo 必须 sRGB，法线 / alpha 遮罩必须线性
  useMemo(() => {
    const LINEAR = /_(normal|ring_alpha)$/;
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    Object.entries(tex).forEach(([k, t]) => {
      t.colorSpace = LINEAR.test(k) ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
    });
  }, [tex, gl]);

  return (
    <group>
      {PLANETS.map((def) => (
        <RealPlanet key={def.id} def={def} onClick={() => onOpen(def)} tex={tex} />
      ))}
    </group>
  );
}

/* ============================================================
 * 6. 真实恒星
 * 不用贴图 —— 程序化 fbm 湍流做米粒组织，加上真实恒星的边缘变暗
 * （limb darkening）。比日面贴图更好：体积为 0，且表面一直在流动。
 * ========================================================== */
const sunVert = /* glsl */ `
  varying vec3 vSP;
  varying vec3 vSN;
  varying vec3 vSV;
  void main() {
    vSP = position;
    vSN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vSV = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const sunFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vSP;
  varying vec3 vSN;
  varying vec3 vSV;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
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
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 p = normalize(vSP) * 4.5;
    // 两层不同速度的湍流叠在一起，表面才不会像一张静止的贴图
    float n1 = fbm(p + vec3(0.0, uTime * 0.05, uTime * 0.03));
    float n2 = fbm(p * 2.3 - vec3(uTime * 0.08, 0.0, uTime * 0.02));
    float turb = n1 * 0.6 + n2 * 0.4;

    // 米粒组织：亮的等离子体胞
    float cell = smoothstep(0.34, 0.72, turb);

    // 真实恒星的边缘变暗（中心比边缘亮）
    float limb = pow(clamp(dot(normalize(vSN), normalize(-vSV)), 0.0, 1.0), 0.45);

    vec3 col = mix(vec3(0.78, 0.24, 0.04), vec3(1.00, 0.80, 0.34), cell);
    col = mix(col, vec3(1.00, 0.97, 0.86), pow(cell, 3.0));
    col *= 0.5 + 0.8 * limb;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function SunMaterial() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: sunVert,
        fragmentShader: sunFrag,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return <primitive object={mat} attach="material" />;
}
