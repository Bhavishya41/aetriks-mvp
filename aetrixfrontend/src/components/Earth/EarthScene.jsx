
import React, { useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const Earth = () => {
  const meshRef = useRef();

  // Load textures
  const [dayMap, nightMap, bumpMap] = useLoader(THREE.TextureLoader, [
    '/textures/planets/earth_day_4096.jpg',
    '/textures/planets/earth_night_4096.jpg',
    '/textures/planets/earth_bump_roughness_clouds_4096.jpg',
  ]);

  // Rotate Earth
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial
        map={dayMap}
        bumpMap={bumpMap}
        bumpScale={0.05}
        roughnessMap={bumpMap}
        roughness={0.8}
        emissiveMap={nightMap}
        emissive={new THREE.Color(0xffffaa)}
        emissiveIntensity={0.2}
      />
    </mesh>
  );
};

export default function EarthScene() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: -1 }}>
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.1} />
        <directionalLight position={[5, 3, 5]} intensity={1.5} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
        <React.Suspense fallback={null}>
          <Earth />
        </React.Suspense>
      </Canvas>
    </div>
  );
}

