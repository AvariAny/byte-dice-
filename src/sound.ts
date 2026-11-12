// Sonido sintetizado con Web Audio (no necesita archivos de audio).
// Incluye efectos, música de fondo en bucle y estado de silencio guardado.

type Listener = () => void;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicWanted = false;
let nextNoteTime = 0;
let step = 0;
const listeners = new Set<Listener>();

let muted = (() => {
  try {
    return localStorage.getItem("bytedice-muted") === "1";
  } catch {
    return false;
  }
})();

function ensureCtx(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.07;
    musicGain.connect(master);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  dest: AudioNode,
  slideTo?: number,
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

// ── Efectos ──────────────────────────────────────────────────────────────────
export function sfx(kind: "click" | "correct" | "wrong" | "levelup" | "gameover") {
  const c = ensureCtx();
  if (!c || !master || muted) return;
  const t = c.currentTime;
  if (kind === "click") {
    tone(660, t, 0.06, "square", 0.08, master);
  } else if (kind === "correct") {
    tone(523, t, 0.12, "square", 0.12, master);
    tone(784, t + 0.1, 0.2, "square", 0.12, master);
  } else if (kind === "wrong") {
    tone(220, t, 0.3, "sawtooth", 0.14, master, 110);
  } else if (kind === "levelup") {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.12, 0.22, "square", 0.12, master!));
  } else {
    [392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.2, 0.3, "triangle", 0.16, master!));
  }
}

// ── Música de fondo (arpegio en La menor pentatónica) ────────────────────────
const BASS = [110, 110, 87.31, 98]; // A2 A2 F2 G2
const ARP = [220, 261.63, 329.63, 392, 329.63, 261.63, 293.66, 392];
const STEP_LEN = 0.22;

function scheduler() {
  if (!ctx || !musicGain) return;
  while (nextNoteTime < ctx.currentTime + 0.3) {
    const bar = Math.floor(step / 8) % BASS.length;
    const arpNote = ARP[step % ARP.length] * (bar === 2 ? 0.8 : bar === 3 ? 0.9 : 1);
    tone(arpNote, nextNoteTime, STEP_LEN * 0.9, "square", 0.5, musicGain);
    if (step % 4 === 0) tone(BASS[bar], nextNoteTime, STEP_LEN * 3.5, "triangle", 0.9, musicGain);
    nextNoteTime += STEP_LEN;
    step++;
  }
}

export function startMusic() {
  musicWanted = true;
  const c = ensureCtx();
  if (!c || musicTimer !== null) return;
  nextNoteTime = c.currentTime + 0.05;
  musicTimer = window.setInterval(scheduler, 100);
}

export function stopMusic() {
  musicWanted = false;
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

// ── Silencio ─────────────────────────────────────────────────────────────────
export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("bytedice-muted", m ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
  listeners.forEach((l) => l());
}

export function subscribeMute(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// La música arranca con el primer toque (los navegadores exigen un gesto).
export function unlockAudio() {
  ensureCtx();
  if (!musicWanted || musicTimer === null) startMusic();
}
