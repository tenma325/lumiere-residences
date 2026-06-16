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
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
      const mesh = o as unknown as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      mats.forEach((m) => {
        const sm = m as THREE.MeshStandardMaterial & {
          userData: { base?: number; basic?: THREE.MeshBasicMaterial };
          emissive: THREE.Color;
          color: THREE.Color;
          opacity: number;
          transparent: boolean;
        };
        const name = sm.name;
        // Real-time fallback: the GLB is authored for Blender Cycles (very dark,
        // AgX-tonemapped) and looks black with no environment map in WebGL.
        // Replace all structural materials with a high-contrast basic palette.
        if (!sm.userData.basic) {
          const basic = new THREE.MeshBasicMaterial({ name, transparent: false, opacity: 1 });
          if (name === "glass") {
            basic.color.setHex(theme === "day" ? 0x6a8cb8 : 0x162036);
            basic.transparent = true;
            basic.opacity = 0.92;
          } else if (name === "litA" || name === "litB" || name === "litC") {
            // lit windows
            basic.color.copy(sm.emissive || new THREE.Color(0xfff4e6));
          } else if (name === "crownglow" || name === "beacon") {
            basic.color.copy(sm.color || new THREE.Color(0xffdca4));
          } else if (name === "gold" || name === "bollard") {
            basic.color.setHex(0xc8924a);
          } else if (name === "lobby") {
            basic.color.setHex(0xf5e6c8);
          } else if (name === "slab") {
            basic.color.setHex(0x2a2f3d);
          } else if (name === "spandrel") {
            basic.color.setHex(0x202538);
          } else if (name === "mullion") {
            basic.color.setHex(0x1e2333);
          } else if (name === "metal") {
            basic.color.setHex(0x3a4050);
          } else if (name === "stone") {
            basic.color.setHex(0x4b5060);
          } else if (name === "plant") {
            basic.color.setHex(0x1a2e1a);
          } else if (name === "trunk") {
            basic.color.setHex(0x3d2f20);
          } else if (name === "water") {
            basic.color.setHex(0x0f1724);
          } else {
            basic.color.copy(sm.color || new THREE.Color(0x333333));
          }
          sm.userData.basic = basic;
        }
      });
    });
    return c;
  }, [scene, theme]);

  useEffect(() => {
    const isDay = theme === "day";
    model.traverse((o) => {
      const mesh = o as unknown as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      mats.forEach((m) => {
        const sm = m as THREE.MeshStandardMaterial & {
          userData: { base?: number; basic?: THREE.MeshBasicMaterial };
          emissive: THREE.Color;
          color: THREE.Color;
        };
        if (!sm.userData.basic) return;
        const basic = sm.userData.basic;
        const name = sm.name;
        if (name === "glass") {
          basic.color.setHex(isDay ? 0x6a8cb8 : 0x162036);
        } else if (name === "litA") {
          basic.color.setHex(isDay ? 0x2a2522 : 0xffd6ac);
        } else if (name === "litB") {
          basic.color.setHex(isDay ? 0x2a2522 : 0xffe8c8);
        } else if (name === "litC") {
          basic.color.setHex(isDay ? 0x1c2028 : 0xc8dcff);
        } else if (name === "crownglow" || name === "beacon") {
          basic.color.setHex(isDay ? 0x5a4a30 : 0xffddaa);
        } else if (name === "lobby") {
          basic.color.setHex(isDay ? 0xd8d0c0 : 0xfff0d0);
        } else if (name === "gold" || name === "bollard") {
          basic.color.setHex(isDay ? 0xa4763a : 0xc8924a);
        } else if (name === "slab") {
          basic.color.setHex(isDay ? 0x5a6378 : 0x2a2f3d);
        } else if (name === "spandrel") {
          basic.color.setHex(isDay ? 0x4a5468 : 0x202538);
        } else if (name === "mullion") {
          basic.color.setHex(isDay ? 0x3f4758 : 0x1e2333);
        } else if (name === "metal") {
          basic.color.setHex(isDay ? 0x6a7285 : 0x3a4050);
        } else if (name === "stone") {
          basic.color.setHex(isDay ? 0x7a8092 : 0x4b5060);
        } else if (name === "plant") {
          basic.color.setHex(isDay ? 0x2a4a2a : 0x1a2e1a);
        } else if (name === "trunk") {
          basic.color.setHex(isDay ? 0x5c4a36 : 0x3d2f20);
        } else if (name === "water") {
          basic.color.setHex(isDay ? 0x1c2f48 : 0x0f1724);
        }
        // Apply the basic material on this mesh.
        (mesh.material as THREE.Material) = basic;
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

      <ambientLight intensity={day ? 1.6 : 1.2} color={day ? "#cfe0ff" : "#9fb0d8"} />
      <hemisphereLight args={day ? ["#cfe0ff", "#6b6253", 1.5] : ["#8fa6d8", "#2a2a35", 1.35]} />
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
