import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { prefersReducedMotion } from "../lib/three-helpers";

/**
 * Sphere whose equirectangular map is loaded/disposed manually so only ONE
 * panorama texture is resident at a time (4K panoramas are ~33 MB on the GPU;
 * caching them all would balloon memory and lose the WebGL context). The old
 * texture stays visible until the new one is ready, so swaps don't flash black.
 */
function Photosphere({ src }: { src: string }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const current = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load(src, (t) => {
      if (!alive) {
        t.dispose();
        return;
      }
      t.colorSpace = THREE.SRGBColorSpace;
      const old = current.current;
      current.current = t;
      setTex(t);
      if (old) old.dispose();
    });
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(
    () => () => {
      current.current?.dispose();
      current.current = null;
    },
    [],
  );

  if (!tex) return null;
  return (
    <mesh rotation={[0, Math.PI * 0.667, 0]}>
      <sphereGeometry args={[50, 128, 96]} />
      {/* JPEG is already AgX-tonemapped in Blender → show it raw */}
      <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}

/**
 * Immersive 360° photo-sphere. Camera sits at the centre; OrbitControls holds a
 * fixed tiny radius so dragging only looks around (no zoom / pan).
 */
export default function PanoramaCanvas({ src }: { src: string }) {
  const reduced = prefersReducedMotion();
  const controls = useRef<any>(null);
  return (
    <Canvas
      camera={{ fov: 72, position: [0, 0, 0.1], near: 0.01, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
    >
      <Photosphere src={src} />
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableZoom={false}
        minDistance={0.1}
        maxDistance={0.1}
        rotateSpeed={-0.32}
        enableDamping
        dampingFactor={0.08}
        autoRotate={!reduced}
        autoRotateSpeed={0.22}
        onStart={() => {
          if (controls.current) controls.current.autoRotate = false;
        }}
      />
      <EffectComposer>
        <Bloom intensity={0.28} luminanceThreshold={0.85} luminanceSmoothing={0.92} mipmapBlur radius={0.5} />
      </EffectComposer>
    </Canvas>
  );
}
