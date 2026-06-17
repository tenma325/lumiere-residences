import { useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { prefersReducedMotion } from "../lib/three-helpers";
import type { Theme } from "../types";

/**
 * Sphere whose equirectangular map is loaded/disposed manually so only ONE
 * panorama texture is resident at a time (4K panoramas are ~33 MB on the GPU;
 * caching them all would balloon memory and lose the WebGL context). The old
 * texture stays visible until the new one is ready, so swaps don't flash black.
 *
 * The JPEGs are already AgX-tonemapped in Blender, so the material uses
 * `toneMapped={false}` to show them raw (avoiding a double-tonemap that would
 * wash out highlights). Theme-dependent brightness is applied through a subtle
 * warm gain on the material colour + a theme-aware Bloom pass.
 */
function Photosphere({ src, theme }: { src: string; theme: Theme }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const current = useRef<THREE.Texture | null>(null);
  const { gl } = useThree();

  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load(src, (t) => {
      if (!alive) {
        t.dispose();
        return;
      }
      t.colorSpace = THREE.SRGBColorSpace;
      // High-quality sampling: trilinear mip filtering + maximum anisotropy
      // so grazing-angle detail (floor grain, window mullions, art) stays
      // crisp instead of shimmering when the user looks around.
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = gl.capabilities.getMaxAnisotropy();
      t.needsUpdate = true;
      const old = current.current;
      current.current = t;
      setTex(t);
      if (old) old.dispose();
    });
    return () => {
      alive = false;
    };
  }, [src, gl]);

  useEffect(
    () => () => {
      current.current?.dispose();
      current.current = null;
    },
    [],
  );

  if (!tex) return null;

  // Subtle warm gain at night to lift shadow detail without crushing
  // highlights. Values >1 multiply the linear-space texture samples.
  const gain =
    theme === "night"
      ? new THREE.Color(1.07, 1.04, 1.0)
      : new THREE.Color(1.0, 1.0, 1.0);

  return (
    <mesh rotation={[0, Math.PI * 0.667, 0]}>
      <sphereGeometry args={[50, 128, 96]} />
      {/* JPEG is already AgX-tonemapped in Blender → show it raw */}
      <meshBasicMaterial
        map={tex}
        color={gain}
        side={THREE.BackSide}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Immersive 360° photo-sphere. Camera sits at the centre; OrbitControls holds a
 * fixed tiny radius so dragging only looks around (no zoom / pan).
 */
export default function PanoramaCanvas({
  src,
  theme,
}: {
  src: string;
  theme: Theme;
}) {
  const reduced = prefersReducedMotion();
  const controls = useRef<any>(null);
  const isNight = theme === "night";
  return (
    <Canvas
      camera={{ fov: 72, position: [0, 0, 0.1], near: 0.01, far: 100 }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.08,
        // High-performance context + no preserved buffer keeps GPU memory low
        // so repeated open/close of the interior viewer doesn't leak contexts.
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }}
    >
      <Photosphere src={src} theme={theme} />
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
        {/* Night: lower threshold + higher intensity so warm interior lights
            (pendants, cove lighting, city glow through glass) bloom softly.
            Day: barely-there highlight bloom keeps the look clean. */}
        <Bloom
          intensity={isNight ? 0.42 : 0.2}
          luminanceThreshold={isNight ? 0.62 : 0.85}
          luminanceSmoothing={0.9}
          mipmapBlur
          radius={isNight ? 0.72 : 0.5}
        />
      </EffectComposer>
    </Canvas>
  );
}
