import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF, Sky } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import gsap from "gsap";
import type { Unit, Theme } from "../types";
import { prefersReducedMotion } from "../lib/three-helpers";
import CityBackdrop from "./CityBackdrop";

// Dimensions match blender/build_tower.py so the GLB facade aligns with the
// unit markers and the camera fly-in targets.
export const TOWER = {
  floors: 34,
  floorH: 1.0,
  podiumH: 3,
  width: 9,
  depth: 9,
};
const bodyW = TOWER.width;
const bodyD = TOWER.depth;

function floorY(floor: number) {
  return TOWER.podiumH + (floor - 0.5) * TOWER.floorH;
}
function unitWorld(u: Unit): THREE.Vector3 {
  const x = (u.tower.colFrac - 0.5) * bodyW * 0.7;
  return new THREE.Vector3(x, floorY(u.floor), bodyD / 2 + 0.45);
}

const TOWER_GLB = "/models/tower.glb";
useGLTF.preload(TOWER_GLB);

function TowerModel({ theme }: { theme: Theme }) {
  const { scene } = useGLTF(TOWER_GLB);
  // Clone so React StrictMode / re-mounts never double-add the cached object.
  // Built front-+Y in Blender → glTF -Z; rotate 180° so the front faces +Z.
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return c;
  }, [scene]);

  // Lit windows / crown glow only at night; nearly off in daylight.
  useEffect(() => {
    model.traverse((o) => {
      const any = o as unknown as { material?: THREE.Material | THREE.Material[] };
      const mats = Array.isArray(any.material) ? any.material : any.material ? [any.material] : [];
      mats.forEach((m) => {
        const sm = m as THREE.MeshStandardMaterial & {
          userData: { base?: number; g?: { metal: number; rough: number; color: THREE.Color }; baseColor?: THREE.Color };
          emissive: THREE.Color;
        };
        if (sm.emissiveIntensity !== undefined) {
          if (sm.userData.base === undefined) sm.userData.base = sm.emissiveIntensity;
          sm.emissiveIntensity = theme === "day" ? sm.userData.base * 0.06 : sm.userData.base;
        }
        // Daylight: make the mirror-dark glass a brighter, sky-lit surface.
        if (sm.name === "glass" && sm.color) {
          if (!sm.userData.g) sm.userData.g = { metal: sm.metalness, rough: sm.roughness, color: sm.color.clone() };
          if (theme === "day") {
            sm.metalness = 0.55;
            sm.roughness = 0.16;
            sm.color.setHex(0x3a4d6a);
          } else {
            sm.metalness = sm.userData.g.metal;
            sm.roughness = sm.userData.g.rough;
            sm.color.copy(sm.userData.g.color);
          }
        }
        // Slightly brighten non-glass structural materials at night so the
        // building form reads against the sky instead of disappearing.
        // Skip materials that already emit their own light.
        const hasEmissive = sm.emissive && (sm.emissive.r || sm.emissive.g || sm.emissive.b);
        if (sm.name !== "glass" && sm.color && !hasEmissive) {
          if (sm.userData.baseColor === undefined) sm.userData.baseColor = sm.color.clone();
          const base = sm.userData.baseColor;
          if (theme === "night") {
            sm.color.setRGB(
              Math.min(1, base.r * 1.35),
              Math.min(1, base.g * 1.35),
              Math.min(1, base.b * 1.45),
            );
          } else {
            sm.color.copy(base);
          }
        }
      });
    });
  }, [model, theme]);

  return <primitive object={model} rotation={[0, Math.PI, 0]} />;
}

function SceneEnv({ theme }: { theme: Theme }) {
  const { scene } = useThree();
  useEffect(() => {
    if (theme === "day") {
      scene.background = new THREE.Color("#adc6e2");
      scene.fog = new THREE.FogExp2("#bcd2ea", 0.0042);
    } else {
      scene.background = new THREE.Color("#070710");
      scene.fog = new THREE.FogExp2("#070710", 0.006);
    }
  }, [theme, scene]);
  return null;
}

function CameraController({
  flyTarget,
  onArrived,
  resetSignal,
}: {
  flyTarget: Unit | null;
  onArrived: () => void;
  resetSignal: number;
}) {
  const { camera } = useThree();
  const flying = useRef(false);
  const resetting = useRef(false);
  const look = useRef(new THREE.Vector3(0, 20, 0));
  const HOME = useMemo(() => new THREE.Vector3(0, 21, 32), []);
  const HOME_LOOK = useMemo(() => new THREE.Vector3(0, 19.5, 0), []);
  const tweens = useRef<gsap.core.Tween[]>([]);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  useEffect(() => {
    camera.position.copy(HOME);
    look.current.copy(HOME_LOOK);
    camera.lookAt(look.current);
  }, [camera, HOME, HOME_LOOK]);

  // Fly toward a unit when selected.
  useEffect(() => {
    tweens.current.forEach((t) => t.kill());
    tweens.current = [];
    if (flyTarget) {
      flying.current = true;
      const p = unitWorld(flyTarget);
      const dest = new THREE.Vector3(p.x * 0.9, p.y + 0.3, p.z + 7);
      if (reducedMotion) {
        camera.position.copy(dest);
        look.current.copy(p);
        camera.lookAt(look.current);
        const id = window.setTimeout(onArrived, 60);
        return () => window.clearTimeout(id);
      }
      tweens.current.push(
        gsap.to(camera.position, {
          x: dest.x,
          y: dest.y,
          z: dest.z,
          duration: 2.3,
          ease: "power3.inOut",
          onComplete: onArrived,
        }),
      );
      tweens.current.push(
        gsap.to(look.current, {
          x: p.x,
          y: p.y,
          z: p.z,
          duration: 2.3,
          ease: "power3.inOut",
        }),
      );
    } else {
      flying.current = false;
    }
    return () => {
      tweens.current.forEach((t) => t.kill());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTarget]);

  // Reset to establishing pose.
  useEffect(() => {
    if (resetSignal === 0) return;
    tweens.current.forEach((t) => t.kill());
    flying.current = false;
    resetting.current = true;
    tweens.current = [
      gsap.to(camera.position, { x: HOME.x, y: HOME.y, z: HOME.z, duration: 1.6, ease: "power2.out" }),
      gsap.to(look.current, {
        x: HOME_LOOK.x,
        y: HOME_LOOK.y,
        z: HOME_LOOK.z,
        duration: 1.6,
        ease: "power2.out",
        onComplete: () => {
          resetting.current = false;
        },
      }),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  useFrame((state) => {
    if (!reducedMotion && !flying.current && !resetting.current) {
      const t = state.clock.elapsedTime;
      camera.position.x = HOME.x + Math.sin(t * 0.08) * 0.8;
      camera.position.y = HOME.y + Math.sin(t * 0.06) * 0.35;
      camera.position.z = HOME.z + Math.cos(t * 0.08) * 0.4;
    }
    camera.lookAt(look.current);
  });

  return null;
}

function Markers({
  units,
  onSelect,
  dimmed,
}: {
  units: Unit[];
  onSelect: (u: Unit) => void;
  dimmed: boolean;
}) {
  return (
    <>
      {units.map((u) => {
        const p = unitWorld(u);
        const available = u.status === "available";
        return (
          <group key={u.id} position={[p.x, p.y, p.z]}>
            <Html center distanceFactor={26} zIndexRange={[40, 0]} style={{ pointerEvents: dimmed ? "none" : "auto" }}>
              <button
                type="button"
                disabled={!available}
                aria-label={
                  available
                    ? `${u.residenceNo}（${u.layout}・空室）を3Dで内覧`
                    : `${u.residenceNo}（${u.status === "sold" ? "ご成約" : "商談中"}）`
                }
                aria-hidden={dimmed}
                tabIndex={dimmed ? -1 : 0}
                onClick={() => available && onSelect(u)}
                className={`group flex -translate-y-1 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs backdrop-blur-md transition-all ${
                  available
                    ? "cursor-pointer border-[#cdb088]/70 bg-black/55 text-[#e6d3b3] hover:scale-110 hover:bg-[#cdb088] hover:text-black"
                    : "cursor-default border-white/15 bg-black/40 text-white/35"
                } ${dimmed ? "opacity-0" : "opacity-100"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    available ? "bg-[#cdb088] group-hover:bg-black" : "bg-white/30"
                  }`}
                  style={available ? { boxShadow: "0 0 8px #cdb088" } : undefined}
                />
                {u.residenceNo}
              </button>
            </Html>
          </group>
        );
      })}
    </>
  );
}

export default function TowerScene({
  units,
  flyTarget,
  onSelect,
  onArrived,
  resetSignal,
  theme,
}: {
  units: Unit[];
  flyTarget: Unit | null;
  onSelect: (u: Unit) => void;
  onArrived: () => void;
  resetSignal: number;
  theme: Theme;
}) {
  const day = theme === "day";
  return (
    <Canvas
      shadows
      dpr={[1, 1.9]}
      camera={{ fov: 40, near: 0.5, far: 600, position: [0, 21, 32] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <SceneEnv theme={theme} />
      {day && <Sky sunPosition={[80, 26, 40]} turbidity={6} rayleigh={2} mieCoefficient={0.01} mieDirectionalG={0.8} />}
      <CityBackdrop theme={theme} />

      <ambientLight intensity={day ? 1.3 : 0.85} color={day ? "#cfe0ff" : "#7b8cb8"} />
      <hemisphereLight args={day ? ["#cfe0ff", "#6b6253", 1.2] : ["#5a6a9a", "#1a1a24", 0.85]} />
      {/* Key light — warm, low from the front-right to rake across the tower face */}
      <directionalLight
        position={day ? [40, 55, 45] : [18, 22, 38]}
        intensity={day ? 3.6 : 2.4}
        color={day ? "#fff3df" : "#ffd9a0"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={60}
        shadow-camera-bottom={-10}
      />
      {/* Cool rim light from behind/above-left to silhouette edges */}
      <directionalLight position={[-28, 42, -24]} intensity={day ? 0.9 : 1.8} color="#aab8de" />
      {/* Architectural accent spots on the facade */}
      <spotLight position={[0, 6, 24]} angle={0.55} penumbra={0.8} intensity={day ? 0.25 : 1.4} color="#cdb088" distance={60} />
      <spotLight position={[8, 14, 22]} angle={0.45} penumbra={0.9} intensity={day ? 0.2 : 1.1} color="#e6d3b3" distance={55} />
      <spotLight position={[-8, 14, 22]} angle={0.45} penumbra={0.9} intensity={day ? 0.2 : 1.1} color="#e6d3b3" distance={55} />
      {/* Ground wash */}
      <spotLight position={[0, 0.8, 16]} angle={0.9} penumbra={1} intensity={day ? 0.3 : 1.2} color="#8fa6d8" distance={55} />

      <Suspense fallback={null}>
        <TowerModel theme={theme} />
      </Suspense>

      <Markers units={units} onSelect={onSelect} dimmed={!!flyTarget} />
      <CameraController flyTarget={flyTarget} onArrived={onArrived} resetSignal={resetSignal} />

      <EffectComposer>
        <Bloom
          intensity={day ? 0.35 : 1.25}
          luminanceThreshold={day ? 0.72 : 0.22}
          luminanceSmoothing={0.9}
          mipmapBlur
          radius={0.85}
        />
      </EffectComposer>
    </Canvas>
  );
}
