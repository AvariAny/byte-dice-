import { useState, useCallback, useRef, useEffect } from "react";

type Screen = "home" | "guide" | "map" | "game" | "gameover" | "levelup";

interface Puzzle {
  type: "and" | "or" | "xor" | "not" | "nand";
  a: number;
  b?: number;
  answer: number;
  description: string;
}

const GATE_SYMBOLS: Record<string, string> = {
  and: "AND", or: "OR", xor: "XOR", not: "NOT", nand: "NAND",
};

function generatePuzzle(level: number): Puzzle {
  const availableOps =
    level < 3
      ? (["and", "or"] as const)
      : level < 5
        ? (["and", "or", "xor"] as const)
        : (["and", "or", "xor", "not", "nand"] as const);
  const op = availableOps[Math.floor(Math.random() * availableOps.length)];
  const a = Math.round(Math.random()) as 0 | 1;
  if (op === "not") {
    return { type: op, a, answer: a === 1 ? 0 : 1, description: `NOT ${a} = ?` };
  }
  const b = Math.round(Math.random()) as 0 | 1;
  let answer: 0 | 1;
  if (op === "and") answer = (a & b) as 0 | 1;
  else if (op === "or") answer = (a | b) as 0 | 1;
  else if (op === "xor") answer = (a ^ b) as 0 | 1;
  else answer = ((~(a & b)) & 1) as 0 | 1;
  return { type: op, a, b, answer, description: `${a} ${GATE_SYMBOLS[op]} ${b} = ?` };
}

const XP_PER_LEVEL = 100;
const XP_PER_CORRECT = 20;
const XP_PER_WRONG = -5;

// ── Map level data ────────────────────────────────────────────────────────────
interface MapNode {
  id: number;
  label: string;
  gate: string;
  x: number; // 0-100 percent
  y: number; // 0-100 percent of container
  type: "normal" | "boss" | "start";
}

const MAP_NODES: MapNode[] = [
  { id: 1,  label: "INICIO",   gate: "—",    x: 50, y: 92, type: "start"  },
  { id: 2,  label: "AND I",    gate: "AND",  x: 25, y: 82, type: "normal" },
  { id: 3,  label: "AND II",   gate: "AND",  x: 68, y: 72, type: "normal" },
  { id: 4,  label: "OR I",     gate: "OR",   x: 30, y: 62, type: "normal" },
  { id: 5,  label: "DESAFÍO",  gate: "AND+OR",x: 58, y: 52, type: "boss"  },
  { id: 6,  label: "XOR I",    gate: "XOR",  x: 22, y: 42, type: "normal" },
  { id: 7,  label: "XOR II",   gate: "XOR",  x: 65, y: 33, type: "normal" },
  { id: 8,  label: "NOT",      gate: "NOT",  x: 35, y: 24, type: "normal" },
  { id: 9,  label: "NAND",     gate: "NAND", x: 62, y: 15, type: "normal" },
  { id: 10, label: "MAESTRO",  gate: "ALL",  x: 45, y: 6,  type: "boss"   },
];

// SVG path connecting nodes (pairs)
const MAP_EDGES: [number, number][] = [
  [1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],
];

// ── Guide Robot SVG ───────────────────────────────────────────────────────────
type BotMood = "idle" | "happy" | "sad" | "thinking";

function GuideBot({ size = 80, glow = false, mood = "idle" }: { size?: number; glow?: boolean; mood?: BotMood }) {
  const accentColor = mood === "sad" ? "#ff3366" : mood === "thinking" ? "#00d4ff" : "#00ff88";
  const borderColor = mood === "sad" ? "#ff3366" : mood === "thinking" ? "#00d4ff" : "#00ff88";
  const glowColor   = mood === "sad" ? "#ff3366" : mood === "thinking" ? "#00d4ff" : "#00ff88";

  // Eye shapes per mood
  const eyeLeft  = mood === "sad"      ? { y: 24, h: 5, ry: 2 }
                 : mood === "happy"    ? { y: 22, h: 7, ry: 4 }
                 : mood === "thinking" ? { y: 22, h: 6, ry: 2 }
                 :                       { y: 21, h: 9, ry: 2 };
  const eyeRight = eyeLeft;

  // Mouth text per mood
  const mouthText = mood === "happy"    ? "01111110"
                  : mood === "sad"      ? "00011000"
                  : mood === "thinking" ? "01010101"
                  :                       "10110100";

  // Arms raised on happy
  const armLY    = mood === "happy" ? 44 : 52;
  const armRY    = mood === "happy" ? 44 : 52;
  const armLRot  = mood === "happy" ? "rotate(-30,8,53)" : "";
  const armRRot  = mood === "happy" ? "rotate(30,72,53)" : "";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: glow ? `drop-shadow(0 0 8px ${glowColor})` : undefined, transition: "filter 0.3s" }}
    >
      {/* Antenna */}
      <line x1="40" y1="4" x2="40" y2="13" stroke={accentColor} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="40" cy="3" r="2.5" fill={accentColor}/>
      {mood === "happy" && <circle cx="40" cy="3" r="5" fill={accentColor} opacity="0.25"/>}

      {/* Head */}
      <rect x="18" y="13" width="44" height="32" rx="6" fill="#0d0f1a" stroke={borderColor} strokeWidth="1.5"/>

      {/* Eyes — left */}
      <rect x="24" y={eyeLeft.y} width="12" height={eyeLeft.h} rx={eyeLeft.ry} fill={accentColor} opacity="0.9"/>
      {/* Eyes — right */}
      <rect x="44" y={eyeRight.y} width="12" height={eyeRight.h} rx={eyeRight.ry} fill={accentColor} opacity="0.9"/>

      {/* Pupils — hide when happy (wide open) */}
      {mood !== "happy" && <>
        <rect x="28" y={eyeLeft.y + 2} width="4" height={Math.max(2, eyeLeft.h - 4)} rx="1" fill="#07080f"/>
        <rect x="48" y={eyeRight.y + 2} width="4" height={Math.max(2, eyeRight.h - 4)} rx="1" fill="#07080f"/>
      </>}

      {/* Thinking squiggle brow */}
      {mood === "thinking" && <>
        <path d="M24 20 Q28 17 32 20" stroke={accentColor} strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <path d="M44 20 Q48 17 52 20" stroke={accentColor} strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      </>}

      {/* Sad tears */}
      {mood === "sad" && <>
        <ellipse cx="29" cy="33" rx="1.2" ry="2.5" fill="#00d4ff" opacity="0.7"/>
        <ellipse cx="51" cy="33" rx="1.2" ry="2.5" fill="#00d4ff" opacity="0.7"/>
      </>}

      {/* Mouth bar */}
      <rect x="24" y="35" width="32" height="6" rx="2" fill="#141626" stroke="#1e2235" strokeWidth="1"/>
      <text x="40" y="40.5" textAnchor="middle" fill={accentColor} fontSize="5" fontFamily="JetBrains Mono, monospace" fontWeight="700">{mouthText}</text>

      {/* Neck */}
      <rect x="35" y="45" width="10" height="5" rx="2" fill="#1e2235"/>

      {/* Body */}
      <rect x="14" y="50" width="52" height="24" rx="6" fill="#0d0f1a" stroke="#1e2235" strokeWidth="1.5"/>

      {/* Chest panel */}
      <rect x="22" y="55" width="36" height="13" rx="3" fill="#141626" stroke="#1e2235"/>
      <circle cx="30" cy="62" r="2.5" fill={mood === "happy" ? "#00ff88" : mood === "sad" ? "#ff3366" : "#00ff88"} opacity="0.9"/>
      <circle cx="38" cy="62" r="2.5" fill={mood === "thinking" ? "#00d4ff" : "#1e2235"}/>
      <circle cx="46" cy="62" r="2.5" fill={mood === "happy" ? "#00ff88" : "#00d4ff"} opacity="0.8"/>
      <circle cx="54" cy="62" r="2.5" fill={mood === "sad" ? "#ff3366" : "#1e2235"}/>

      {/* Arms */}
      <rect x="3" y={armLY} width="10" height="18" rx="4" fill="#0d0f1a" stroke="#1e2235" strokeWidth="1.5" transform={armLRot}/>
      <rect x="67" y={armRY} width="10" height="18" rx="4" fill="#0d0f1a" stroke="#1e2235" strokeWidth="1.5" transform={armRRot}/>

      {/* Hands — thumbs up on happy */}
      {mood === "happy" ? <>
        <text x="4" y="50" fontSize="8" fill={accentColor}>👍</text>
        <text x="64" y="50" fontSize="8" fill={accentColor}>👍</text>
      </> : <>
        <rect x="4" y="70" width="8" height="7" rx="3" fill="#1a1d2e" stroke="#1e2235" strokeWidth="1"/>
        <rect x="68" y="70" width="8" height="7" rx="3" fill="#1a1d2e" stroke="#1e2235" strokeWidth="1"/>
      </>}

      <rect x="14" y="58" width="52" height="1" rx="0.5" fill={accentColor} opacity="0.06"/>
    </svg>
  );
}

// ── Guide dialog bubble ───────────────────────────────────────────────────────
const GUIDE_MESSAGES: Record<Screen | "default", string> = {
  home:    "¡Hola! Soy BYTE, tu guía. ¿Listo para dominar la lógica binaria?",
  map:     "Elige un nodo para jugar. Los jefes son más difíciles... ¡yo creo en ti!",
  guide:   "¡Bien! Aquí aprenderás todo lo necesario. ¡No te saltes el XOR!",
  game:    "Recuerda: AND necesita ambos en 1. ¡Tú puedes!",
  gameover:"No pasa nada. Los errores son datos valiosos. ¡Reinténtalo!",
  levelup: "¡Subiste de nivel! Tu procesador lógico se ha actualizado.",
  default: "¡Piensa en binario!",
};

const CORRECT_MESSAGES = [
  "¡CORRECTO! ¡Eres un genio del bit! 🎉",
  "¡Perfecto! ¡Tu lógica es impecable!",
  "¡EXACTO! Procesamiento de datos: ÓPTIMO ⚡",
  "¡Bien hecho! ¡Los transistores se alegran!",
  "¡SIIIII! ¡Eso es lógica pura!",
  "¡Increíble! ¡Cada respuesta me hace más feliz!",
  "¡BOOM! ¡Respuesta correcta! ✓✓✓",
];

const STREAK_MESSAGES: Record<number, string> = {
  3: "¡RACHA x3! ¡Eres imparable! 🔥",
  5: "¡RACHA x5! ¡Eres una máquina! 💻",
  10: "¡RACHA x10! ¡MODO DIOS ACTIVADO! 👾",
};

const WRONG_MESSAGES = [
  "Hmm... no es esa. Recuerda la tabla de verdad.",
  "¡Casi! Los errores son datos. ¡Sigue intentando!",
  "Error detectado. ¡Recalculando estrategia!",
  "No te rindas. ¡Hasta los mejores se equivocan!",
  "¡Vaya! Ese bit se escapó. ¡A por el siguiente!",
  "Diagnóstico: pequeño fallo. Pronóstico: ¡éxito!",
];

const HINT_MESSAGES: Record<string, string> = {
  and:  "AND → ambas entradas deben ser 1 para dar 1.",
  or:   "OR → basta con que UNA sea 1.",
  xor:  "XOR → si son iguales da 0, distintas da 1.",
  not:  "NOT → solo invierte: 0 se convierte en 1 y viceversa.",
  nand: "NAND → es AND al revés: solo da 0 cuando ambas son 1.",
};

function GuideDialog({
  screen, onClose, mood = "idle", customMsg,
}: {
  screen: Screen; onClose: () => void; mood?: BotMood; customMsg?: string;
}) {
  const msg = customMsg ?? GUIDE_MESSAGES[screen] ?? GUIDE_MESSAGES.default;
  const borderColor = mood === "sad" ? "rgba(255,51,102,0.4)"
    : mood === "happy" ? "rgba(0,255,136,0.5)"
    : mood === "thinking" ? "rgba(0,212,255,0.35)"
    : "rgba(0,255,136,0.3)";
  return (
    <div className="flex items-end gap-3 px-5 py-3">
      <div className="flex-shrink-0" style={{ transition: "transform 0.3s", transform: mood === "happy" ? "translateY(-4px)" : mood === "sad" ? "translateY(2px)" : "none" }}>
        <GuideBot size={56} glow mood={mood} />
      </div>
      <div
        className="flex-1 relative px-4 py-3 rounded-lg text-sm leading-relaxed"
        style={{ background: "#0d0f1a", border: `1px solid ${borderColor}`, color: "#e8eaf0", fontFamily: "'JetBrains Mono'", transition: "border-color 0.3s" }}
      >
        <span style={{ position: "absolute", left: -8, bottom: 14, width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderRight: `8px solid ${borderColor}` }}/>
        <span style={{ position: "absolute", left: -6, bottom: 15, width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: "7px solid #0d0f1a" }}/>
        <p style={{ marginBottom: onClose ? 6 : 0 }}>{msg}</p>
        {onClose && (
          <button onClick={onClose} className="text-xs"
            style={{ color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono'", padding: 0 }}>
            [ OK, entendido ]
          </button>
        )}
      </div>
    </div>
  );
}

// ── Floating bits ─────────────────────────────────────────────────────────────
const FLOAT_BITS = ["0","1","0","1","1","0","0","1","1","0"];
function FloatingBits() {
  return (
    <div className="float-bits-container">
      {FLOAT_BITS.map((bit, i) => (
        <span
          key={i}
          className="float-bit"
          style={{
            left: `${8 + i * 9}%`,
            top: `${10 + ((i * 17) % 70)}%`,
            "--dur": `${5 + (i % 4)}s`,
            "--delay": `-${(i * 1.3).toFixed(1)}s`,
            opacity: 0.12 + (i % 3) * 0.05,
          } as React.CSSProperties}
        >
          {bit}
        </span>
      ))}
    </div>
  );
}

// ── HUD components ────────────────────────────────────────────────────────────
function Lives({ lives }: { lives: number }) {
  return (
    <div className="flex gap-1 items-center">
      {[0,1,2].map((i) => (
        <span
          key={i}
          className={`life-icon transition-all duration-300 ${i >= lives ? "lost" : ""}`}
          style={{ filter: i < lives ? "drop-shadow(0 0 4px #ff3366)" : "none" }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}

function XPBar({ xp, level }: { xp: number; level: number }) {
  const pct = Math.min(100, ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs" style={{ color: "#6b7280" }}>
        <span style={{ fontFamily: "'JetBrains Mono'" }}>LVL {level}</span>
        <span style={{ fontFamily: "'JetBrains Mono'" }}>{xp % XP_PER_LEVEL}/{XP_PER_LEVEL} XP</span>
      </div>
      <div className="xp-bar-track w-full">
        <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Gate diagram ──────────────────────────────────────────────────────────────
function GateDiagram({ puzzle }: { puzzle: Puzzle }) {
  const isUnary = puzzle.type === "not";
  return (
    <div className="panel flex flex-col items-center justify-center gap-4 py-6 px-4" style={{ minHeight: 160 }}>
      <div className="text-xs tracking-widest mb-1" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>
        GATE: {GATE_SYMBOLS[puzzle.type]}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-3 items-end">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#6b7280" }}>A</span>
            <div className="w-8 h-8 flex items-center justify-center rounded text-sm font-bold"
              style={{ background: puzzle.a === 1 ? "#00ff88" : "#1a1d2e", color: puzzle.a === 1 ? "#07080f" : "#e8eaf0", fontFamily: "'JetBrains Mono'", border: "1px solid #1e2235" }}>
              {puzzle.a}
            </div>
          </div>
          {!isUnary && puzzle.b !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#6b7280" }}>B</span>
              <div className="w-8 h-8 flex items-center justify-center rounded text-sm font-bold"
                style={{ background: puzzle.b === 1 ? "#00ff88" : "#1a1d2e", color: puzzle.b === 1 ? "#07080f" : "#e8eaf0", fontFamily: "'JetBrains Mono'", border: "1px solid #1e2235" }}>
                {puzzle.b}
              </div>
            </div>
          )}
        </div>
        <div className="px-4 py-3 flex items-center justify-center"
          style={{ border: "2px solid #00ff88", borderRadius: 6, minWidth: 64, background: "rgba(0,255,136,0.04)", boxShadow: "0 0 16px rgba(0,255,136,0.15)" }}>
          <span className="glow-green font-bold text-sm" style={{ color: "#00ff88", fontFamily: "'JetBrains Mono'" }}>
            {GATE_SYMBOLS[puzzle.type]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "#6b7280" }}>OUT</span>
          <div className="w-8 h-8 flex items-center justify-center rounded text-sm font-bold"
            style={{ border: "2px dashed #00d4ff", color: "#00d4ff", fontFamily: "'JetBrains Mono'", background: "rgba(0,212,255,0.05)" }}>
            ?
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Map screen ────────────────────────────────────────────────────────────────
function MapScreen({
  currentLevel,
  highScore,
  onSelectLevel,
  onHome,
}: {
  currentLevel: number;
  highScore: number;
  onSelectLevel: (level: number) => void;
  onHome: () => void;
}) {
  const [showGuide, setShowGuide] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 390, h: 700 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const nodePos = (n: MapNode) => ({
    cx: (n.x / 100) * dims.w,
    cy: (n.y / 100) * dims.h,
  });

  const unlocked = (id: number) => id <= currentLevel + 1;
  const completed = (id: number) => id < currentLevel;

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh", background: "#07080f" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 gap-3 flex-shrink-0">
        <button className="btn-outline px-3 py-1.5 text-xs rounded" onClick={onHome}>← MENÚ</button>
        <span className="text-xs glow-green" style={{ color: "#00ff88", fontFamily: "'JetBrains Mono'" }}>
          MAPA DE NIVELES
        </span>
        <span className="text-xs" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>
          {highScore} XP
        </span>
      </div>

      {/* Guide dialog */}
      {showGuide && (
        <div className="flex-shrink-0">
          <GuideDialog screen="map" onClose={() => setShowGuide(false)} />
        </div>
      )}

      {/* Map canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        style={{ minHeight: 480 }}
      >
        {/* Background grid dots */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height="100%"
          style={{ opacity: 0.08 }}
        >
          <defs>
            <pattern id="dot" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="14" cy="14" r="1" fill="#00ff88" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot)" />
        </svg>

        {/* SVG for edges */}
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
          {MAP_EDGES.map(([aId, bId]) => {
            const a = MAP_NODES.find((n) => n.id === aId)!;
            const b = MAP_NODES.find((n) => n.id === bId)!;
            const pa = nodePos(a);
            const pb = nodePos(b);
            const done = completed(bId);
            const avail = unlocked(bId);
            // Bezier control point
            const mx = (pa.cx + pb.cx) / 2 + (aId % 2 === 0 ? 20 : -20);
            const my = (pa.cy + pb.cy) / 2;
            return (
              <g key={`${aId}-${bId}`}>
                {/* shadow track */}
                <path
                  d={`M ${pa.cx} ${pa.cy} Q ${mx} ${my} ${pb.cx} ${pb.cy}`}
                  stroke="#1e2235"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* active track */}
                <path
                  d={`M ${pa.cx} ${pa.cy} Q ${mx} ${my} ${pb.cx} ${pb.cy}`}
                  stroke={done ? "#00ff88" : avail ? "#1e2235" : "#141626"}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={done ? "none" : "8 6"}
                  opacity={done ? 0.7 : 0.5}
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {MAP_NODES.map((node) => {
          const { cx, cy } = nodePos(node);
          const done = completed(node.id);
          const avail = unlocked(node.id);
          const isCurrent = node.id === currentLevel;
          const isBoss = node.type === "boss";

          const r = isBoss ? 34 : 28;

          return (
            <button
              key={node.id}
              disabled={!avail}
              onClick={() => avail && onSelectLevel(node.id)}
              style={{
                position: "absolute",
                left: cx - r,
                top: cy - r,
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                background: done
                  ? "#00ff88"
                  : isCurrent
                    ? "#0d1f14"
                    : avail
                      ? "#0d0f1a"
                      : "#0a0b12",
                border: done
                  ? "3px solid #00ff88"
                  : isCurrent
                    ? "3px solid #00ff88"
                    : avail
                      ? `3px solid ${isBoss ? "#ff3366" : "#1e2235"}`
                      : "2px solid #141626",
                boxShadow: done
                  ? "0 0 14px rgba(0,255,136,0.45)"
                  : isCurrent
                    ? "0 0 20px rgba(0,255,136,0.6)"
                    : isBoss && avail
                      ? "0 0 10px rgba(255,51,102,0.35)"
                      : "none",
                cursor: avail ? "pointer" : "default",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                transition: "all 0.2s",
                padding: 0,
              }}
            >
              {done ? (
                <span style={{ fontSize: isBoss ? "1.1rem" : "0.9rem", color: "#07080f" }}>✓</span>
              ) : (
                <>
                  <span
                    style={{
                      fontSize: isBoss ? "0.55rem" : "0.5rem",
                      fontFamily: "'JetBrains Mono'",
                      color: avail ? (isBoss ? "#ff3366" : "#00d4ff") : "#2a2d3e",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      lineHeight: 1.2,
                    }}
                  >
                    {node.gate}
                  </span>
                  <span
                    style={{
                      fontSize: "0.45rem",
                      fontFamily: "'JetBrains Mono'",
                      color: avail ? "#6b7280" : "#2a2d3e",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {avail ? node.label : "🔒"}
                  </span>
                </>
              )}

              {/* Pulse ring for current */}
              {isCurrent && (
                <span
                  style={{
                    position: "absolute",
                    inset: -6,
                    borderRadius: "50%",
                    border: "2px solid rgba(0,255,136,0.4)",
                    animation: "pulse-ring 1.8s ease-in-out infinite",
                    pointerEvents: "none",
                  }}
                />
              )}
            </button>
          );
        })}

        {/* Level label tooltips — show for unlocked */}
        {MAP_NODES.map((node) => {
          const { cx, cy } = nodePos(node);
          const avail = unlocked(node.id);
          if (!avail) return null;
          const r = node.type === "boss" ? 34 : 28;
          return (
            <span
              key={`lbl-${node.id}`}
              style={{
                position: "absolute",
                left: cx,
                top: cy + r + 5,
                transform: "translateX(-50%)",
                fontFamily: "'JetBrains Mono'",
                fontSize: "0.5rem",
                color: node.type === "boss" ? "#ff3366" : "#6b7280",
                letterSpacing: "0.06em",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              {node.label}
            </span>
          );
        })}
      </div>

      {/* Bottom legend */}
      <div
        className="flex justify-center gap-5 px-5 py-3 flex-shrink-0"
        style={{ borderTop: "1px solid #1e2235" }}
      >
        {[
          { color: "#00ff88", label: "Completado" },
          { color: "#00d4ff", label: "Disponible" },
          { color: "#ff3366", label: "Jefe" },
          { color: "#2a2d3e", label: "Bloqueado" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            <span style={{ fontSize: "0.55rem", color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Home screen ───────────────────────────────────────────────────────────────
function HomeScreen({
  onPlay,
  onGuide,
  onMap,
  highScore,
}: {
  onPlay: () => void;
  onGuide: () => void;
  onMap: () => void;
  highScore: number;
}) {
  const [showGuide, setShowGuide] = useState(true);
  return (
    <div className="relative flex flex-col items-center justify-between px-6 py-10" style={{ minHeight: "100dvh" }}>
      <FloatingBits />
      <div className="flex flex-col items-center gap-2 mt-8">
        <div className="text-xs tracking-widest mb-2" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>
          &gt; SYSTEM INIT...
        </div>
        <h1 className="glow-green font-extrabold text-center leading-none"
          style={{ fontFamily: "'JetBrains Mono'", fontSize: "clamp(2.4rem,10vw,3.2rem)", color: "#00ff88", letterSpacing: "-0.02em" }}>
          BIT<br />LOGIC
        </h1>
        <div className="text-xs tracking-widest mt-2 cursor-blink" style={{ color: "#00d4ff", fontFamily: "'JetBrains Mono'" }}>
          BINARY PUZZLE ENGINE
        </div>
      </div>

      {/* Guide bot */}
      <div className="flex flex-col items-center gap-0 w-full max-w-xs">
        <div style={{ animation: "flicker 8s infinite" }}>
          <GuideBot size={90} glow />
        </div>
        {showGuide && (
          <GuideDialog screen="home" onClose={() => setShowGuide(false)} />
        )}
        {highScore > 0 && !showGuide && (
          <div className="text-xs text-center mt-3" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>
            HIGH SCORE: <span style={{ color: "#00d4ff" }}>{highScore} XP</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs pb-4">
        <button className="btn-primary py-4 rounded text-sm tracking-widest w-full" onClick={onPlay}>
          [ INICIAR JUEGO ]
        </button>
        <button className="btn-outline py-3 rounded text-sm tracking-widest w-full" onClick={onMap}>
          [ MAPA DE NIVELES ]
        </button>
        <button className="btn-outline py-3 rounded text-sm tracking-widest w-full" onClick={onGuide}>
          [ GUÍA ]
        </button>
      </div>
    </div>
  );
}

// ── Guide screen ──────────────────────────────────────────────────────────────
function GuideScreen({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState(0);
  const pages = [
    {
      title: "¿QUÉ ES LÓGICA BINARIA?", icon: "01",
      content: ["En binario solo existen dos valores:", "0 = FALSO / APAGADO", "1 = VERDADERO / ENCENDIDO", "Las compuertas lógicas combinan estos valores."],
      table: null,
    },
    {
      title: "COMPUERTA AND", icon: "∧",
      content: ["Salida = 1 solo si AMBAS entradas son 1.", "Es como una puerta que necesita dos llaves."],
      table: [["A","B","OUT"],["0","0","0"],["0","1","0"],["1","0","0"],["1","1","1"]],
    },
    {
      title: "COMPUERTA OR", icon: "∨",
      content: ["Salida = 1 si AL MENOS UNA entrada es 1.", "Basta con una llave para abrir la puerta."],
      table: [["A","B","OUT"],["0","0","0"],["0","1","1"],["1","0","1"],["1","1","1"]],
    },
    {
      title: "XOR · NOT · NAND", icon: "⊕",
      content: ["XOR: entradas distintas → 1", "NOT: invierte el valor (0→1, 1→0)", "NAND: AND invertido"],
      table: [["A","B","XOR"],["0","0","0"],["0","1","1"],["1","0","1"],["1","1","0"]],
    },
    {
      title: "REGLAS DEL JUEGO", icon: "⚙",
      content: ["♥ Tienes 3 VIDAS", "Un error quita 1 vida", "Gana XP por cada acierto (+20)", "Racha de 2+ da +10 XP bonus", "Sube de nivel cada 100 XP"],
      table: null,
    },
  ];
  const cur = pages[page];
  return (
    <div className="relative flex flex-col px-5 py-8 gap-5" style={{ minHeight: "100dvh", background: "#07080f" }}>
      <div className="flex items-center gap-3">
        <button className="btn-outline px-3 py-1.5 text-xs rounded" onClick={onBack}>← VOLVER</button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <GuideBot size={32} />
          <span className="text-xs" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>BYTE — GUÍA</span>
        </div>
      </div>
      <div className="flex gap-1.5 justify-center">
        {pages.map((_, i) => (
          <button key={i} onClick={() => setPage(i)}
            style={{ width: i === page ? 24 : 8, height: 4, borderRadius: 2, background: i === page ? "#00ff88" : "#1e2235", border: "none", cursor: "pointer", transition: "all 0.2s" }} />
        ))}
      </div>
      <div className="panel flex-1 flex flex-col gap-5 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 flex items-center justify-center rounded"
            style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.3)", color: "#00ff88", fontSize: "1.5rem", fontFamily: "'JetBrains Mono'" }}>
            {cur.icon}
          </div>
          <h2 className="glow-green font-bold text-sm leading-tight" style={{ color: "#00ff88", fontFamily: "'JetBrains Mono'" }}>
            {cur.title}
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          {cur.content.map((line, i) => (
            <p key={i} className="text-sm leading-relaxed"
              style={{ color: "#9ca3af", fontFamily: "'JetBrains Mono'" }}>
              {line}
            </p>
          ))}
        </div>
        {cur.table && (
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>{cur.table[0].map((h) => (
                <th key={h} className="py-1.5 px-2 text-center"
                  style={{ color: "#00d4ff", fontFamily: "'JetBrains Mono'", borderBottom: "1px solid #1e2235" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {cur.table.slice(1).map((row, i) => (
                <tr key={i}>{row.map((cell, j) => (
                  <td key={j} className="py-2 px-2 text-center"
                    style={{
                      fontFamily: "'JetBrains Mono'",
                      color: cell === "1" ? "#00ff88" : cell === "0" ? "#6b7280" : "#e8eaf0",
                      fontWeight: cell === "1" ? "700" : "400",
                      background: j === 2 && cell === "1" ? "rgba(0,255,136,0.06)" : "transparent",
                    }}>{cell}</td>
                ))}</tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex gap-3">
        <button className="btn-outline flex-1 py-3 text-xs rounded" onClick={() => setPage((p) => Math.max(0, p - 1))}
          style={{ opacity: page === 0 ? 0.3 : 1 }} disabled={page === 0}>← ANTERIOR</button>
        {page < pages.length - 1
          ? <button className="btn-primary flex-1 py-3 text-xs rounded" onClick={() => setPage((p) => p + 1)}>SIGUIENTE →</button>
          : <button className="btn-primary flex-1 py-3 text-xs rounded" onClick={onBack}>¡JUGAR! →</button>}
      </div>
    </div>
  );
}

// ── Game screen ───────────────────────────────────────────────────────────────
function GameScreen({ onGameOver, onLevelUp, onMap }: {
  onGameOver: (xp: number) => void;
  onLevelUp: (level: number, xp: number, cb: () => void) => void;
  onMap: () => void;
}) {
  const [lives, setLives] = useState(3);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [puzzle, setPuzzle] = useState(() => generatePuzzle(1));
  const [selected, setSelected] = useState<0 | 1 | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [shakeHud, setShakeHud] = useState(false);
  const [questionNum, setQuestionNum] = useState(1);
  const [showGuide, setShowGuide] = useState(false);
  const [guideMood, setGuideMood] = useState<BotMood>("idle");
  const [guideMsg, setGuideMsg] = useState<string>(GUIDE_MESSAGES.game);

  const nextPuzzle = useCallback((currentLevel: number) => {
    setSelected(null); setFeedback(null);
    setPuzzle(generatePuzzle(currentLevel));
    setQuestionNum((q) => q + 1);
    setGuideMood("idle");
    setShowGuide(false);
  }, []);

  const toggleHint = () => {
    if (!showGuide) {
      setGuideMood("thinking");
      setGuideMsg(HINT_MESSAGES[puzzle.type] ?? GUIDE_MESSAGES.game);
    }
    setShowGuide((v) => !v);
  };

  const handleAnswer = (answer: 0 | 1) => {
    if (feedback !== null) return;
    setSelected(answer);
    const correct = answer === puzzle.answer;
    if (correct) {
      setFeedback("correct");
      const newStreakCount = streak + 1;
      const streakMsg = STREAK_MESSAGES[newStreakCount];
      setGuideMood("happy");
      setGuideMsg(streakMsg ?? CORRECT_MESSAGES[Math.floor(Math.random() * CORRECT_MESSAGES.length)]);
      setShowGuide(true);
      const gained = XP_PER_CORRECT + (streak >= 2 ? 10 : 0);
      const newXp = xp + gained;
      setScore((s) => s + gained);
      setStreak((s) => s + 1);
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;
      setXp(newXp);
      if (newLevel > level) {
        setLevel(newLevel);
        setTimeout(() => onLevelUp(newLevel, newXp, () => nextPuzzle(newLevel)), 600);
      } else {
        setTimeout(() => nextPuzzle(level), 900);
      }
    } else {
      setFeedback("wrong");
      setGuideMood("sad");
      setGuideMsg(WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)]);
      setShowGuide(true);
      const newXp = Math.max(0, xp + XP_PER_WRONG);
      setXp(newXp);
      setStreak(0);
      const newLives = lives - 1;
      setLives(newLives);
      setShakeHud(true);
      setTimeout(() => setShakeHud(false), 500);
      if (newLives <= 0) setTimeout(() => onGameOver(score), 1100);
      else setTimeout(() => nextPuzzle(level), 1100);
    }
  };

  return (
    <div className="flex flex-col px-5 pt-5 pb-8 gap-4" style={{ minHeight: "100dvh", background: "#07080f" }}>
      <div className="flex items-center justify-between">
        <button className="btn-outline px-3 py-1.5 text-xs rounded" onClick={onMap}>[ MAPA ]</button>
        <span className="text-xs" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>NIVEL {level}</span>
      </div>

      <div className={`panel p-4 flex flex-col gap-3 ${shakeHud ? "shake" : ""}`}>
        <div className="flex items-center justify-between">
          <Lives lives={lives} />
          <button onClick={toggleHint} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <GuideBot size={28} mood={guideMood} glow={showGuide} />
          </button>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>PUNTOS</span>
            <span className="font-bold text-base" style={{ color: "#00d4ff", fontFamily: "'JetBrains Mono'" }}>{score}</span>
          </div>
        </div>
        <XPBar xp={xp} level={level} />
        <div className="flex justify-between text-xs" style={{ color: "#6b7280" }}>
          <span style={{ fontFamily: "'JetBrains Mono'" }}>Q-{String(questionNum).padStart(3, "0")}</span>
          {streak >= 2 && <span className="glow-cyan" style={{ color: "#00d4ff", fontFamily: "'JetBrains Mono'" }}>⚡ RACHA ×{streak}</span>}
        </div>
      </div>

      {showGuide && (
        <GuideDialog screen="game" mood={guideMood} customMsg={guideMsg} onClose={() => setShowGuide(false)} />
      )}

      <div className="flex flex-col gap-1">
        <p className="text-xs tracking-widest" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>&gt; CALCULA LA SALIDA:</p>
        <p className="text-xl font-bold glow-green" style={{ color: "#00ff88", fontFamily: "'JetBrains Mono'" }}>{puzzle.description}</p>
      </div>

      <GateDiagram puzzle={puzzle} />

      <div className="h-8 flex items-center justify-center rounded text-xs font-bold tracking-wider"
        style={{
          background: feedback === "correct" ? "rgba(0,255,136,0.12)" : feedback === "wrong" ? "rgba(255,51,102,0.12)" : "transparent",
          border: feedback === "correct" ? "1px solid rgba(0,255,136,0.4)" : feedback === "wrong" ? "1px solid rgba(255,51,102,0.4)" : "1px solid transparent",
          color: feedback === "correct" ? "#00ff88" : feedback === "wrong" ? "#ff3366" : "transparent",
          fontFamily: "'JetBrains Mono'", transition: "all 0.2s",
        }}>
        {feedback === "correct" ? `✓ CORRECTO  +${XP_PER_CORRECT + (streak > 1 ? 10 : 0)} XP`
          : feedback === "wrong" ? `✗ INCORRECTO  La respuesta era ${puzzle.answer}`
          : "."}
      </div>

      <div className="flex gap-4 justify-center mt-2">
        {([0, 1] as const).map((val) => (
          <button key={val}
            className={`bit-btn ${selected === val ? (val === puzzle.answer ? "selected-1" : "selected-0") : ""}`}
            onClick={() => handleAnswer(val)} disabled={feedback !== null}>
            {val}
          </button>
        ))}
      </div>

      <div className="panel py-3 px-4 text-xs text-center mt-auto" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>
        {puzzle.type === "and" && "AND → ambas entradas deben ser 1"}
        {puzzle.type === "or" && "OR → al menos una entrada debe ser 1"}
        {puzzle.type === "xor" && "XOR → entradas distintas → 1"}
        {puzzle.type === "not" && "NOT → invierte: 0→1, 1→0"}
        {puzzle.type === "nand" && "NAND → AND invertido"}
      </div>
    </div>
  );
}

// ── Level up ──────────────────────────────────────────────────────────────────
function LevelUpScreen({ level, xp, onContinue }: { level: number; xp: number; onContinue: () => void }) {
  const unlockedGates: Record<number, string> = { 3: "XOR desbloqueado", 5: "NOT y NAND desbloqueados" };
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-6 gap-8 z-50"
      style={{ background: "rgba(7,8,15,0.97)" }}>
      <GuideBot size={80} glow />
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs tracking-widest" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>BYTE DICE:</div>
        <p className="text-sm text-center" style={{ color: "#e8eaf0", fontFamily: "'JetBrains Mono'", maxWidth: 260 }}>
          {GUIDE_MESSAGES.levelup}
        </p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="text-6xl font-extrabold glow-green" style={{ color: "#00ff88", fontFamily: "'JetBrains Mono'" }}>LVL</div>
        <div className="font-extrabold glow-green" style={{ color: "#00ff88", fontFamily: "'JetBrains Mono'", fontSize: "5rem", lineHeight: 1 }}>{level}</div>
      </div>
      {unlockedGates[level] && (
        <div className="panel py-3 px-5 text-center text-xs" style={{ color: "#00d4ff", fontFamily: "'JetBrains Mono'", borderColor: "rgba(0,212,255,0.3)" }}>
          🔓 {unlockedGates[level]}
        </div>
      )}
      <div className="text-sm text-center" style={{ color: "#9ca3af", fontFamily: "'JetBrains Mono'" }}>
        XP total: <span style={{ color: "#00ff88" }}>{xp}</span>
      </div>
      <button className="btn-primary py-4 px-10 rounded text-sm tracking-widest" onClick={onContinue}>CONTINUAR →</button>
    </div>
  );
}

// ── Game over ─────────────────────────────────────────────────────────────────
function GameOverScreen({ xp, highScore, onRestart, onHome }: { xp: number; highScore: number; onRestart: () => void; onHome: () => void; }) {
  const isHighScore = xp >= highScore;
  return (
    <div className="relative flex flex-col items-center justify-between px-6 py-10" style={{ minHeight: "100dvh", background: "#07080f" }}>
      <FloatingBits />
      <div />
      <div className="flex flex-col items-center gap-6 w-full max-w-xs">
        <GuideDialog screen="gameover" onClose={() => {}} />
        <div className="glow-danger font-extrabold text-center"
          style={{ color: "#ff3366", fontFamily: "'JetBrains Mono'", fontSize: "clamp(2.4rem,10vw,3.2rem)", letterSpacing: "-0.02em" }}>
          GAME<br />OVER
        </div>
        <div className="panel w-full flex flex-col gap-4 p-5">
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>XP GANADO</span>
            <span className="font-bold text-lg" style={{ color: "#00d4ff", fontFamily: "'JetBrains Mono'" }}>{xp}</span>
          </div>
          <div className="w-full" style={{ height: 1, background: "#1e2235" }} />
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: "#6b7280", fontFamily: "'JetBrains Mono'" }}>MEJOR MARCA</span>
            <span className="font-bold text-lg" style={{ color: isHighScore ? "#00ff88" : "#e8eaf0", fontFamily: "'JetBrains Mono'" }}>
              {Math.max(xp, highScore)}{isHighScore && <span className="text-xs ml-1 glow-green" style={{ color: "#00ff88" }}> NEW!</span>}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs pb-4">
        <button className="btn-primary py-4 rounded text-sm tracking-widest w-full" onClick={onRestart}>[ REINTENTAR ]</button>
        <button className="btn-outline py-3 rounded text-sm tracking-widest w-full" onClick={onHome}>[ MENÚ PRINCIPAL ]</button>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [gameKey, setGameKey] = useState(0);
  const [finalXp, setFinalXp] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [levelUpData, setLevelUpData] = useState<{ level: number; xp: number; cb: () => void } | null>(null);

  const handleGameOver = (xp: number) => {
    setFinalXp(xp);
    setHighScore((prev) => Math.max(prev, xp));
    setScreen("gameover");
  };

  const handleLevelUp = (level: number, xp: number, cb: () => void) => {
    setCurrentLevel(level);
    setLevelUpData({ level, xp, cb });
    setScreen("levelup");
  };

  const handleLevelUpContinue = () => {
    const cb = levelUpData?.cb;
    setLevelUpData(null);
    setScreen("game");
    cb?.();
  };

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100dvh", position: "relative", background: "#07080f" }}>
      <div className="scanline-overlay" />
      {screen === "home" && (
        <HomeScreen
          onPlay={() => { setGameKey((k) => k + 1); setScreen("game"); }}
          onGuide={() => setScreen("guide")}
          onMap={() => setScreen("map")}
          highScore={highScore}
        />
      )}
      {screen === "guide" && <GuideScreen onBack={() => setScreen("home")} />}
      {screen === "map" && (
        <MapScreen
          currentLevel={currentLevel}
          highScore={highScore}
          onSelectLevel={(lvl) => { setGameKey((k) => k + 1); setCurrentLevel(lvl); setScreen("game"); }}
          onHome={() => setScreen("home")}
        />
      )}
      {screen === "game" && (
        <GameScreen key={gameKey} onGameOver={handleGameOver} onLevelUp={handleLevelUp} onMap={() => setScreen("map")} />
      )}
      {screen === "levelup" && levelUpData && (
        <LevelUpScreen level={levelUpData.level} xp={levelUpData.xp} onContinue={handleLevelUpContinue} />
      )}
      {screen === "gameover" && (
        <GameOverScreen xp={finalXp} highScore={highScore} onRestart={() => { setGameKey((k) => k + 1); setScreen("game"); }} onHome={() => setScreen("home")} />
      )}
    </div>
  );
}
