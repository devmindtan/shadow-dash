import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { DARK_ORB, ORB_TYPES } from "./entities";
import type { OrbTypeDef } from "./entities";
import { sfxKill } from "./audio";

export interface Orb {
  mesh: Mesh;
  type: OrbTypeDef;
  radius: number;
  spawnX: number;
  spawnY: number;
  dirX: number;
  dirY: number;
  perpX: number;
  perpY: number;
  speed: number;
  traveled: number;
  ageMs: number;
  hasSplit: boolean;
}

const orbMaterials = new Map<string, StandardMaterial>();

export function initOrbMaterials(scene: Scene) {
  for (const type of ORB_TYPES) {
    const mat = new StandardMaterial(`orbMat-${type.id}`, scene);
    mat.emissiveColor = type.color;
    mat.diffuseColor = DARK_ORB.dimColor;
    mat.disableLighting = true;
    orbMaterials.set(type.id, mat);
  }
}

export function createOrb(
  scene: Scene,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  speed: number,
  type: OrbTypeDef,
  radius: number
): Orb {
  const mesh = MeshBuilder.CreateSphere("orb", { diameter: radius * 2 }, scene);
  mesh.material = orbMaterials.get(type.id)!;
  mesh.position.x = x;
  mesh.position.y = y;
  return {
    mesh,
    type,
    radius,
    spawnX: x,
    spawnY: y,
    dirX,
    dirY,
    perpX: -dirY,
    perpY: dirX,
    speed,
    traveled: 0,
    ageMs: 0,
    hasSplit: false,
  };
}

export function spawnOrb(scene: Scene, speed: number, halfW: number, halfH: number, playerPos: { x: number; y: number }): Orb {
  const angle = Math.random() * Math.PI * 2;
  const spawnDist = Math.max(halfW, halfH) * 1.2;
  const sx = Math.cos(angle) * spawnDist;
  const sy = Math.sin(angle) * spawnDist;
  const dx = playerPos.x - sx;
  const dy = playerPos.y - sy;
  const len = Math.hypot(dx, dy) || 1;
  const type = ORB_TYPES[Math.floor(Math.random() * ORB_TYPES.length)];
  return createOrb(scene, sx, sy, dx / len, dy / len, speed, type, DARK_ORB.radius);
}

// Returns the 2 new shard orbs; caller is responsible for pushing them into
// its own orbs array and disposing/removing the original.
export function spawnSplitShards(scene: Scene, o: Orb, onBurst: (x: number, y: number, color: string, size: number) => void): Orb[] {
  const shardType = ORB_TYPES[0]; // plain drifter shards — no chained re-splitting
  const baseAngle = Math.atan2(o.dirY, o.dirX);
  const spreadRad = (35 * Math.PI) / 180;
  const shards: Orb[] = [];
  for (const sign of [-1, 1]) {
    const angle = baseAngle + sign * spreadRad;
    shards.push(
      createOrb(scene, o.mesh.position.x, o.mesh.position.y, Math.cos(angle), Math.sin(angle), o.speed * 1.1, shardType, o.radius * 0.65)
    );
  }
  onBurst(o.mesh.position.x, o.mesh.position.y, o.type.cssColor, o.radius * 3);
  sfxKill();
  return shards;
}

// Moves the orb according to its type's behavior — mutates o.mesh.position,
// o.traveled, o.ageMs, and (for "track") o.dirX/dirY in place.
export function updateOrbMovement(o: Orb, dt: number, playerPos: { x: number; y: number }) {
  // charge: crawls slowly, then bursts to a much higher speed after chargeAfterMs
  const effSpeed = o.type.behavior === "charge" && o.ageMs < (o.type.chargeAfterMs ?? 700) ? o.speed * 0.35 : o.speed;
  o.traveled += effSpeed * dt;
  o.ageMs += dt * 1000;

  let px: number;
  let py: number;
  if (o.type.behavior === "track") {
    // true homing: re-aims toward the player's *current* spot every frame,
    // unlike every other type which locks its direction at spawn time
    const dx = playerPos.x - o.mesh.position.x;
    const dy = playerPos.y - o.mesh.position.y;
    const len = Math.hypot(dx, dy) || 1;
    o.dirX = dx / len;
    o.dirY = dy / len;
    px = o.mesh.position.x + o.dirX * o.speed * dt;
    py = o.mesh.position.y + o.dirY * o.speed * dt;
  } else {
    px = o.spawnX + o.dirX * o.traveled;
    py = o.spawnY + o.dirY * o.traveled;
    if (o.type.behavior === "wobble") {
      const offset = Math.sin(o.traveled * (o.type.wobbleFrequency ?? 0)) * (o.type.wobbleAmplitude ?? 0);
      px += o.perpX * offset;
      py += o.perpY * offset;
    }
  }
  o.mesh.position.x = px;
  o.mesh.position.y = py;
}

export function shouldSplitNow(o: Orb): boolean {
  return o.type.behavior === "split" && !o.hasSplit && o.ageMs >= (o.type.splitAfterMs ?? Infinity);
}
