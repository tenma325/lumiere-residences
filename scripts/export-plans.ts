// Exports the floor-plan data + computed walls for the Blender-rendered units,
// so Blender builds the exact same geometry as the 2D plan / procedural 3D.
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { PLANS, UNITS } from "../src/data/residences";
import { buildWalls } from "../src/lib/layout";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "blender", "plans.json");

// The vacant units we render in Blender (one per plan type).
const TARGET_UNIT_IDS = ["u1", "u2", "u3"]; // 32-01, 31-02, 30-03

const units = UNITS.filter((u) => TARGET_UNIT_IDS.includes(u.id));
const planIds = [...new Set(units.map((u) => u.planId))];

const plans: Record<string, unknown> = {};
for (const pid of planIds) {
  const p = PLANS[pid];
  plans[pid] = {
    id: p.id,
    name: p.name,
    layout: p.layout,
    widthM: p.widthM,
    depthM: p.depthM,
    ceilingM: p.ceilingM,
    rooms: p.rooms,
    furniture: p.furniture,
    walls: buildWalls(p),
  };
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  JSON.stringify(
    {
      plans,
      units: units.map((u) => ({
        id: u.id,
        residenceNo: u.residenceNo,
        planId: u.planId,
        facing: u.facing,
        floor: u.floor,
      })),
    },
    null,
    2,
  ),
);
console.log("wrote", out, "— plans:", Object.keys(plans).join(","), "units:", units.length);
