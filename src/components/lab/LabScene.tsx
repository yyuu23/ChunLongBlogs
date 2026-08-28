"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";

/** 从 CSS 变量读取当前主题色 */
function useAccentColors() {
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const from = new THREE.Color(style.getPropertyValue("--accent-from").trim() || "#6366f1");
    const to = new THREE.Color(style.getPropertyValue("--accent-to").trim() || "#a855f7");
    return { from, to };
  }, []);
}

/** 自定义 shader 闪烁光点（aPhase + uTime） */
function BlinkingPoints({ count = 320 }: { count?: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { from, to } = useAccentColors();

  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const pha = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // 均匀分布在半径 6~15 的球壳里
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
    () => ({
      uTime: { value: 0 },
      uColorA: { value: from },
      uColorB: { value: to },
    }),
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

/** 点击晶体触发的粒子爆发 */
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
    const posAttr = pointsRef.current?.geometry.attributes
      .position as THREE.BufferAttribute | undefined;
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

/** 中央晶体：扭曲发光球 + 线框外壳 */
function Crystal({ onClick }: { onClick: () => void }) {
  const shellRef = useRef<THREE.Mesh>(null);
  const { from, to } = useAccentColors();

  useFrame((_, delta) => {
    if (shellRef.current) {
      shellRef.current.rotation.y += delta * 0.15;
      shellRef.current.rotation.x += delta * 0.05;
    }
  });

  return (
    <group>
      <Float speed={1.6} rotationIntensity={0.5} floatIntensity={1.1}>
        <mesh onClick={onClick} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "auto")}>
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

export default function LabScene() {
  const [bursts, setBursts] = useState<number[]>([]);
  const [score, setScore] = useState(0);

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
      <Crystal
        onClick={() => {
          setBursts((b) => [...b, Date.now()]);
          setScore((s) => s + 1);
        }}
      />
      {bursts.map((id) => (
        <Burst key={id} onDone={() => setBursts((b) => b.filter((x) => x !== id))} />
      ))}
      <Html position={[0, 3.1, 0]} center distanceFactor={11}>
        <div style={{ pointerEvents: "none", textAlign: "center", userSelect: "none" }}>
          <p className="font-serif text-2xl font-black tracking-widest text-white drop-shadow-lg">
            CHUNLONG LAB
          </p>
          <p className="mt-1 text-xs tracking-widest text-white/60">点击晶体 · 拖拽星海</p>
        </div>
      </Html>
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
