// Tiny procedural SFX via the native Web Audio API — no sound asset files.
// Browsers require audio to start from a user gesture; every call site here
// is reached from a keydown/pointerdown handler (Space, Shift, click), which
// satisfies that requirement, so the AudioContext can be created/resumed lazily.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function blip(freqStart: number, freqEnd: number, durationMs: number, type: OscillatorType, gainPeak: number) {
  const ac = getCtx();
  const t0 = ac.currentTime;
  const t1 = t0 + durationMs / 1000;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t1);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

export function sfxStart() {
  blip(320, 720, 120, "sine", 0.12);
}

export function sfxDash() {
  blip(700, 160, 130, "sawtooth", 0.15);
}

export function sfxHit() {
  blip(180, 55, 180, "square", 0.2);
}

export function sfxShield() {
  blip(520, 950, 200, "sine", 0.14);
}

export function sfxShieldBlock() {
  blip(900, 500, 90, "square", 0.16);
}

export function sfxKill() {
  blip(320, 720, 70, "triangle", 0.12);
}

export function sfxGameOver() {
  blip(420, 70, 550, "sawtooth", 0.2);
}

export function sfxWave() {
  blip(440, 660, 90, "triangle", 0.14);
  setTimeout(() => blip(660, 990, 140, "triangle", 0.14), 90);
}
