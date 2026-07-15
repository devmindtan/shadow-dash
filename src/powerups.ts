import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { POWER_UP } from "./entities";

export interface PowerUp {
  mesh: Mesh;
  spawnedAt: number;
}

let powerMat: StandardMaterial;

export function initPowerUpMaterial(scene: Scene) {
  powerMat = new StandardMaterial("powerMat", scene);
  powerMat.emissiveColor = POWER_UP.color;
  powerMat.disableLighting = true;
}

export function spawnPowerUp(scene: Scene, halfW: number, halfH: number): PowerUp {
  const margin = 60;
  const x = (Math.random() * 2 - 1) * (halfW - margin);
  const y = (Math.random() * 2 - 1) * (halfH - margin);
  const mesh = MeshBuilder.CreateSphere("power", { diameter: POWER_UP.radius * 2 }, scene);
  mesh.material = powerMat;
  mesh.position.x = x;
  mesh.position.y = y;
  return { mesh, spawnedAt: performance.now() };
}

export function pulsePowerUp(p: PowerUp, index: number) {
  const pulse = 1 + Math.sin(performance.now() / 150 + index) * 0.15;
  p.mesh.scaling.setAll(pulse);
}
