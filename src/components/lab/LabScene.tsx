"use client";

import { useMemo, useRef, useState } from "react";
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

/** 从 CSS 变量读取当前主题色 */
function useAccentColors() {
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const from = new THREE.Color(style.getPropertyValue("--accent-from").trim() || "#6366f1");
    const to = new THREE.Color(style.getPropertyValue("--accent-to").trim() || "#a855f7");
    return { from, to };
  }, []);
}

/** 星星/瓶子的确定性伪随机（同一 id 永远同一位置） */
function hash01(seed: number, salt: number) {
  const x = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ============ 自定义 shader 闪烁光点 ============ */
function BlinkingPoints({ count = 320 }: { count?: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { from, to } = useAccentColors();

  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const pha = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      pha[i] = Math.random();
    }
    return { pos, pha };
  }, [count]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColorA: { value: from }, uColorB: { value: to } }),
    [from, to],
  );

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geo.pos, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[geo.pha, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          attribute float aPhase;
          uniform float uTime;
          varying float vA;
          void main() {
            vA = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 1.6 + aPhase * 6.28318));
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (2.0 + 2.5 * vA) * (280.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          varying float vA;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            if (d > 0.5) discard;
            float alpha = smoothstep(0.5, 0.05, d) * vA;
            gl_FragColor = vec4(mix(uColorA, uColorB, vA), alpha);
          }
        `}
      />
    </points>
  );
}

/* ============ 点击晶体触发的粒子爆发 ============ */
function Burst({ onDone }: { onDone: () => void }) {
  const count = 140;
  const matRef = useRef<THREE.PointsMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const start = useRef<number | null>(null);
  const { from, to } = useAccentColors();

  const burstGeo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const d = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 2.5 + Math.random() * 3.5;
      d[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      d[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      d[i * 3 + 2] = Math.cos(phi) * speed;
    }
    return { pos, d };
  }, []);

  useFrame((state) => {
    if (start.current === null) start.current = state.clock.elapsedTime;
    const t = (state.clock.elapsedTime - start.current) / 1.2;
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
      <pointsMaterial
        ref={matRef}
        size={0.12}
        color={from.clone().lerp(to, 0.5)}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ============ 中央晶体：音乐律动 ============ */
function Crystal({ onClick }: { onClick: () => void }) {
  const shellRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const { from, to } = useAccentColors();
  const player = usePlayer();
  const playing = player?.playing ?? false;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (shellRef.current) {
      shellRef.current.rotation.y += delta * 0.15;
      shellRef.current.rotation.x += delta * 0.05;
    }
    if (coreRef.current && matRef.current) {
      // 播放中：多层正弦伪节拍脉冲；暂停：慢呼吸
      const pulse = playing
        ? 0.05 * Math.sin(t * Math.PI * 3.6) +
          0.03 * Math.sin(t * Math.PI * 1.8 + 1.3) +
          0.02 * Math.sin(t * Math.PI * 7.2 + 0.5)
        : 0.02 * Math.sin(t * Math.PI * 0.5);
      coreRef.current.scale.setScalar(1 + pulse);
      matRef.current.emissiveIntensity = playing
        ? 0.35 + 0.4 * Math.abs(Math.sin(t * Math.PI * 1.8))
        : 0.3 + 0.08 * Math.sin(t);
    }
  });

  return (
    <group>
      <Float speed={1.6} rotationIntensity={0.5} floatIntensity={1.1}>
        <mesh
          ref={coreRef}
          onClick={onClick}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "auto")}
        >
          <sphereGeometry args={[1.7, 64, 64]} />
          <MeshDistortMaterial
            color={to}
            emissive={from}
            emissiveIntensity={0.35}
            roughness={0.12}
            metalness={0.55}
            distort={0.38}
            speed={2.2}
          />
        </mesh>
      </Float>
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[2.9, 1]} />
        <meshBasicMaterial color={from} wireframe transparent opacity={0.14} />
      </mesh>
    </group>
  );
}

/* ============ 回忆瓶书架：每只瓶子装一条说说 ============ */
function GlassBottle({
  moment,
  position,
  onOpen,
}: {
  moment: MomentItem;
  position: [number, number, number];
  onOpen: (m: MomentItem) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { from } = useAccentColors();

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.3 + moment.id;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(moment);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <mesh>
        <cylinderGeometry args={[0.22, 0.26, 0.72, 12]} />
        <meshPhysicalMaterial
          color={from}
          transparent
          opacity={0.45}
          roughness={0.05}
          transmission={0.6}
          thickness={0.5}
        />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.09, 0.16, 0.28, 10]} />
        <meshPhysicalMaterial color={from} transparent opacity={0.5} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.1, 10]} />
        <meshStandardMaterial color="#8a6d4f" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ffd27d" />
      </mesh>
    </group>
  );
}

function BottleShelf({ moments, onOpen }: { moments: MomentItem[]; onOpen: (m: MomentItem) => void }) {
  const { from } = useAccentColors();
  const n = moments.length;
  if (!n) return null;
  const perRow = Math.min(n, 5);
  const startX = -(perRow - 1) * 0.525;
  const shelfWidth = perRow * 1.05 + 0.4;

  return (
    <group position={[-3.6, 2.4, -1.6]} rotation={[0, 0.55, 0]}>
      {/* 隔板 */}
      {n <= 5 ? (
        <mesh>
          <boxGeometry args={[shelfWidth, 0.08, 0.7]} />
          <meshStandardMaterial color="#6b5138" roughness={0.85} />
        </mesh>
      ) : (
        <>
          <mesh>
            <boxGeometry args={[shelfWidth, 0.08, 0.7]} />
            <meshStandardMaterial color="#6b5138" roughness={0.85} />
          </mesh>
          <mesh position={[0, -1.15, 0]}>
            <boxGeometry args={[shelfWidth, 0.08, 0.7]} />
            <meshStandardMaterial color="#6b5138" roughness={0.85} />
          </mesh>
        </>
      )}
      {/* 瓶子 */}
      {moments.slice(0, 8).map((m, i) => {
        const row = i < 5 ? 0 : 1;
        const col = row === 0 ? i : i - 5;
        const rowLen = row === 0 ? Math.min(n, 5) : Math.min(n - 5, 3);
        const rowStart = -(Math.min(rowLen, 5) - 1) * 0.525;
        return (
          <GlassBottle
            key={m.id}
            moment={m}
            position={[rowStart + col * 1.05, row === 0 ? 0.44 : -0.71, 0]}
            onOpen={onOpen}
          />
        );
      })}
      <pointLight position={[0, 0.6, 1]} intensity={6} distance={6} color={from} />
    </group>
  );
}

/* ============ 留声星：访客的话化作永久的星 ============ */
function StarField({ stars, onOpen }: { stars: StarItem[]; onOpen: (s: StarItem) => void }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = stars.length;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useMemo(() => {
    if (!meshRef.current || !count) return;
    stars.forEach((s, i) => {
      const a = hash01(s.id, 1) * Math.PI * 2;
      const b = Math.acos(2 * hash01(s.id, 2) - 1);
      const r = 7.5 + hash01(s.id, 3) * 6;
      dummy.position.set(
        r * Math.sin(b) * Math.cos(a),
        r * Math.cos(b) * 0.7 + 1.5,
        r * Math.sin(b) * Math.sin(a),
      );
      dummy.scale.setScalar(0.09 + hash01(s.id, 4) * 0.08);
      dummy.rotation.set(hash01(s.id, 5) * Math.PI, hash01(s.id, 6) * Math.PI, 0);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true;
  }, [stars, dummy, count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.2 + 0.5 * Math.sin(state.clock.elapsedTime * 2);
  });

  if (!count) return null;

  return (
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
  );
}

/* ============ 场景主体 ============ */
export default function LabScene({
  moments,
  stars,
}: {
  moments: MomentItem[];
  stars: StarItem[];
}) {
  const [bursts, setBursts] = useState<number[]>([]);
  const [openMoment, setOpenMoment] = useState<MomentItem | null>(null);
  const [openStar, setOpenStar] = useState<StarItem | null>(null);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.2, 9.5], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[6, 6, 6]} intensity={60} color="#ffffff" />
      <pointLight position={[-6, -4, -6]} intensity={30} color="#7c6cf5" />
      <Stars radius={90} depth={40} count={2200} factor={3.6} saturation={0.4} fade speed={0.6} />
      <BlinkingPoints />
      <Crystal onClick={() => setBursts((b) => [...b, Date.now()])} />
      {bursts.map((id) => (
        <Burst key={id} onDone={() => setBursts((b) => b.filter((x) => x !== id))} />
      ))}
      <BottleShelf moments={moments} onOpen={setOpenMoment} />
      <StarField stars={stars} onOpen={setOpenStar} />

      <Html position={[0, 3.1, 0]} center distanceFactor={11}>
        <div style={{ pointerEvents: "none", textAlign: "center", userSelect: "none" }}>
          <p className="font-serif text-2xl font-black tracking-widest text-white drop-shadow-lg">
            CHUNLONG LAB
          </p>
          <p className="mt-1 text-xs tracking-widest text-white/60">点晶体爆星屑 · 点瓶子看回忆 · 点金星读心愿</p>
        </div>
      </Html>

      {openMoment && (
        <Html position={[0, 1.2, 4]} center distanceFactor={10}>
          <div className="w-64 rounded-2xl border border-white/20 bg-slate-900/85 p-4 text-white shadow-2xl backdrop-blur">
            <div className="mb-1 flex items-center justify-between text-xs text-white/50">
              <span>
                {openMoment.mood || "💭"} {openMoment.date}
              </span>
              <button onClick={() => setOpenMoment(null)} className="rounded-full px-2 hover:text-white">
                ✕
              </button>
            </div>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
              {openMoment.content}
            </p>
          </div>
        </Html>
      )}

      {openStar && (
        <Html position={[0, 1.2, 4]} center distanceFactor={10}>
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

      <OrbitControls
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.7}
        enableDamping
        dampingFactor={0.08}
        minDistance={4.5}
        maxDistance={22}
      />
    </Canvas>
  );
}
