import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, useGLTF } from "@react-three/drei";
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

const TOWER_GLB = `${import.meta.env.BASE_URL}models/tower.glb`;
const SKY_DAY = `${import.meta.env.BASE_URL}sky/day.jpg`;
const SKY_NIGHT = `${import.meta.env.BASE_URL}sky/night.jpg`;
useGLTF.preload(TOWER_GLB);

function TowerModel({ theme }: { theme: Theme }) {
  const { scene } = useGLTF(TOWER_GLB);
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
      const mesh = o as unknown as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      mats.forEach((m) => {
        // Keep the GLB's authored PBR materials (MeshStandardMaterial / MeshPhysicalMaterial
        // with clearcoat, transmission, ior, emissive). Only tune envMapIntensity per role
        // so IBL reflections read correctly on glass / gold / water vs. matte concrete.
        const sm = m as THREE.MeshStandardMaterial;
        if (!("envMapIntensity" in sm)) return;
        const name = sm.name;
        if (name === "glass" || name === "water") {
          sm.envMapIntensity = 1.6;
        } else if (name === "gold" || name === "bollard") {
          sm.envMapIntensity = 1.8;
        } else if (name === "mullion" || name === "metal" || name === "spandrel") {
          sm.envMapIntensity = 1.1;
        } else if (name === "lobby") {
          sm.envMapIntensity = 1.3;
        } else {
          sm.envMapIntensity = 0.7;
        }
      });
    });
    return c;
  }, [scene]);

  useEffect(() => {
    const isDay = theme === "day";
    model.traverse((o) => {
      const mesh = o as unknown as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      mats.forEach((m) => {
        const sm = m as THREE.MeshStandardMaterial & { emissiveIntensity?: number };
        const name = sm.name;
        // Theme-driven PBR tuning — no material replacement.
        // Lit windows / crown glow / beacons glow at night, dim by day.
        if (name === "litA") {
          sm.emissiveIntensity = isDay ? 0.05 : 2.4;
        } else if (name === "litB") {
          sm.emissiveIntensity = isDay ? 0.05 : 2.8;
        } else if (name === "litC") {
          sm.emissiveIntensity = isDay ? 0.04 : 2.2;
        } else if (name === "crownglow" || name === "beacon") {
          sm.emissiveIntensity = isDay ? 0.15 : 3.2;
        } else if (name === "lobby") {
          sm.emissiveIntensity = isDay ? 0.2 : 1.6;
        }
        // Glass reflections read stronger against a night sky.
        if ("envMapIntensity" in sm) {
          if (name === "glass" || name === "water") {
            sm.envMapIntensity = isDay ? 1.2 : 1.9;
          } else if (name === "gold" || name === "bollard") {
            sm.envMapIntensity = isDay ? 1.5 : 2.0;
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
    // Load the photoreal equirectangular sky as the scene background.
    // The sky JPEG is a full 360° equirectangular panorama rendered in Blender
    // Cycles with physically-based atmospheric scattering.
    const loader = new THREE.TextureLoader();
    const url = theme === "day" ? SKY_DAY : SKY_NIGHT;
    const fogColor = theme === "day" ? "#8fa0b8" : "#070710";
    scene.fog = new THREE.FogExp2(fogColor, theme === "day" ? 0.0042 : 0.006);

    loader.load(url, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      scene.background = tex;
    });

    return () => {
      // Don't dispose — textures are cached by the browser for theme switching.
      if (scene.background instanceof THREE.Texture) {
        // Leave it; next effect run will replace it.
      }
    };
  }, [theme, scene]);
  return null;
}

/**
 * Procedural image-based lighting via drei <Environment> + <Lightformer>.
 * Generates an environment map on the GPU (no external HDR fetch) so all PBR
 * materials — glass transmission, gold metalness, clearcoat — read with real
 * reflections. Key is theme-bound so the env map rebuilds on day/night switch.
 */
function IblEnv({ theme }: { theme: Theme }) {
  const day = theme === "day";
  return (
    <Environment key={theme} resolution={256} frames={1} background={false}>
      {day ? (
        <>
          {/* Sky dome — soft cool diffuse from above */}
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#cfe0ff"
            position={[0, 18, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[40, 40, 1]}
          />
          {/* Warm sun streak from the front-right (matches key light dir) */}
          <Lightformer
            form="rect"
            intensity={3.5}
            color="#fff3df"
            position={[28, 14, 22]}
            rotation={[0, -Math.PI / 4, 0]}
            scale={[18, 12, 1]}
          />
          {/* Cool rim from behind-left */}
          <Lightformer
            form="rect"
            intensity={1.2}
            color="#cbd6f7"
            position={[-24, 16, -20]}
            rotation={[0, Math.PI / 3, 0]}
            scale={[16, 10, 1]}
          />
          {/* Ground bounce — warm concrete reflection */}
          <Lightformer
            form="rect"
            intensity={0.6}
            color="#9a8e78"
            position={[0, -6, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[30, 30, 1]}
          />
        </>
      ) : (
        <>
          {/* Night sky — deep blue dome */}
          <Lightformer
            form="rect"
            intensity={0.8}
            color="#1a2848"
            position={[0, 18, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[40, 40, 1]}
          />
          {/* Moonlight — cool silver from the high right */}
          <Lightformer
            form="rect"
            intensity={2.0}
            color="#cbd6f7"
            position={[22, 20, 18]}
            rotation={[0, -Math.PI / 4, 0]}
            scale={[12, 8, 1]}
          />
          {/* City glow — warm horizon haze from below-front */}
          <Lightformer
            form="rect"
            intensity={1.8}
            color="#ffb878"
            position={[0, 2, 28]}
            rotation={[0, 0, 0]}
            scale={[30, 6, 1]}
          />
          {/* Warm window bounce — gold/lobby reflections */}
          <Lightformer
            form="rect"
            intensity={1.0}
            color="#ffd6a0"
            position={[0, 8, 16]}
            rotation={[0, 0, 0]}
            scale={[14, 10, 1]}
          />
          {/* Ground bounce — dark water/plaza */}
          <Lightformer
            form="rect"
            intensity={0.25}
            color="#1c2840"
            position={[0, -6, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[30, 30, 1]}
          />
        </>
      )}
    </Environment>
  );
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
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: day ? 1.05 : 1.15 }}
    >
      <SceneEnv theme={theme} />
      <IblEnv theme={theme} />
      <CityBackdrop theme={theme} />

      <ambientLight intensity={day ? 0.35 : 0.25} color={day ? "#cfe0ff" : "#9fb0d8"} />
      <hemisphereLight args={day ? ["#cfe0ff", "#6b6253", 0.4] : ["#8fa6d8", "#2a2a35", 0.35]} />
      {/* Key light — warm, low from the front-right to rake across the tower face */}
      <directionalLight
        position={day ? [40, 55, 45] : [22, 28, 42]}
        intensity={day ? 3.6 : 4.5}
        color={day ? "#fff3df" : "#ffe0b0"}
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
      <directionalLight position={[-28, 42, -24]} intensity={day ? 0.9 : 2.2} color="#cbd6f7" />
      {/* Architectural accent spots on the facade */}
      <spotLight position={[0, 6, 24]} angle={0.55} penumbra={0.8} intensity={day ? 0.25 : 2.2} color="#cdb088" distance={60} />
      <spotLight position={[8, 14, 22]} angle={0.45} penumbra={0.9} intensity={day ? 0.2 : 1.8} color="#e6d3b3" distance={55} />
      <spotLight position={[-8, 14, 22]} angle={0.45} penumbra={0.9} intensity={day ? 0.2 : 1.8} color="#e6d3b3" distance={55} />
      {/* Ground wash */}
      <spotLight position={[0, 0.8, 16]} angle={0.9} penumbra={1} intensity={day ? 0.3 : 1.8} color="#8fa6d8" distance={55} />

      <Suspense fallback={null}>
        <TowerModel theme={theme} />
      </Suspense>

      <Markers units={units} onSelect={onSelect} dimmed={!!flyTarget} />
      <CameraController flyTarget={flyTarget} onArrived={onArrived} resetSignal={resetSignal} />

      <EffectComposer>
        <Bloom
          intensity={day ? 0.35 : 1.6}
          luminanceThreshold={day ? 0.72 : 0.18}
          luminanceSmoothing={0.9}
          mipmapBlur
          radius={0.85}
        />
      </EffectComposer>
    </Canvas>
  );
}
