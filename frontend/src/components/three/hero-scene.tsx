'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';

/** Curriculum tower: layers = course → modules → lessons; orbiting nodes = learners moving through it. */
const LAYERS = [
  { y: 0, w: 3.2, color: '#24507a' },
  { y: 0.62, w: 2.7, color: '#356b9c' },
  { y: 1.24, w: 2.2, color: '#0b6b6a' },
  { y: 1.86, w: 1.7, color: '#f2a900' },
] as const;

function Tower() {
  const ring = useRef<Group>(null);
  const nodes = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        angle: (i / 6) * Math.PI * 2,
        y: 0.15 + (i % 3) * 0.7,
      })),
    [],
  );
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.y += dt * 0.5;
  });
  return (
    <group position={[0, -1.1, 0]}>
      {LAYERS.map((l) => (
        <RoundedBox
          key={l.y}
          args={[l.w, 0.46, l.w]}
          radius={0.12}
          smoothness={3}
          position={[0, l.y, 0]}
        >
          <meshStandardMaterial color={l.color} roughness={0.55} metalness={0.05} />
        </RoundedBox>
      ))}
      <group ref={ring}>
        {nodes.map((n, i) => (
          <mesh key={i} position={[Math.cos(n.angle) * 2.5, n.y + 0.25, Math.sin(n.angle) * 2.5]}>
            <sphereGeometry args={[0.15, 20, 20]} />
            <meshStandardMaterial color={i % 2 ? '#ffffff' : '#f2a900'} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * `active` = visible on screen, tab in foreground, and motion allowed. When inactive the loop stops
 * ("demand": a frame is only drawn when the user drags), so an idle scene costs no GPU time.
 */
export default function HeroScene({ active }: { active: boolean }) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'demand'}
      dpr={[1, 1.75]}
      camera={{ position: [4.6, 2.6, 5.4], fov: 38 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      aria-hidden
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 3]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#c9d9e8" />
      <Tower />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={active}
        autoRotateSpeed={0.8}
        minPolarAngle={Math.PI / 3.4}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
