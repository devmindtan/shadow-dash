// Keyboard movement state — Space (start/dash) is handled in main.ts since it
// needs game-state context this module doesn't have.
const MOVE_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);
const keys = new Set<string>();

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (MOVE_KEYS.has(key)) keys.add(key);
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

export function getMoveDirection(): { x: number; y: number } {
  let dx = 0;
  let dy = 0;
  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy += 1;
  if (keys.has("arrowdown") || keys.has("s")) dy -= 1;
  return { x: dx, y: dy };
}
