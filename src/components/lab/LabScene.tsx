"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import { usePlayer } from "@/components/music/PlayerProvider";

export interface MomentItem {
  id: number;
  content: string;
  mood: string;
  date: string;
}

export interface StarItem {
  id: number;
  content: string;
  date: string;
}

export interface PlanetCounts {
  notes: number;
  posts: number;
  sound: number;
}

/* ============ 行星配置（按《行星体系设计说明》v1）============
 * 轨道半径 = 内容亲疏温度（内=私人高频，外=沉淀元信息）
 * 公转周期 = 更新频率（周更最快 → 年更最慢） */
const PLANETS_BASE = [
  { id: "notes", label: "随笔", sub: "正在想的", href: "/moments", orbit: 62, r: 9, tone: "warm", period: 20, phase: 0.1 },
  { id: "memory", label: "回忆", sub: "回忆瓶", href: null, orbit: 92, r: 10, tone: "warm", period: 30, phase: 1.4 },
  { id: "posts", label: "文章", sub: "", href: "/posts", orbit: 122, r: 11, tone: "neutral", period: 38, phase: 2.9 },
  // 小行星带 141-163：访客留声星
  { id: "sound", label: "声音", sub: "留声屋", href: "/music", orbit: 192, r: 13, tone: "cool", period: 46, phase: 4.2 },
  { id: "works", label: "项目", sub: "作品集", href: "https://github.com/yyuu23", orbit: 222, r: 14, tone: "cool", period: 52, phase: 5.5 },
  { id: "about", label: "关于", sub: "时间线", href: "/about", orbit: 252, r: 10, tone: "cold", period: 60, phase: 0.8, ring: true },
] as const;

type PlanetDef = (typeof PLANETS_BASE)[number] & { ring?: boolean };
const PLANETS: PlanetDef[] = PLANETS_BASE.map((p) => ({ ...p }));

type ToneKey = (typeof PLANETS)[number]["tone"];
const TONE: Record<ToneKey, { fill: string; glow: string; label: string }> = {
  warm: { fill: "#BA7517", glow: "#FAC775", label: "暖 · 高频 · 个人" },
  neutral: { fill: "#378ADD", glow: "#85B7EB", label: "中性 · 主力产出" },
  cool: { fill: "#534AB7", glow: "#AFA9EC", label: "冷 · 沉淀 · 专业" },
  cold: { fill: "#5F5E5A", glow: "#B4B2A9", label: "最冷 · 元信息" },
};

/** 确定性伪随机 */
function hash01(seed: number, salt: number) {
  const x = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ============ 行星 ============ */
function Planet({
  def,
  count,
  onClick,
}: {
  def: (typeof PLANETS)[number];
  count?: number;
  onClick: () => void;
}) {
  const orbitGroup = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const tone = TONE[def.tone];
  const isGas = def.id === "sound" || def.id === "works";

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (orbitGroup.current) {
      orbitGroup.current.rotation.y = (t * Math.PI * 2) / def.period + def.phase;
    }
    if (body.current) body.current.rotation.y = t * 0.4;
  });

  return (
    <group ref={orbitGroup}>
      <mesh
        ref={body}
        position={[def.orbit, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <sphereGeometry args={[def.r, 32, 32]} />
        <meshStandardMaterial
          color={tone.fill}
          emissive={tone.glow}
          emissiveIntensity={0.25}
          roughness={isGas ? 0.45 : 0.9}
          metalness={isGas ? 0.25 : 0.05}
        />
        {/* 气态巨行星：横向条纹 */}
        {isGas &&
          [1.25, 1.5].map((k, i) => (
            <mesh key={i} scale={[1, 0.06, 1]}>
              <torusGeometry args={[def.r * k, def.r * 0.16, 8, 48]} />
              <meshBasicMaterial color={tone.glow} transparent opacity={0.28} />
            </mesh>
          ))}
        {/* 带环行星（关于）：视觉句号 */}
        {def.ring && (
          <mesh rotation={[Math.PI / 2.4, 0, 0.3]}>
            <torusGeometry args={[def.r * 1.75, def.r * 0.22, 2, 64]} />
            <meshBasicMaterial color={tone.glow} transparent opacity={0.45} side={THREE.DoubleSide} />
          </mesh>
        )}
      </mesh>

      {/* 标签：跟随行星公转；hover 才显示数量 */}
      <Html position={[def.orbit, def.r + 7, 0]} center distanceFactor={150}>
        <button
          onClick={onClick}
          className="group flex cursor-pointer flex-col items-center border-0 bg-transparent p-0 text-white"
          style={{ pointerEvents: "auto" }}
          title={`${tone.label}${count != null ? ` · ${count} 条` : ""}`}
        >
          <span className="whitespace-nowrap text-sm font-bold tracking-wide drop-shadow">
            {def.label}
          </span>
          {def.sub && (
            <span className="whitespace-nowrap text-[9px] tracking-widest text-white/45">{def.sub}</span>
          )}
          <span className="mt-0.5 hidden text-[9px] text-white/60 group-hover:block">
            {count != null ? `${count} 条` : "前往 →"}
          </span>
        </button>
      </Html>
    </group>
  );
}

/** 轨道线（受音乐律动微微起伏） */
function OrbitRing({ radius, tone, playing }: { radius: number; tone: ToneKey; playing: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const wob = playing ? 1 + 0.012 * Math.sin(t * Math.PI * 3.6) : 1;
    ref.current.scale.set(wob, 1, wob);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.5, radius + 0.5, 160]} />
      <meshBasicMaterial
        color={TONE[tone].glow}
        transparent
        opacity={0.16}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ============ 恒星（音乐律动的全局氛围层核心） ============ */
function Sun({ onClick }: { onClick: () => void }) {
  const core = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const { playing } = usePlayer() ?? {};

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (core.current && matRef.current) {
      const pulse = playing
        ? 0.045 * Math.sin(t * Math.PI * 3.6) + 0.025 * Math.sin(t * Math.PI * 1.8 + 1.3)
        : 0.015 * Math.sin(t * Math.PI * 0.5);
      core.current.scale.setScalar(1 + pulse);
      matRef.current.emissiveIntensity = playing
        ? 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 1.8))
        : 0.45 + 0.1 * Math.sin(t);
    }
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
        <sphereGeometry args={[18, 48, 48]} />
        <MeshDistortMaterial
          color="#fbbf24"
          emissive="#f97316"
          emissiveIntensity={0.5}
          roughness={0.4}
          distort={0.22}
          speed={2.6}
        />
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

/* ============ 小行星带 = 访客留声星（141-163 环带） ============ */
function StarBelt({ stars, onOpen }: { stars: StarItem[]; onOpen: (s: StarItem) => void }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const count = stars.length;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useMemo(() => {
    if (!meshRef.current || !count) return;
    stars.forEach((s, i) => {
      const a = hash01(s.id, 1) * Math.PI * 2;
      const r = 141 + hash01(s.id, 3) * 22;
      const y = (hash01(s.id, 2) - 0.5) * 8;
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

  const openPlanet = (def: (typeof PLANETS)[number]) => {
    if (def.id === "memory") {
      setMemoryIdx(moments.length ? 0 : null);
      return;
    }
    const href = def.href as string | null;
    if (!href) return;
    if (href.startsWith("http")) window.open(href, "_blank");
    else router.push(href);
  };

  const countOf = (id: string): number | undefined =>
    id === "notes" ? counts.notes : id === "posts" ? counts.posts : id === "sound" ? counts.sound : undefined;

  const moment = memoryIdx != null ? moments[memoryIdx] : null;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 170, 430], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 0, 0]} intensity={900} distance={800} color="#ffd9a0" />

      <Stars radius={600} depth={120} count={2600} factor={8} saturation={0.35} fade speed={0.5} />

      {/* 恒星 + 点击爆发 */}
      <Sun onClick={() => setBursts((b) => [...b, Date.now()])} />
      {bursts.map((id) => (
        <Burst key={id} onDone={() => setBursts((b) => b.filter((x) => x !== id))} />
      ))}

      {/* 行星 + 轨道 */}
      {PLANETS.map((def) => (
        <group key={def.id}>
          <OrbitRing radius={def.orbit} tone={def.tone} playing={!!playing} />
          <Planet def={def} count={countOf(def.id)} onClick={() => openPlanet(def)} />
        </group>
      ))}

      {/* 小行星带：留声星 */}
      <StarBelt stars={stars} onOpen={setOpenStar} />

      {/* 标题 */}
      <Html position={[0, 58, 0]} center distanceFactor={170}>
        <div style={{ pointerEvents: "none", textAlign: "center", userSelect: "none" }}>
          <p className="font-serif text-3xl font-black tracking-[0.3em] text-white drop-shadow-lg">
            CHUNLONG LAB
          </p>
          <p className="mt-1 text-xs tracking-[0.25em] text-white/50">
            行星即内容 · 越近越私人 · 转得越快更新越勤
          </p>
        </div>
      </Html>

      {/* 留声星弹卡 */}
      {openStar && (
        <Html position={[0, 44, 0]} center distanceFactor={150}>
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
        <Html position={[0, 44, 0]} center distanceFactor={150}>
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
        minDistance={140}
        maxDistance={760}
        maxPolarAngle={Math.PI * 0.62}
      />
    </Canvas>
  );
}
