"use client"

import React, { useRef, useMemo } from "react";

/// <reference path="../types/react-three-shims.d.ts" />
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";

// File-local JSX augmentation for Three primitives (keeps changes minimal).
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      group: any;
      sphereGeometry: any;
      planeGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      ambientLight: any;
      directionalLight: any;
      bufferGeometry: any;
      bufferAttribute: any;
      points: any;
  color: any;
    }
  }
}

function latLonToCartesian(lat: number, lon: number, radius = 1) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z] as [number, number, number];
}

function Marker({ position, label, onClick }: { position: [number, number, number]; label?: string; onClick?: () => void }) {
  return (
    <mesh position={position as any} onClick={onClick}>
      <sphereGeometry args={[0.01, 8, 8]} />
      <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.6} />
      {label && (
        <Html distanceFactor={10} position={[0, 0.03, 0]}>
          <div className="bg-background/90 px-2 py-1 rounded text-xs border border-foreground/10">{label}</div>
        </Html>
      )}
    </mesh>
  );
}

export default function MarketplaceGlobe({ nodes = [], selectNode, fullscreen = false }: { nodes?: any[]; selectNode?: (id: number) => void; fullscreen?: boolean }) {
  const earthTexture = useTexture("/earth-view-from-space.jpg");
  const groupRef = useRef<any>(null);

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.0008;
  });

  return (
    <div className={`${fullscreen ? 'absolute inset-0 h-screen w-screen' : 'h-[600px] w-full'} rounded-lg overflow-hidden border border-foreground/10`}>
      <Canvas style={{ width: '100%', height: '100%' }} camera={{ position: [0, 0, 2.6], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 3, 5]} intensity={0.6} />

        <group ref={groupRef}>
          <mesh>
            <sphereGeometry args={[1, 64, 64]} />
            <meshStandardMaterial map={earthTexture} metalness={0.1} roughness={0.9} />
          </mesh>

          {nodes.map((n: any) => {
            const pos = latLonToCartesian(n.lat, n.lon, 1.01);
            return (
              <Marker key={`node-${n.id}`} position={pos} label={`Node ${n.id}`} onClick={() => selectNode && selectNode(n.id)} />
            );
          })}
        </group>

        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
}
