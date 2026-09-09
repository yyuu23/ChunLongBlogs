"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { useLocale, useT } from "@/components/providers/LocaleProvider";
import { pick } from "@/lib/i18n/config";
import { trackEvent } from "@/lib/track";
import {
  PLANETS,
  BELT,
  TONE,
  ROMAN,
  hash01,
  type PlanetDef,
  type ToneKey,
  type MomentItem,
  type StarItem,
  type PlanetCounts,
} from "./planetConfig";
import RealisticSystem, { Atmosphere, SunMaterial } from "./RealisticPlanets";
import DeepSpace from "./DeepSpace";

export type { MomentItem, StarItem, PlanetCounts };

/* ============ 行星标签 ============ */
function PlanetLabel({
  def,
  count,
  onClick,
}: {
  def: PlanetDef;
  count?: number;
  onClick: () => void;
}) {
  const orbitGroup = useRef<THREE.Group>(null);
  const tone = TONE[def.tone];
  const { locale } = useLocale();
  const t = useT();
  const name = pick(locale, def.name);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (orbitGroup.current) {
      orbitGroup.current.rotation.y = (t * Math.PI * 2) / def.period + def.phase;
    }
  });

  return (
    <group rotation={[THREE.MathUtils.degToRad(def.incl), 0, 0]}>
      <group ref={orbitGroup}>
        <Html position={[def.orbit, def.r + 7, 0]} center distanceFactor={190}>
          <button
            onClick={onClick}
            className="group flex cursor-pointer flex-col items-center border-0 bg-transparent p-0 text-white"
            style={{ pointerEvents: "auto" }}
            title={`${name} · ${pick(locale, tone.label)}${count != null ? ` · ${t("lab.itemCount", { n: count })}` : ""}`}
          >
            <span className="whitespace-nowrap text-sm font-bold tracking-wide drop-shadow">
              {pick(locale, def.label)}
            </span>
            <span className="whitespace-nowrap text-[9px] tracking-widest text-white/45">
              {name} · {ROMAN[def.order]}
            </span>
            <span className="mt-0.5 hidden text-[9px] text-white/60 group-hover:block">
              {count != null ? t("lab.itemCount", { n: count }) : def.href ? t("lab.visit") : t("lab.clickView")}
            </span>
          </button>
        </Html>
      </group>
    </group>
  );
}

/** 轨道线 */
function OrbitRing({
  radius,
  incl,
  tone,
}: {
  radius: number;
  incl: number;
  tone: ToneKey;
}) {
  return (
    <group rotation={[THREE.MathUtils.degToRad(incl), 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.5, radius + 0.5, 160]} />
        <meshBasicMaterial
          color={TONE[tone].glow}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ============ 恒星 ============ */

/** hex 通道相乘：把日冕基色向节日 tint 偏移（t=0 原色，1 全偏） */
function tintHex(base: string, tint: string | undefined, t: number): string {
  if (!tint || t <= 0) return base;
  const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [br, bg, bb] = ch(base);
  const [tr, tg, tb] = ch(tint);
  const mix = (b: number, f: number) =>
    Math.round(255 * (b * (1 - t) + b * f * t))
    .toString(16)
    .padStart(2, "0");
  return `#${mix(br, tr)}${mix(bg, tg)}${mix(bb, tb)}`;
}

function Sun({ onClick, tint }: { onClick: () => void; tint?: string }) {
  const core = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    // 极缓呼吸（与音乐无关）
    const t = state.clock.elapsedTime;
    if (core.current) core.current.scale.setScalar(1 + 0.015 * Math.sin(t * Math.PI * 0.5));
  });

  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.6}>
      <mesh
        ref={core}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <sphereGeometry args={[18, 64, 48]} />
        {/* 程序化米粒组织 + 边缘变暗；节日当天 tint 偏色 */}
        <SunMaterial tint={tint} tintMix={0.55} />
        {/* 日冕：两层加性光晕。自带发光，不参与昼夜受光，所以 sunLit=false；
            颜色随节日 tint 同步偏移，与核心一致 */}
        <Atmosphere radius={18 * 1.38} color={tintHex("#ffb45a", tint, 0.5)} intensity={1.0} power={2.2} sunLit={false} />
        <Atmosphere radius={18 * 2.6} color={tintHex("#ff8a3d", tint, 0.5)} intensity={0.34} power={3.0} sunLit={false} />
      </mesh>
    </Float>
  );
}

/* ============ 点击恒星的星屑爆发 ============ */
function Burst({ onDone }: { onDone: () => void }) {
  const count = 160;
  const matRef = useRef<THREE.PointsMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const start = useRef<number | null>(null);

  const burstGeo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const d = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 18 + Math.random() * 26;
      d[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      d[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      d[i * 3 + 2] = Math.cos(phi) * speed;
    }
    return { pos, d };
  }, []);

  useFrame((state) => {
    if (start.current === null) start.current = state.clock.elapsedTime;
    const t = (state.clock.elapsedTime - start.current) / 1.4;
    if (t >= 1) {
      onDone();
      return;
    }
    const posAttr = pointsRef.current?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (posAttr) {
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < count * 3; i++) arr[i] = burstGeo.d[i] * t;
      posAttr.needsUpdate = true;
    }
    if (matRef.current) matRef.current.opacity = 1 - t;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[burstGeo.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={matRef} size={1.6} color="#ffd27d" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

/* ============ 小行星带 = 访客留声星（火星与木星之间） ============ */

/** 星星在带内的确定性位姿（由 id 哈希）：InstancedMesh 与特殊星共用同一公式，
 *  保证自己的星无论用哪种形态渲染都待在同一个位置 */
function starTransform(s: Pick<StarItem, "id">) {
  const a = hash01(s.id, 1) * Math.PI * 2;
  const r = BELT.inner + hash01(s.id, 3) * (BELT.outer - BELT.inner);
  const y = (hash01(s.id, 2) - 0.5) * BELT.spread;
  return {
    pos: [Math.cos(a) * r, y, Math.sin(a) * r] as [number, number, number],
    scale: 1.3 + hash01(s.id, 4) * 1.1,
    rot: [hash01(s.id, 5) * Math.PI, hash01(s.id, 6) * Math.PI, 0] as [number, number, number],
  };
}

/** 自己的星 / 站长精选星：独立 mesh（数量极少，无性能顾虑）。
 *  mine = 青蓝快脉冲 + 悬浮标签；featured = 白金慢脉冲、更大。
 *  highlight 为毫秒时间戳：6 秒内强高亮（留星成功 / 点「找到我的星」时）。 */
function SpecialStar({
  star,
  highlight,
  labeled,
  onOpen,
}: {
  star: StarItem;
  highlight: number;
  labeled: boolean;
  onOpen: (s: StarItem) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { pos, rot } = starTransform(star);
  const mine = !!star.mine;
  const base = mine ? 1.8 : 2.4;
  const color = mine ? "#9be7ff" : "#fff6dc";
  const emissive = mine ? "#38bdf8" : "#ffe9a8";
  const speed = mine ? 3.2 : 1.4;
  const t = useT();

  useFrame((state) => {
    if (!meshRef.current) return;
    const boost = Date.now() - highlight < 6000 ? 1 : 0;
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * speed * (1 + boost));
    meshRef.current.scale.setScalar(base * (0.92 + 0.14 * pulse + 0.4 * boost * pulse));
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = (mine ? 1.6 : 1.2) + 1.2 * pulse + 2.4 * boost * pulse;
  });

  return (
    <group position={pos} rotation={rot}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(star);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.6} />
      </mesh>
      {/* 最新一颗自己的星常驻小标签（多了会满屏都是，只标最新） */}
      {mine && labeled && (
        <Html position={[0, 6.5, 0]} center distanceFactor={210}>
          <span className="pointer-events-none whitespace-nowrap rounded-full border border-sky-300/30 bg-slate-950/70 px-2 py-0.5 text-[10px] font-medium tracking-wide text-sky-200 backdrop-blur">
            ✦ {t("lab.yourStar")}
          </span>
        </Html>
      )}
    </group>
  );
}

function StarBelt({
  stars,
  highlight,
  onOpen,
}: {
  stars: StarItem[];
  highlight: number;
  onOpen: (s: StarItem) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const normal = useMemo(() => stars.filter((s) => !s.mine && !s.featured), [stars]);
  const special = useMemo(() => stars.filter((s) => s.mine || s.featured), [stars]);
  const newestMineId = useMemo(
    () => special.reduce((m, s) => (s.mine && s.id > m ? s.id : m), 0),
    [special],
  );
  const count = normal.length;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useMemo(() => {
    if (!meshRef.current || !count) return;
    normal.forEach((s, i) => {
      const { pos, scale, rot } = starTransform(s);
      dummy.position.set(...pos);
      dummy.scale.setScalar(scale);
      dummy.rotation.set(...rot);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true;
  }, [normal, dummy, count]);

  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.2 + 0.5 * Math.sin(state.clock.elapsedTime * 2);
    }
  });

  return (
    <group ref={groupRef}>
      {count > 0 && (
        <instancedMesh
          ref={meshRef}
          args={[undefined, undefined, count]}
          onClick={(e) => {
            const id = e.instanceId;
            if (id != null && normal[id]) {
              e.stopPropagation();
              onOpen(normal[id]);
            }
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "auto")}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#ffe9a8" emissive="#ffc95e" emissiveIntensity={1.4} />
        </instancedMesh>
      )}
      {special.map((s) => (
        <SpecialStar
          key={s.id}
          star={s}
          highlight={highlight}
          labeled={s.id === newestMineId}
          onOpen={onOpen}
        />
      ))}
    </group>
  );
}

/* ============ 场景主体 ============ */
export default function LabScene({
  moments,
  stars,
  counts,
  highlight = 0,
  festivalTint,
}: {
  moments: MomentItem[];
  stars: StarItem[];
  counts: PlanetCounts;
  /** 毫秒时间戳：留星成功 / 点「找到我的星」时更新，自己的星强高亮 6 秒 */
  highlight?: number;
  /** 节日当天太阳的偏色（festivals.ts 的 festivalTintOf 算好传入），非节日 undefined */
  festivalTint?: string;
}) {
  const router = useRouter();
  const [bursts, setBursts] = useState<number[]>([]);
  const [openStar, setOpenStar] = useState<StarItem | null>(null);
  const [memoryIdx, setMemoryIdx] = useState<number | null>(null);
  const t = useT();

  /* 太阳连点合并上报：600ms 内的点击攒成一次 { count }。
     逐点上报的话，快速连点会产生并行的 read-modify-write，交错覆盖会丢计数。 */
  const sunPending = useRef(0);
  const sunTimer = useRef<number | null>(null);
  const flushSun = () => {
    if (sunTimer.current != null) {
      clearTimeout(sunTimer.current);
      sunTimer.current = null;
    }
    if (sunPending.current > 0) {
      trackEvent("poke_sun", { count: sunPending.current });
      sunPending.current = 0;
    }
  };
  const pokeSun = () => {
    sunPending.current += 1;
    if (sunTimer.current == null) sunTimer.current = window.setTimeout(flushSun, 600);
  };
  useEffect(() => flushSun, []); // 卸载时把尾巴冲掉

  const openPlanet = (def: PlanetDef) => {
    trackEvent("visit_planet", { planetId: def.id });
    if (def.id === "mars") {
      setMemoryIdx(moments.length ? 0 : null);
      return;
    }
    const href = def.href as string | null;
    if (!href) return;
    if (href.startsWith("http")) window.open(href, "_blank");
    else router.push(href);
  };

  const countOf = (id: string): number | undefined =>
    id === "mercury" ? counts.notes : id === "earth" ? counts.posts : id === "uranus" ? counts.sound : undefined;

  const moment = memoryIdx != null ? moments[memoryIdx] : null;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 250, 620], fov: 42, near: 1, far: 4000 }}
      gl={{ antialias: true, alpha: true }}
    >
      {/* 深空：星云背景球 + 三层星点 */}
      <DeepSpace />

      {/* 恒星是唯一光源。
          decay 远小于真实的 2：按 1/d² 衰减的话，海王星收到的光只有水星的 1/6000，
          外圈会糊成一团黑。0.35 保留了"越远越暗"的观感，又不至于看不见。 */}
      <pointLight position={[0, 0, 0]} intensity={22} decay={0.35} color="#fff3dc" />
      {/* 极弱环境光 = 星光与行星际背景辐射，只用来勾出夜半球的轮廓，
          给太高会把晨昏线冲平 —— 昼夜就白做了 */}
      <ambientLight intensity={0.05} color="#93a9ff" />

      {/* 恒星 + 点击爆发（节日当天 tint 偏色） */}
      <Sun
        onClick={() => {
          pokeSun();
          setBursts((b) => [...b, Date.now()]);
        }}
        tint={festivalTint}
      />
      {bursts.map((id) => (
        <Burst key={id} onDone={() => setBursts((b) => b.filter((x) => x !== id))} />
      ))}

      {/* 轨道线 + 标签 */}
      {PLANETS.map((def) => (
        <group key={def.id}>
          <OrbitRing radius={def.orbit} incl={def.incl} tone={def.tone} />
          <PlanetLabel def={def} count={countOf(def.id)} onClick={() => openPlanet(def)} />
        </group>
      ))}

      {/* 八颗真实行星：NASA 贴图 + 昼夜晨昏线 + 夜面城市灯光 + 大气边缘光 + 环 */}
      <Suspense fallback={null}>
        <RealisticSystem onOpen={openPlanet} />
      </Suspense>

      {/* 小行星带：留声星 */}
      <StarBelt
        stars={stars}
        highlight={highlight}
        onOpen={(s) => {
          setOpenStar(s);
          trackEvent("view_star");
        }}
      />

      {/* 场景内不放任何标题/说明（宇宙中只有宇宙），文字在页面 header 里 */}

      {/* 留声星弹卡 */}
      {openStar && (
        <Html position={[0, 78, 0]} center distanceFactor={170}>
          <div className="w-64 rounded-2xl border border-amber-200/30 bg-slate-900/85 p-4 text-white shadow-2xl backdrop-blur">
            <div className="mb-1 flex items-center justify-between text-xs text-amber-200/70">
              <span className="flex min-w-0 items-center gap-1.5">
                {openStar.mine && (
                  <span className="shrink-0 rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] text-sky-200">
                    {t("lab.yourStar")}
                  </span>
                )}
                {openStar.featured && (
                  <span className="shrink-0 rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] text-amber-200">
                    ✦ {t("lab.featuredStar")}
                  </span>
                )}
                <span className="truncate">{t("lab.memoryStar", { date: openStar.date })}</span>
              </span>
              <button onClick={() => setOpenStar(null)} className="shrink-0 rounded-full px-2 hover:text-white">
                ✕
              </button>
            </div>
            <p className="text-sm leading-relaxed">{openStar.content}</p>
          </div>
        </Html>
      )}

      {/* 回忆行星弹卡（可翻阅） */}
      {moment && (
        <Html position={[0, 78, 0]} center distanceFactor={170}>
          <div className="w-72 rounded-2xl border border-white/20 bg-slate-900/85 p-4 text-white shadow-2xl backdrop-blur">
            <div className="mb-1 flex items-center justify-between text-xs text-white/50">
              <span>
                {moment.mood || "💭"} {moment.date} · {t("lab.memoryBottle", { n: (memoryIdx ?? 0) + 1, m: moments.length })}
              </span>
              <button onClick={() => setMemoryIdx(null)} className="rounded-full px-2 hover:text-white">
                ✕
              </button>
            </div>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
              {moment.content}
            </p>
            <div className="mt-2 flex justify-between">
              <button
                onClick={() => setMemoryIdx((i) => (i == null ? null : (i - 1 + moments.length) % moments.length))}
                className="rounded-lg bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
              >
                {t("lab.prevMemory")}
              </button>
              <button
                onClick={() => setMemoryIdx((i) => (i == null ? null : (i + 1) % moments.length))}
                className="rounded-lg bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
              >
                {t("lab.nextMemory")}
              </button>
            </div>
          </div>
        </Html>
      )}

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={60}
        maxDistance={1200}
        maxPolarAngle={Math.PI * 0.62}
      />
    </Canvas>
  );
}
