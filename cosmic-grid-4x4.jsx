import { useState, useEffect, useCallback, useRef } from "react";

// ── Rule table: 4-bit input → 4-bit output ────────────────────────────────
// Index = (ix+ iy+ ix- iy-) as 4-bit binary (ix+ is MSB)
// Identity rule: output = input
function createIdentityRule() {
  return Array.from({ length: 16 }, (_, i) => i);
}

function createOddEvenRule() {
  return Array.from({ length: 16 }, (_, idx) => {
    let ones = 0;
    for (let bit = 0; bit < 4; bit++) {
      ones += (idx >> bit) & 1;
    }
    return ones % 2 === 1 ? 0b1111 : 0b0000;
  });
}

const RULE_PRESETS = [
  {
    id: "identity",
    label: "Identity",
    description: "Output equals input for each row.",
    build: createIdentityRule,
  },
  {
    id: "odd-even",
    label: "Odd-Even",
    description: "Odd count of 1s -> 1111, even -> 0000.",
    build: createOddEvenRule,
  },
];

const DEFAULT_RULE = createIdentityRule();

const GRID = 10; // grid size
const CELL = 54; // px per cell
const R = 18;    // node circle radius

// Signal colors
const SIG_COLOR = {
  "ox+": "#00e5ff",  // cyan   – left→right
  "oy+": "#69ff47",  // green  – top→bottom
  "ox-": "#ff4081",  // pink   – right→left
  "oy-": "#ffab40",  // amber  – bottom→top
};

const SIG_LABELS = ["ox+", "oy+", "ox-", "oy-"];

function makeEmpty() {
  return Array.from({ length: GRID }, () =>
    Array.from({ length: GRID }, () => ({ "ox+": 0, "oy+": 0, "ox-": 0, "oy-": 0 }))
  );
}

function step(grid, rule) {
  const next = makeEmpty();
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      // Gather inputs from neighbours (toroidal)
      const ixp = grid[r][(c - 1 + GRID) % GRID]["ox+"];  // left  neighbour's ox+
      const ixm = grid[r][(c + 1) % GRID]["ox-"];          // right neighbour's ox-
      const iyp = grid[(r - 1 + GRID) % GRID][c]["oy+"];   // top   neighbour's oy+
      const iym = grid[(r + 1) % GRID][c]["oy-"];           // bottom neighbour's oy-

      // bit order: ix+ iy+ ix- iy-
      const idx = (ixp << 3) | (iyp << 2) | (ixm << 1) | iym;
      const out = rule[idx];

      // output bit order: ox+ oy+ ox- oy-
      next[r][c] = {
        "ox+": (out >> 3) & 1,
        "oy+": (out >> 2) & 1,
        "ox-": (out >> 1) & 1,
        "oy-":  out       & 1,
      };
    }
  }
  return next;
}

// ── SVG drawing helpers ───────────────────────────────────────────────────
// Each cell: centre at (cx, cy)
// Output signals rendered INSIDE the circle as small directional arrows/lines
// Input signals are drawn as short stubs OUTSIDE the circle on the edge side

function NodeSignals({ cx, cy, outputs }) {
  const segments = [];
  const off = R * 0.55;

  // ox+ (right-going): horizontal line right of centre inside circle
  if (outputs["ox+"]) {
    segments.push(
      <line key="oxp" x1={cx} y1={cy} x2={cx + off} y2={cy}
        stroke={SIG_COLOR["ox+"]} strokeWidth={2.5} strokeLinecap="round" />,
      <polygon key="oxp-arr"
        points={`${cx + off},${cy - 3} ${cx + off + 5},${cy} ${cx + off},${cy + 3}`}
        fill={SIG_COLOR["ox+"]} />
    );
  }
  // ox- (left-going)
  if (outputs["ox-"]) {
    segments.push(
      <line key="oxm" x1={cx} y1={cy} x2={cx - off} y2={cy}
        stroke={SIG_COLOR["ox-"]} strokeWidth={2.5} strokeLinecap="round" />,
      <polygon key="oxm-arr"
        points={`${cx - off},${cy - 3} ${cx - off - 5},${cy} ${cx - off},${cy + 3}`}
        fill={SIG_COLOR["ox-"]} />
    );
  }
  // oy+ (down-going)
  if (outputs["oy+"]) {
    segments.push(
      <line key="oyp" x1={cx} y1={cy} x2={cx} y2={cy + off}
        stroke={SIG_COLOR["oy+"]} strokeWidth={2.5} strokeLinecap="round" />,
      <polygon key="oyp-arr"
        points={`${cx - 3},${cy + off} ${cx},${cy + off + 5} ${cx + 3},${cy + off}`}
        fill={SIG_COLOR["oy+"]} />
    );
  }
  // oy- (up-going)
  if (outputs["oy-"]) {
    segments.push(
      <line key="oym" x1={cx} y1={cy} x2={cx} y2={cy - off}
        stroke={SIG_COLOR["oy-"]} strokeWidth={2.5} strokeLinecap="round" />,
      <polygon key="oym-arr"
        points={`${cx - 3},${cy - off} ${cx},${cy - off - 5} ${cx + 3},${cy - off}`}
        fill={SIG_COLOR["oy-"]} />
    );
  }
  return <>{segments}</>;
}

// Input stubs: short ticks at cell border showing incoming signals
function InputStubs({ cx, cy, inputs }) {
  const stubs = [];
  const edgeOff = CELL / 2 - 4;
  const stubLen = 7;

  if (inputs.ixp) { // arriving from left
    stubs.push(
      <line key="ixp"
        x1={cx - edgeOff} y1={cy}
        x2={cx - edgeOff + stubLen} y2={cy}
        stroke={SIG_COLOR["ox+"]} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
    );
  }
  if (inputs.ixm) { // arriving from right
    stubs.push(
      <line key="ixm"
        x1={cx + edgeOff} y1={cy}
        x2={cx + edgeOff - stubLen} y2={cy}
        stroke={SIG_COLOR["ox-"]} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
    );
  }
  if (inputs.iyp) { // arriving from top
    stubs.push(
      <line key="iyp"
        x1={cx} y1={cy - edgeOff}
        x2={cx} y2={cy - edgeOff + stubLen}
        stroke={SIG_COLOR["oy+"]} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
    );
  }
  if (inputs.iym) { // arriving from bottom
    stubs.push(
      <line key="iym"
        x1={cx} y1={cy + edgeOff}
        x2={cx} y2={cy + edgeOff - stubLen}
        stroke={SIG_COLOR["oy-"]} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
    );
  }
  return <>{stubs}</>;
}

// ── Rule editor ───────────────────────────────────────────────────────────
const INPUT_LABELS = ["ix+", "iy+", "ix-", "iy-"];
const OUTPUT_LABELS = ["ox+", "oy+", "ox-", "oy-"];
const SIG_ORDER = ["ox+", "oy+", "ox-", "oy-"];

function rulesEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getPresetForRule(rule) {
  for (const preset of RULE_PRESETS) {
    if (rulesEqual(rule, preset.build())) {
      return preset;
    }
  }
  return null;
}

function SettingsPanel({ activePresetId, onSelectPreset }) {
  return (
    <div style={{
      background: "#0d1117",
      border: "1px solid #30363d",
      borderRadius: 8,
      padding: "12px 14px",
      fontSize: 11,
      fontFamily: "monospace",
      color: "#c9d1d9",
      minWidth: 310,
      maxWidth: 360
    }}>
      <div style={{ color: "#8b949e", marginBottom: 10, fontSize: 10, letterSpacing: 1 }}>
        SETTINGS · PREDEFINED RULES
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {RULE_PRESETS.map((preset) => {
          const active = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
              style={{
                textAlign: "left",
                background: active ? "#132334" : "#0d1117",
                border: `1px solid ${active ? "#58a6ff" : "#30363d"}`,
                color: active ? "#58a6ff" : "#c9d1d9",
                borderRadius: 6,
                padding: "8px 10px",
                cursor: "pointer"
              }}
            >
              <div style={{ fontWeight: 700, letterSpacing: 0.5 }}>
                {active ? "● " : "○ "}
                {preset.label}
              </div>
              <div style={{ marginTop: 3, color: "#8b949e", fontSize: 10 }}>
                {preset.description}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 10, color: "#8b949e", fontSize: 10 }}>
        Active preset:{" "}
        <span style={{ color: "#c9d1d9" }}>
          {RULE_PRESETS.find((p) => p.id === activePresetId)?.label ?? "Custom"}
        </span>
      </div>
    </div>
  );
}

function RuleEditor({ rule, onRuleChange }) {
  return (
    <div style={{
      background: "#0d1117", border: "1px solid #30363d",
      borderRadius: 8, padding: "10px 14px", fontSize: 11,
      fontFamily: "monospace", color: "#c9d1d9", maxHeight: 320,
      overflowY: "auto", minWidth: 310
    }}>
      <div style={{ color: "#8b949e", marginBottom: 8, fontSize: 10, letterSpacing: 1 }}>
        RULE TABLE  (click output bits to toggle)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto auto", gap: "2px 10px", alignItems: "center" }}>
        <span style={{ color: "#8b949e", fontSize: 10 }}>IN (ix+ iy+ ix- iy-)</span>
        <span style={{ color: "#8b949e", fontSize: 10 }}>→</span>
        <span style={{ color: "#8b949e", fontSize: 10 }}>OUT (ox+ oy+ ox- oy-)</span>
        {rule.map((out, idx) => {
          const inBits = [(idx >> 3) & 1, (idx >> 2) & 1, (idx >> 1) & 1, idx & 1];
          const outBits = [(out >> 3) & 1, (out >> 2) & 1, (out >> 1) & 1, out & 1];
          return (
            <>
              <span key={`in${idx}`} style={{ color: "#58a6ff" }}>
                {inBits.map((b, i) => (
                  <span key={i} style={{ color: b ? SIG_COLOR[SIG_ORDER[i]] : "#30363d", marginRight: 3 }}>{b}</span>
                ))}
              </span>
              <span key={`arr${idx}`} style={{ color: "#30363d" }}>→</span>
              <span key={`out${idx}`}>
                {outBits.map((b, i) => (
                  <span
                    key={i}
                    onClick={() => {
                      const newRule = [...rule];
                      newRule[idx] = out ^ (1 << (3 - i));
                      onRuleChange(newRule);
                    }}
                    style={{
                      color: b ? SIG_COLOR[SIG_ORDER[i]] : "#30363d",
                      cursor: "pointer", marginRight: 3,
                      fontWeight: b ? "bold" : "normal",
                      textShadow: b ? `0 0 6px ${SIG_COLOR[SIG_ORDER[i]]}` : "none"
                    }}
                  >{b}</span>
                ))}
              </span>
            </>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function CosmicGrid4x4() {
  const [grid, setGrid] = useState(makeEmpty);
  const [rule, setRule] = useState(DEFAULT_RULE);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState(300);
  const [showRule, setShowRule] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [paintSig, setPaintSig] = useState("ox+");
  const [paintVal, setPaintVal] = useState(1);
  const intervalRef = useRef(null);
  const activePreset = getPresetForRule(rule);

  const applyPreset = useCallback((presetId) => {
    const preset = RULE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setRule(preset.build());
  }, []);

  const advance = useCallback(() => {
    setGrid(g => step(g, rule));
    setTick(t => t + 1);
  }, [rule]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(advance, speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, advance, speed]);

  const toggleCell = (r, c) => {
    setGrid(g => {
      const next = g.map(row => row.map(cell => ({ ...cell })));
      next[r][c][paintSig] = paintVal;
      return next;
    });
  };

  const reset = () => { setGrid(makeEmpty()); setTick(0); setRunning(false); };

  const randomize = () => {
    setGrid(Array.from({ length: GRID }, () =>
      Array.from({ length: GRID }, () => ({
        "ox+": Math.random() > 0.7 ? 1 : 0,
        "oy+": Math.random() > 0.7 ? 1 : 0,
        "ox-": Math.random() > 0.7 ? 1 : 0,
        "oy-": Math.random() > 0.7 ? 1 : 0,
      }))
    ));
    setTick(0);
  };

  const SVG_SIZE = GRID * CELL + 2;

  return (
    <div style={{
      background: "#060a0f",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "24px 16px",
      fontFamily: "'Courier New', monospace",
      color: "#c9d1d9"
    }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          fontSize: 22, fontWeight: 700, letterSpacing: 3,
          color: "#e6edf3", textTransform: "uppercase",
          textShadow: "0 0 20px #00e5ff44"
        }}>Cosmic Grid · 4×4</div>
        <div style={{ fontSize: 11, color: "#8b949e", letterSpacing: 2, marginTop: 4 }}>
          TOROIDAL · {GRID}×{GRID} · TICK {tick}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 18, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          ["ox+", "left → right"],
          ["oy+", "top → bottom"],
          ["ox-", "right → left"],
          ["oy-", "bottom → top"],
        ].map(([k, label]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: SIG_COLOR[k], boxShadow: `0 0 6px ${SIG_COLOR[k]}` }} />
            <span style={{ fontSize: 11, color: "#8b949e" }}><span style={{ color: SIG_COLOR[k] }}>{k}</span> {label}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#8b949e" }}>
          ● outputs inside circle &nbsp;|&nbsp; – inputs at border
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
        <button onClick={() => setRunning(r => !r)} style={btnStyle(running ? "#ff4081" : "#00e5ff")}>
          {running ? "⏸ Pause" : "▶ Run"}
        </button>
        <button onClick={advance} disabled={running} style={btnStyle("#69ff47")}>Step</button>
        <button onClick={randomize} style={btnStyle("#ffab40")}>Randomize</button>
        <button onClick={reset} style={btnStyle("#8b949e")}>Reset</button>
        <button onClick={() => setShowSettings(s => !s)} style={btnStyle("#58a6ff")}>
          {showSettings ? "Hide Settings" : "Settings"}
        </button>
        <button onClick={() => setShowRule(r => !r)} style={btnStyle("#c9a0dc")}>
          {showRule ? "Hide Rule" : "Edit Rule"}
        </button>
        <label style={{ fontSize: 11, color: "#8b949e", display: "flex", alignItems: "center", gap: 6 }}>
          Speed
          <input type="range" min={50} max={1000} step={50} value={speed}
            onChange={e => setSpeed(+e.target.value)}
            style={{ width: 80, accentColor: "#00e5ff" }} />
          <span style={{ color: "#c9d1d9", minWidth: 40 }}>{speed}ms</span>
        </label>
      </div>

      {/* Paint controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "#8b949e" }}>Paint:</span>
        {SIG_LABELS.map(s => (
          <button key={s} onClick={() => setPaintSig(s)}
            style={{
              ...btnStyle(SIG_COLOR[s]),
              opacity: paintSig === s ? 1 : 0.4,
              padding: "4px 10px", fontSize: 11
            }}>{s}</button>
        ))}
        <button onClick={() => setPaintVal(v => v === 1 ? 0 : 1)}
          style={{ ...btnStyle("#8b949e"), fontSize: 11, padding: "4px 10px" }}>
          val={paintVal}
        </button>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
        {/* Grid */}
        <svg width={SVG_SIZE} height={SVG_SIZE}
          style={{ border: "1px solid #21262d", borderRadius: 6, cursor: "crosshair", display: "block" }}>

          {/* Background */}
          <rect width={SVG_SIZE} height={SVG_SIZE} fill="#0d1117" />

          {/* Grid lines */}
          {Array.from({ length: GRID + 1 }, (_, i) => (
            <g key={i}>
              <line x1={i * CELL + 1} y1={1} x2={i * CELL + 1} y2={SVG_SIZE - 1}
                stroke="#161b22" strokeWidth={1} />
              <line x1={1} y1={i * CELL + 1} x2={SVG_SIZE - 1} y2={i * CELL + 1}
                stroke="#161b22" strokeWidth={1} />
            </g>
          ))}

          {/* Input stubs + node circles (rendered first so signals appear above) */}
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const cx = c * CELL + CELL / 2 + 1;
              const cy = r * CELL + CELL / 2 + 1;
              // Compute inputs for this cell
              const ixp = grid[r][(c - 1 + GRID) % GRID]["ox+"];
              const ixm = grid[r][(c + 1) % GRID]["ox-"];
              const iyp = grid[(r - 1 + GRID) % GRID][c]["oy+"];
              const iym = grid[(r + 1) % GRID][c]["oy-"];
              const anyOn = cell["ox+"] || cell["oy+"] || cell["ox-"] || cell["oy-"];

              return (
                <g key={`${r}-${c}`} onClick={() => toggleCell(r, c)} style={{ cursor: "pointer" }}>
                  <InputStubs cx={cx} cy={cy} inputs={{ ixp, ixm, iyp, iym }} />
                  {/* Node circle */}
                  <circle cx={cx} cy={cy} r={R}
                    fill={anyOn ? "#0d1f2d" : "#0d1117"}
                    stroke={anyOn ? "#1c3f5e" : "#21262d"}
                    strokeWidth={anyOn ? 1.5 : 1} />
                  <NodeSignals cx={cx} cy={cy} outputs={cell} />
                </g>
              );
            })
          )}
        </svg>

        {/* Settings panel */}
        {showSettings && (
          <SettingsPanel
            activePresetId={activePreset?.id ?? null}
            onSelectPreset={applyPreset}
          />
        )}

        {/* Rule editor */}
        {showRule && <RuleEditor rule={rule} onRuleChange={setRule} />}
      </div>

      <div style={{ marginTop: 16, fontSize: 10, color: "#30363d", letterSpacing: 1 }}>
        CLICK CELLS TO PAINT · TOROIDAL BOUNDARY · 4 SIGNALS PER NODE
      </div>
    </div>
  );
}

function btnStyle(color) {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color: color,
    borderRadius: 4,
    padding: "5px 14px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "monospace",
    letterSpacing: 1,
    textShadow: `0 0 8px ${color}44`,
    transition: "background 0.15s"
  };
}
