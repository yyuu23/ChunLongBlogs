"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { usePlayer } from "@/components/music/PlayerProvider";
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
            title={`${def.name} · ${tone.label}${count != null ? ` · ${count} 条` : ""}`}
          >
            <span className="whitespace-nowrap text-sm font-bold tracking-wide drop-shadow">
              {def.label}
            </span>
            <span className="whitespace-nowrap text-[9px] tracking-widest text-white/45">
              {def.name} · {ROMAN[def.order]}
            </span>
            <span className="mt-0.5 hidden text-[9px] text-white/60 group-hover:block">
              {count != null ? `${count} 条` : def.href ? "前往 →" : "点击查看"}
            </span>
          </button>
        </Html>
      </group>
    </group>
  );
}

/** 轨道线（受音乐律动微微起伏） */
function OrbitRing({
  radius,
  incl,
  tone,
  playing,
}: {
  radius: number;
  incl: number;
  tone: ToneKey;
  playing: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const wob = playing ? 1 + 0.012 * Math.sin(t * Math.PI * 3.6) : 1;
    ref.current.scale.set(wob, 1, wob);
  });
  return (
    <group rotation={[THREE.MathUtils.degToRad(incl), 0, 0]}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
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

/* ============ 恒星（音乐律动的全局氛围层核心） ============ */
function Sun({ onClick }: { onClick: () => void }) {
  const core = useRef<THREE.Mesh>(null);
  const { playing } = usePlayer() ?? {};

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = playing
      ? 0.045 * Math.sin(t * Math.PI * 3.6) + 0.025 * Math.sin(t * Math.PI * 1.8 + 1.3)
      : 0.015 * Math.sin(t * Math.PI * 0.5);
    if (core.current) core.current.scale.setScalar(1 + pulse);
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
        {/* 程序化米粒组织 + 边缘变暗 */}
        <SunMaterial />
        {/* 日冕：两层加性光晕。自带发光，不参与昼夜受光，所以 sunLit=false */}
        <Atmosphere radius={18 * 1.38} color="#ffb45a" intensity={1.0} power={2.2} sunLit={false} />
        <Atmosphere radius={18 * 2.6} color="#ff8a3d" intensity={0.34} power={3.0} sunLit={false} />
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
function StarBelt({ stars, onOpen }: { stars: StarItem[]; onOpen: (s: StarItem) => void }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const count = stars.length;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useMemo(() => {
    if (!meshRef.current || !count) return;
    stars.forEach((s, i) => {
      const a = hash01(s.id, 1) * Math.PI * 2;
      const r = BELT.inner + hash01(s.id, 3) * (BELT.outer - BELT.inner);
      const y = (hash01(s.id, 2) - 0.5) * BELT.spread;
      dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      dummy.scale.setScalar(1.3 + hash01(s.id, 4) * 1.1);
      dummy.rotation.set(hash01(s.id, 5) * Math.PI, hash01(s.id, 6) * Math.PI, 0);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true;
  }, [stars, dummy, count]);

  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.2 + 0.5 * Math.sin(state.clock.elapsedTime * 2);
    }
  });

  if (!count) return null;

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        onClick={(e) => {
          const id = e.instanceId;
          if (id != null && stars[id]) {
            e.stopPropagation();
            onOpen(stars[id]);
          }
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffe9a8" emissive="#ffc95e" emissiveIntensity={1.4} />
      </instancedMesh>
    </group>
  );
}

/* ============ 场景主体 ============ */
export default function LabScene({
  moments,
  stars,
  counts,
}: {
  moments: MomentItem[];
  stars: StarItem[];
  counts: PlanetCounts;
}) {
  const router = useRouter();
  const [bursts, setBursts] = useState<number[]>([]);
  const [openStar, setOpenStar] = useState<StarItem | null>(null);
  const [memoryIdx, setMemoryIdx] = useState<number | null>(null);
  const { playing } = usePlayer() ?? {};

  const openPlanet = (def: PlanetDef) => {
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

      {/* 恒星 + 点击爆发 */}
      <Sun onClick={() => setBursts((b) => [...b, Date.now()])} />
      {bursts.map((id) => (
        <Burst key={id} onDone={() => setBursts((b) => b.filter((x) => x !== id))} />
      ))}

      {/* 轨道线 + 标签 */}
      {PLANETS.map((def) => (
        <group key={def.id}>
          <OrbitRing radius={def.orbit} incl={def.incl} tone={def.tone} playing={!!playing} />
          <PlanetLabel def={def} count={countOf(def.id)} onClick={() => openPlanet(def)} />
        </group>
      ))}

      {/* 八颗真实行星：NASA 贴图 + 昼夜晨昏线 + 夜面城市灯光 + 大气边缘光 + 环 */}
      <Suspense fallback={null}>
        <RealisticSystem onOpen={openPlanet} />
      </Suspense>

      {/* 小行星带：留声星 */}
      <StarBelt stars={stars} onOpen={setOpenStar} />

      {/* 标题 */}
      <Html position={[0, 108, 0]} center distanceFactor={230}>
        <div style={{ pointerEvents: "none", textAlign: "center", userSelect: "none" }}>
          <p className="font-serif text-3xl font-black tracking-[0.3em] text-white drop-shadow-lg">
            CHUNLONG LAB
          </p>
          <p className="mt-1 text-xs tracking-[0.25em] text-white/50">
            八颗行星 · 越近越私人 · 转得越快更新越勤
          </p>
        </div>
      </Html>

      {/* 留声星弹卡 */}
      {openStar && (
        <Html position={[0, 78, 0]} center distanceFactor={170}>
          <div className="w-64 rounded-2xl border border-amber-200/30 bg-slate-900/85 p-4 text-white shadow-2xl backdrop-blur">
            <div className="mb-1 flex items-center justify-between text-xs text-amber-200/70">
              <span>✦ 留声星 · {openStar.date}</span>
              <button onClick={() => setOpenStar(null)} className="rounded-full px-2 hover:text-white">
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
                {moment.mood || "💭"} {moment.date} · 回忆瓶 {(memoryIdx ?? 0) + 1}/{moments.length}
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
                ‹ 上一段
              </button>
              <button
                onClick={() => setMemoryIdx((i) => (i == null ? null : (i + 1) % moments.length))}
                className="rounded-lg bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
              >
                下一段 ›
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
