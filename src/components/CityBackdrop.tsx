import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mulberry32 } from "../lib/three-helpers";

/**
 * Procedural night-city backdrop: stars, a crescent moon, and distant
 * building lights rendered as particles. Keeps the hero from falling into
 * a flat black void without adding heavy assets.
 */
export default function CityBackdrop({ theme }: { theme: "day" | "night" }) {
  const starsRef = useRef<THREE.Points>(null);
  const cityRef = useRef<THREE.Points>(null);

  const { starPositions, starSizes, cityPositions, cityColors } = useMemo(() => {
    const rng = mulberry32(20260616);
    const stars: number[] = [];
    const starSizesArr: number[] = [];
    for (let i = 0; i < 900; i++) {
      const r = 180 + rng() * 220;
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(1 - 2 * rng() * 0.55); // upper dome
      stars.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      starSizesArr.push(0.5 + rng() * 1.5);
    }

    const city: number[] = [];
    const cityCols: number[] = [];
    for (let i = 0; i < 320; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = 90 + rng() * 200;
      const x = Math.cos(angle) * radius;
      const z = -60 - rng() * 220;
      const y = rng() * 45 - 5;
      city.push(x, y, z);
      const warm = rng() > 0.35;
      cityCols.push(warm ? 1 : 0.75, warm ? 0.82 : 0.85, warm ? 0.55 : 1);
    }
    return {
      starPositions: new Float32Array(stars),
      starSizes: new Float32Array(starSizesArr),
      cityPositions: new Float32Array(city),
      cityColors: new Float32Array(cityCols),
    };
  }, []);

  useFrame(({ clock }) => {
    if (starsRef.current) {
      starsRef.current.rotation.y = clock.elapsedTime * 0.003;
    }
  });

  if (theme === "day") {
    return (
      <group>
        <points ref={starsRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
            <bufferAttribute attach="attributes-size" args={[starSizes, 1]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.6}
            color="#ffffff"
            transparent
            opacity={0.18}
            sizeAttenuation
            depthWrite={false}
          />
        </points>
      </group>
    );
  }

  return (
    <group>
      {/* stars */}
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
          <bufferAttribute attach="attributes-size" args={[starSizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.75}
          color="#e6ecf7"
          transparent
          opacity={0.85}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* distant building bokeh */}
      <points ref={cityRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[cityPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[cityColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={1.6}
          vertexColors
          transparent
          opacity={0.55}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* soft moon glow */}
      <mesh position={[-60, 80, -120]}>
        <circleGeometry args={[14, 32]} />
        <meshBasicMaterial color="#d8e3f7" transparent opacity={0.04} depthWrite={false} />
      </mesh>
    </group>
  );
}
