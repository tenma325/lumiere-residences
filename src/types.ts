// ------------------------------------------------------------------
// Shared data model. Every floor plan is described ONCE here, in metres,
// top-down. Both the 2D SVG plan and the 3D interior are generated from
// these same numbers — that is what keeps them perfectly consistent.
// Coordinate system (top-down): x = left→right, z = front(top)→back(bottom).
// In 3D: x→x, z→z, y = up.
// ------------------------------------------------------------------

export type RoomKind =
  | "ldk"
  | "bedroom"
  | "master"
  | "bath"
  | "powder"
  | "toilet"
  | "entry"
  | "corridor"
  | "wic"
  | "balcony";

export type FloorMaterial = "oak" | "marble" | "carpet" | "tile" | "deck";

export interface RoomRect {
  id: string;
  kind: RoomKind;
  label: string; // Japanese label, e.g. "リビング・ダイニング"
  sub?: string; // small caption, e.g. "20.5帖"
  x: number;
  z: number;
  w: number;
  d: number;
  floor?: FloorMaterial;
}

export type FurnitureKind =
  | "sofa"
  | "sectional"
  | "coffeeTable"
  | "rug"
  | "tv"
  | "tvBoard"
  | "diningTable"
  | "island"
  | "kitchen"
  | "bed"
  | "bedDouble"
  | "nightstand"
  | "wardrobe"
  | "desk"
  | "plant"
  | "pendant"
  | "artwork"
  | "bathtub"
  | "vanity"
  | "lounge"
  | "shelf";

export interface FurnitureItem {
  kind: FurnitureKind;
  x: number;
  z: number;
  rot?: number; // degrees, clockwise in top-down view
  scale?: number;
}

export interface FloorPlan {
  id: string;
  name: string; // "PLAN A"
  layout: string; // "3LDK"
  widthM: number; // overall envelope incl. balcony
  depthM: number;
  ceilingM: number;
  /** Envelope sides that are floor-to-ceiling glazing (the view). */
  glazedSides: Array<"top" | "bottom" | "left" | "right">;
  rooms: RoomRect[];
  furniture: FurnitureItem[];
}

export type Facing = "S" | "SE" | "SW" | "E" | "W" | "N";
export type UnitStatus = "available" | "negotiating" | "sold";

export interface Unit {
  id: string;
  residenceNo: string; // "32-01"
  floor: number;
  layout: string;
  areaM2: number;
  facing: Facing;
  priceOku: number; // price in 億円 (e.g. 2.48 = 2億4,800万円)
  status: UnitStatus;
  planId: string;
  tagline: string;
  // Horizontal placement (0–1) on the tower's front facade for the fly-in target.
  tower: { colFrac: number };
}

/** A Blender-rendered 360° viewpoint inside a plan (LDK, bedroom, …). */
export interface Viewpoint {
  room: string; // "ldk" | "bed"
  roomId: string; // matches a RoomRect id in the plan
  label: string;
  x: number; // plan coords (m) of the camera — for the minimap marker
  z: number;
  day: string; // panorama image paths
  night: string;
}

export type Theme = "day" | "night";

// ------------------------------------------------------------------
// Derived wall geometry (computed by lib/layout.ts)
// ------------------------------------------------------------------
export interface Wall {
  /** Axis the wall extends along. "z" = vertical wall at fixed x; "x" = horizontal wall at fixed z. */
  dir: "x" | "z";
  coord: number; // the fixed coordinate (x for dir "z", z for dir "x")
  a: number; // start along the extending axis
  b: number; // end
  kind: "solid" | "glass" | "rail";
  exterior: boolean;
  door?: { at: number; width: number };
}
