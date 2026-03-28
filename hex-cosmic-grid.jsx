import { useState, useCallback, useEffect, useRef, useMemo } from "react";

// Hex grid using axial coordinates (q, r)
// Neighbors in axial coords for the 6 hex directions:
// Direction vectors in axial (q,r):
//   [1,0] right        -> axial (+1, 0)
//   [-1,0] left        -> axial (-1, 0)
//   [1/2, √3/2] upper-right  -> axial (0, -1)  [in our screen-y-flipped system: (0,+1) visually up]
//   [-1/2, √3/2] upper-left  -> axial (-1, -1) [screen: (-1,+1)]
//   [1/2, -√3/2] lower-right -> axial (+1, +1) [screen: (+1,-1)]
//   [-1/2, -√3/2] lower-left -> axial (0, +1)  [screen: (0,-1)]

// But let's work directly in cube/axial coords and convert to pixel for rendering.
// We use "pointy-top" hex orientation where:
//   pixel_x = size * (sqrt(3)*q + sqrt(3)/2*r)
//   pixel_y = size * (3/2 * r)
// But user wants y-up with specific direction mapping, so let's use flat-top:
//   For flat-top hex:
//   pixel_x = size * (3/2 * q)
//   pixel_y = size * (sqrt(3)/2 * q + sqrt(3) * r)

// Actually, let's just directly map the user's Cartesian directions to axial coordinates.
// User's coordinate system: x-right, y-up
// The 6 neighbors of [0,0] in user's Cartesian:
//   [1, 0], [1/2, √3/2], [-1/2, √3/2], [-1, 0], [-1/2, -√3/2], [1/2, -√3/2]
//
// We use offset coordinates: each node has (col, row) and we map to pixel directly.
// Instead, use axial coords (q, r) where:
//   Cartesian x = q + r * cos(60°) = q + r/2
//   Cartesian y = r * sin(60°) = r * √3/2
// So axial (1,0) -> Cartesian (1, 0) ✓
//    axial (0,1) -> Cartesian (1/2, √3/2) ✓
//    axial (-1,1) -> Cartesian (-1/2, √3/2) ✓
//    axial (-1,0) -> Cartesian (-1, 0) ✓
//    axial (0,-1) -> Cartesian (-1/2, -√3/2) ✓
//    axial (1,-1) -> Cartesian (1/2, -√3/2) ✓
// Perfect! Axial (q,r) maps directly to user's hex directions.

// CM-1 port geometry (docs/CM-1.md), axial (q,r); user x-right y-up.
// Positive outputs ox+, oy+, oz+ step to neighbor Δ(q,r); inputs arrive from opposite neighbor.
//   ix+: L→R / ix−: R→L     — edge Δ(±1, 0)
//   iy+: lower-right→upper-left / iy−: upper-left→lower-right — edge Δ(∓1, ±1)
//   iz+: upper-right→lower-left / iz−: lower-left→upper-right — edge Δ(0, ∓1)

const DEFAULT_RADIUS = 9;
const MAX_RADIUS = 30;
const S3 = Math.sqrt(3);

function generateGrid(radius) {
  const nodes = [];
  const nodeIndex = {};

  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      // Cube coordinate s = -q - r
      const s = -q - r;
      // Hex distance from origin = max(|q|, |r|, |s|)
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (dist <= radius) {
        nodes.push({ q, r });
      }
    }
  }

  nodes.forEach((n, i) => {
    nodeIndex[`${n.q},${n.r}`] = i;
  });

  return { nodes, nodeIndex };
}

// Positive-output neighbor deltas (ox+, oy+, oz+)
const OX_DQ = 1,
  OX_DR = 0; // +x / left→right
const OY_DQ = -1,
  OY_DR = 1; // toward upper-left neighbor: lower-right→upper-left
const OZ_DQ = 0,
  OZ_DR = -1; // toward lower-left neighbor: upper-right→lower-left

// For toroidal wrapping on a hex grid, we need to find the "wrapped" neighbor.
// Since we have a hex disk (not a parallelogram), true toroidal wrapping is non-trivial.
// We'll use a simpler approach: if the neighbor is outside the grid, the signal is lost (0).
// This is more physically meaningful for a disk shape.

function getNeighborIndex(q, r, dq, dr, nodeIndex) {
  const nq = q + dq;
  const nr = r + dr;
  const key = `${nq},${nr}`;
  if (key in nodeIndex) return nodeIndex[key];
  return -1; // outside grid
}

// Axial to pixel (screen coords, y-down for SVG)
const HEX_SIZE = 22; // pixels per unit distance
function axialToPixel(q, r) {
  const x = HEX_SIZE * (q + r * 0.5);
  const y = HEX_SIZE * (r * S3 / 2) * -1; // flip y for screen
  return { x, y };
}

// Signal state: for each node, 6 inputs — [ix+, iy+, iz+, ix−, iy−, iz−]
// Wire coupling (matching polarity on the shared edge): ox+→neighbor ix+, oy+→iy+, oz+→iz+
// along +Δ; ox−→ix−, oy−→iy−, oz−→iz− along −Δ.

function initState(nodeCount) {
  const signals = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    signals[i] = [0, 0, 0, 0, 0, 0];
  }
  return { signals, tick: 0 };
}

function copySignals(s) {
  return s.map((a) => [...a]);
}

// Each table: 8 rows (ix,iy,iz bits) → 3 outputs. rule+ rows use ix+,iy+,iz+ and cells are ox+,oy+,oz+.
// rule− rows use ix−,iy−,iz− and cells are ox−,oy−,oz− (separate evalRule{Plus,Minus} in simulate).
const defaultRule = [
  [0, 0, 0], // 000 -> 000
  [1, 1, 1], // 001 -> 111
  [0, 1, 1], // 010 -> 011
  [1, 0, 0], // 011 -> 100
  [1, 0, 1], // 100 -> 101
  [0, 0, 1], // 101 -> 001
  [0, 1, 0], // 110 -> 010
  [1, 1, 0], // 111 -> 110
];

const oddEvenRule = [
  [0, 0, 0], // 000 -> 000
  [1, 1, 1], // 001 -> 111
  [1, 1, 1], // 010 -> 111
  [0, 0, 0], // 011 -> 000
  [1, 1, 1], // 100 -> 111
  [0, 0, 0], // 101 -> 000
  [0, 0, 0], // 110 -> 000
  [1, 1, 1], // 111 -> 111
];

const xCircleRule = [
  [0, 0, 0], // 000 -> 000
  [1, 0, 1], // 001 -> 101
  [1, 1, 0], // 010 -> 110
  [0, 0, 1], // 011 -> 001
  [1, 1, 1], // 100 -> 111
  [0, 1, 0], // 101 -> 010
  [1, 0, 0], // 110 -> 100
  [0, 1, 1], // 111 -> 011
];

const yCircleRule = [
  [0, 0, 0], // 000 -> 000
  [0, 1, 1], // 001 -> 011
  [1, 1, 1], // 010 -> 111
  [1, 0, 0], // 011 -> 100
  [1, 1, 0], // 100 -> 110
  [0, 0, 1], // 101 -> 001
  [0, 1, 0], // 110 -> 010
  [1, 0, 1], // 111 -> 101
];

const rulePresets = {
  "Default": defaultRule,
  "Odd-Even": oddEvenRule,
  "x-circle": xCircleRule,
  "y-circle": yCircleRule,
};

const ZERO_SIGNAL = [0, 0, 0, 0, 0, 0];

/** Per-node inputs: + ports then − ports (CM-1 docs/CM-1.md). */
const SIG_IXP = 0,
  SIG_IYP = 1,
  SIG_IZP = 2,
  SIG_IXN = 3,
  SIG_IYN = 4,
  SIG_IZN = 5;

function ruleRowIndex(ix, iy, iz) {
  return (ix << 2) | (iy << 1) | iz;
}

/** rule+: [ix+, iy+, iz+] → [ox+, oy+, oz+] — only + outputs; never ox−/oy−/oz−. */
function evalRulePlus(ixPlus, iyPlus, izPlus, table) {
  return table[ruleRowIndex(ixPlus, iyPlus, izPlus)];
}

/** rule−: [ix−, iy−, iz−] → [ox−, oy−, oz−] — only − outputs; never ox+/oy+/oz+. */
function evalRuleMinus(ixMinus, iyMinus, izMinus, table) {
  return table[ruleRowIndex(ixMinus, iyMinus, izMinus)];
}

/** ox+, oy+, oz+ → neighbor in +Δ receives ix+, iy+, iz+ (same polarity on that edge). */
function sendPlusOutputsToNeighbors(q, r, oxPlus, oyPlus, ozPlus, nodeIndex, into) {
  let t = getNeighborIndex(q, r, OX_DQ, OX_DR, nodeIndex);
  if (t >= 0) into[t][SIG_IXP] = oxPlus;

  t = getNeighborIndex(q, r, OY_DQ, OY_DR, nodeIndex);
  if (t >= 0) into[t][SIG_IYP] = oyPlus;

  t = getNeighborIndex(q, r, OZ_DQ, OZ_DR, nodeIndex);
  if (t >= 0) into[t][SIG_IZP] = ozPlus;
}

/** ox−, oy−, oz− → neighbor in −Δ receives ix−, iy−, iz−. */
function sendMinusOutputsToNeighbors(q, r, oxMinus, oyMinus, ozMinus, nodeIndex, into) {
  let t = getNeighborIndex(q, r, -OX_DQ, -OX_DR, nodeIndex);
  if (t >= 0) into[t][SIG_IXN] = oxMinus;

  t = getNeighborIndex(q, r, -OY_DQ, -OY_DR, nodeIndex);
  if (t >= 0) into[t][SIG_IYN] = oyMinus;

  t = getNeighborIndex(q, r, -OZ_DQ, -OZ_DR, nodeIndex);
  if (t >= 0) into[t][SIG_IZN] = ozMinus;
}

function simulate(state, rulePlus, ruleMinus, nodes, nodeIndex) {
  const { signals } = state;
  const nodeCount = nodes.length;
  const newSignals = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    newSignals[i] = [0, 0, 0, 0, 0, 0];
  }

  for (let i = 0; i < nodeCount; i++) {
    const { q, r } = nodes[i];
    const sig = signals[i] ?? ZERO_SIGNAL;

    const [oxPlus, oyPlus, ozPlus] = evalRulePlus(
      sig[SIG_IXP],
      sig[SIG_IYP],
      sig[SIG_IZP],
      rulePlus
    );
    const [oxMinus, oyMinus, ozMinus] = evalRuleMinus(
      sig[SIG_IXN],
      sig[SIG_IYN],
      sig[SIG_IZN],
      ruleMinus
    );

    sendPlusOutputsToNeighbors(q, r, oxPlus, oyPlus, ozPlus, nodeIndex, newSignals);
    sendMinusOutputsToNeighbors(q, r, oxMinus, oyMinus, ozMinus, nodeIndex, newSignals);
  }

  return { signals: newSignals, tick: state.tick + 1 };
}

// Colors
const BG = "#06060a";
const NODE_BG = "#0c0c14";
const NODE_BORDER = "#1a1a24";
const NODE_ACTIVE_BG = "#0f0f18";
const NODE_ACTIVE_BORDER = "#2a2e38";
const SIG_OFF = "#1a1e26";
const SIG_ON = "#4ee4a3";
const SIG_GLOW = "#4ee4a3";
const TEXT_DIM = "#2a2e38";
const TEXT_MID = "#5a6068";

const NODE_RADIUS = 10;
const SIG_LEN = 6;

function cloneRuleTable(r) {
  return r.map((row) => [...row]);
}

export default function HexCosmicGrid() {
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [pendingRadius, setPendingRadius] = useState(String(DEFAULT_RADIUS));
  const [showSettings, setShowSettings] = useState(false);
  const [signalLineOrientation, setSignalLineOrientation] = useState("perpendicular");
  const [rulePlus, setRulePlus] = useState(() => cloneRuleTable(defaultRule));
  const [ruleMinus, setRuleMinus] = useState(() => cloneRuleTable(defaultRule));
  const [running, setRunning] = useState(false);
  const grid = useMemo(() => generateGrid(radius), [radius]);
  const nodeCount = grid.nodes.length;
  const [state, setState] = useState(() => initState(generateGrid(DEFAULT_RADIUS).nodes.length));
  const rulesRef = useRef({ plus: rulePlus, minus: ruleMinus });
  rulesRef.current = { plus: rulePlus, minus: ruleMinus };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const { plus, minus } = rulesRef.current;
      setState((s) => simulate(s, plus, minus, grid.nodes, grid.nodeIndex));
    }, 1000);
    return () => clearInterval(id);
  }, [running, grid]);

  const handleTick = useCallback(() => {
    setState((s) => simulate(s, rulePlus, ruleMinus, grid.nodes, grid.nodeIndex));
  }, [rulePlus, ruleMinus, grid]);

  const handleReset = useCallback(() => {
    setState(initState(nodeCount));
    setRunning(false);
  }, [nodeCount]);

  const toggleSignal = useCallback((nodeIdx, sigIdx) => {
    setState((s) => {
      const newSig = copySignals(s.signals);
      if (!newSig[nodeIdx]) return s;
      newSig[nodeIdx][sigIdx] = newSig[nodeIdx][sigIdx] === 0 ? 1 : 0;
      return { ...s, signals: newSig };
    });
  }, []);

  const updateRulePlus = useCallback((ruleIdx, outIdx) => {
    setRulePlus((prev) => {
      const next = prev.map((r) => [...r]);
      next[ruleIdx][outIdx] = next[ruleIdx][outIdx] === 0 ? 1 : 0;
      return next;
    });
  }, []);

  const updateRuleMinus = useCallback((ruleIdx, outIdx) => {
    setRuleMinus((prev) => {
      const next = prev.map((r) => [...r]);
      next[ruleIdx][outIdx] = next[ruleIdx][outIdx] === 0 ? 1 : 0;
      return next;
    });
  }, []);

  const flipRulePlus = useCallback(() => {
    setRulePlus((prev) => prev.map((outs) => outs.map((v) => (v === 0 ? 1 : 0))));
  }, []);

  const flipRuleMinus = useCallback(() => {
    setRuleMinus((prev) => prev.map((outs) => outs.map((v) => (v === 0 ? 1 : 0))));
  }, []);

  const applyPresetRulePlus = useCallback((presetName) => {
    const preset = rulePresets[presetName];
    if (!preset) return;
    setRulePlus(cloneRuleTable(preset));
  }, []);

  const applyPresetRuleMinus = useCallback((presetName) => {
    const preset = rulePresets[presetName];
    if (!preset) return;
    setRuleMinus(cloneRuleTable(preset));
  }, []);

  const applyRadius = useCallback(() => {
    const parsed = Number.parseInt(pendingRadius, 10);
    if (Number.isNaN(parsed)) return;
    const next = Math.max(0, Math.min(MAX_RADIUS, parsed));
    const nextGrid = generateGrid(next);
    setRadius(next);
    setState(initState(nextGrid.nodes.length));
    setRunning(false);
    setPendingRadius(String(next));
  }, [pendingRadius]);

  // Compute pixel positions
  const positions = useMemo(() => {
    return grid.nodes.map((n) => axialToPixel(n.q, n.r));
  }, [grid.nodes]);

  // SVG viewport
  const margin = 40;
  const maxExtent = radius * HEX_SIZE + margin;
  const svgW = maxExtent * 2;
  const svgH = maxExtent * 2;
  const cx = maxExtent;
  const cy = maxExtent;

  // Ticks sit on the side the input arrives from (unit step in axial coords toward source).
  const sigDirs = useMemo(() => {
    const dirs = [
      { dq: -1, dr: 0 }, // ix+ from (−1,0); L→R
      { dq: 1, dr: -1 }, // iy+ from (+1,−1); LR→UL
      { dq: 0, dr: 1 }, // iz+ from (0,+1); UR→LL
      { dq: 1, dr: 0 }, // ix−
      { dq: -1, dr: 1 }, // iy−
      { dq: 0, dr: -1 }, // iz−
    ];
    return dirs.map(({ dq, dr }) => {
      const px = HEX_SIZE * (dq + dr * 0.5);
      const py = HEX_SIZE * (dr * S3 / 2) * -1;
      const len = Math.sqrt(px * px + py * py);
      return { ux: px / len, uy: py / len };
    });
  }, []);

  const ruleLabels = ["000", "001", "010", "011", "100", "101", "110", "111"];

  const btnBase = {
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    cursor: "pointer",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };

  const totalOn = state.signals.reduce(
    (sum, s) => sum + s[0] + s[1] + s[2] + s[3] + s[4] + s[5],
    0
  );

  const sigColors = [
    SIG_ON,
    "#e8a44e",
    "#a44ee8",
    "#7ee4b8",
    "#f0c088",
    "#c49ef0",
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: "#c8ccd0",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px 12px",
      }}
    >
      <h1
        style={{
          fontSize: "15px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#e0e4e8",
          margin: "0 0 2px 0",
        }}
      >
        Hex Cosmic Grid
      </h1>
      <p style={{ fontSize: "10px", color: "#484e56", margin: "0 0 14px 0" }}>
        {nodeCount} nodes · radius {radius} · hex distance ≤ radius · 6-in 6-out · tick{" "}
        <span style={{ color: SIG_ON }}>{state.tick}</span>
        {running && (
          <span style={{ color: "#e8a44e", marginLeft: "8px" }}>● auto</span>
        )}
      </p>

      {/* Rule editors */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "12px",
          background: "#0a0a12",
          border: "1px solid #161620",
          borderRadius: "8px",
          padding: "8px 12px",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "720px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "8px",
              color: "#5a9078",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginRight: "2px",
            }}
          >
            Rule+{" "}
            <span style={{ color: "#3a4a42", fontWeight: 400 }}>[ix+,iy+,iz+]→ox+,oy+,oz+</span>
          </span>
          {ruleLabels.map((label, idx) => (
            <div
              key={`p-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                fontSize: "11px",
              }}
            >
              <span style={{ color: "#2a2e38" }}>{label}→</span>
              {[0, 1, 2].map((outIdx) => (
                <span
                  key={outIdx}
                  onClick={() => updateRulePlus(idx, outIdx)}
                  style={{
                    cursor: "pointer",
                    color: rulePlus[idx][outIdx] ? SIG_ON : "#2a2e38",
                    fontWeight: 700,
                    userSelect: "none",
                    transition: "color 0.15s",
                    padding: "0 1px",
                  }}
                >
                  {rulePlus[idx][outIdx]}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "8px",
              color: "#90705a",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginRight: "2px",
            }}
          >
            Rule−{" "}
            <span style={{ color: "#4a3a36", fontWeight: 400 }}>[ix−,iy−,iz−]→ox−,oy−,oz−</span>
          </span>
          {ruleLabels.map((label, idx) => (
            <div
              key={`m-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                fontSize: "11px",
              }}
            >
              <span style={{ color: "#2a2e38" }}>{label}→</span>
              {[0, 1, 2].map((outIdx) => (
                <span
                  key={outIdx}
                  onClick={() => updateRuleMinus(idx, outIdx)}
                  style={{
                    cursor: "pointer",
                    color: ruleMinus[idx][outIdx] ? "#e8a47a" : "#2a2e38",
                    fontWeight: 700,
                    userSelect: "none",
                    transition: "color 0.15s",
                    padding: "0 1px",
                  }}
                >
                  {ruleMinus[idx][outIdx]}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "8px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          onClick={handleTick}
          style={{ ...btnBase, background: SIG_ON, color: BG, fontWeight: 700, padding: "8px 24px" }}
        >
          Tick
        </button>
        <button
          onClick={() => setRunning((r) => !r)}
          style={{
            ...btnBase,
            background: running ? "#3a1a1a" : "#1a2a3a",
            color: running ? "#e84e4e" : "#4ea4e8",
            border: `1px solid ${running ? "#4a2a2a" : "#2a3a4a"}`,
            fontWeight: 700,
          }}
        >
          {running ? "Stop" : "Auto"}
        </button>
        <button
          onClick={handleReset}
          style={{
            ...btnBase,
            background: "transparent",
            color: "#585e68",
            border: "1px solid #22262e",
          }}
        >
          Reset
        </button>
        <button
          onClick={() => setShowSettings((v) => !v)}
          style={{
            ...btnBase,
            background: showSettings ? "#1d1d2a" : "transparent",
            color: "#9ca4b0",
            border: "1px solid #22262e",
          }}
        >
          Settings
        </button>
      </div>

      {showSettings && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "10px",
            background: "#0a0a12",
            border: "1px solid #161620",
            borderRadius: "8px",
            padding: "8px 10px",
            fontSize: "11px",
          }}
        >
          <span style={{ color: "#7a828e" }}>Grid radius</span>
          <input
            type="number"
            min={0}
            max={MAX_RADIUS}
            value={pendingRadius}
            onChange={(e) => setPendingRadius(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyRadius();
            }}
            style={{
              width: "72px",
              background: "#0f1018",
              color: "#c8ccd0",
              border: "1px solid #22262e",
              borderRadius: "6px",
              padding: "6px 8px",
              fontFamily: "inherit",
              fontSize: "11px",
            }}
          />
          <button
            onClick={applyRadius}
            style={{
              ...btnBase,
              background: "#1a2a3a",
              color: "#4ea4e8",
              border: "1px solid #2a3a4a",
              padding: "6px 10px",
              fontSize: "10px",
            }}
          >
            Apply
          </button>
          <span style={{ color: "#7a828e", marginLeft: "6px" }}>Rule+</span>
          <button
            onClick={flipRulePlus}
            style={{
              ...btnBase,
              background: "transparent",
              color: "#c8ccd0",
              border: "1px solid #22262e",
              padding: "6px 10px",
              fontSize: "10px",
            }}
          >
            Flip+
          </button>
          {Object.keys(rulePresets).map((presetName) => (
            <button
              key={`p-${presetName}`}
              onClick={() => applyPresetRulePlus(presetName)}
              style={{
                ...btnBase,
                background: "transparent",
                color: "#c8ccd0",
                border: "1px solid #22262e",
                padding: "6px 10px",
                fontSize: "10px",
              }}
            >
              + {presetName}
            </button>
          ))}
          <span style={{ color: "#7a828e", marginLeft: "6px" }}>Rule−</span>
          <button
            onClick={flipRuleMinus}
            style={{
              ...btnBase,
              background: "transparent",
              color: "#c8ccd0",
              border: "1px solid #22262e",
              padding: "6px 10px",
              fontSize: "10px",
            }}
          >
            Flip−
          </button>
          {Object.keys(rulePresets).map((presetName) => (
            <button
              key={`m-${presetName}`}
              onClick={() => applyPresetRuleMinus(presetName)}
              style={{
                ...btnBase,
                background: "transparent",
                color: "#c8ccd0",
                border: "1px solid #22262e",
                padding: "6px 10px",
                fontSize: "10px",
              }}
            >
              − {presetName}
            </button>
          ))}
          <span style={{ color: "#7a828e", marginLeft: "6px" }}>Signal line</span>
          <button
            onClick={() => setSignalLineOrientation("perpendicular")}
            style={{
              ...btnBase,
              background: signalLineOrientation === "perpendicular" ? "#1d1d2a" : "transparent",
              color: signalLineOrientation === "perpendicular" ? "#c8ccd0" : "#66707c",
              border: "1px solid #22262e",
              padding: "6px 10px",
              fontSize: "10px",
            }}
          >
            Perpendicular
          </button>
          <button
            onClick={() => setSignalLineOrientation("direction")}
            style={{
              ...btnBase,
              background: signalLineOrientation === "direction" ? "#1d1d2a" : "transparent",
              color: signalLineOrientation === "direction" ? "#c8ccd0" : "#66707c",
              border: "1px solid #22262e",
              padding: "6px 10px",
              fontSize: "10px",
            }}
          >
            True direction
          </button>
        </div>
      )}

      <p style={{ fontSize: "8px", color: "#2a2e38", margin: "0 0 10px 0", textAlign: "center" }}>
        CM-1 dirs · click ticks to toggle · Rule+/Rule− independent · +ports:{" "}
        <span style={{ color: SIG_ON }}>L→R</span> ·{" "}
        <span style={{ color: "#e8a44e" }}>LR→UL</span> ·{" "}
        <span style={{ color: "#a44ee8" }}>UR→LL</span> · − ports reverse each
      </p>

      {/* Hex grid SVG */}
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: "block" }}
        >
          {/* Edges (wire lines between nodes) */}
          {grid.nodes.map((node, i) => {
            const px = cx + positions[i].x;
            const py = cy + positions[i].y;
            const edges = [];

            // Draw output edges: ox, oy, oz
            const outDirs = [
              { dq: OX_DQ, dr: OX_DR },
              { dq: OY_DQ, dr: OY_DR },
              { dq: OZ_DQ, dr: OZ_DR },
            ];
            outDirs.forEach(({ dq, dr }, di) => {
              const ni = getNeighborIndex(node.q, node.r, dq, dr, grid.nodeIndex);
              if (ni >= 0) {
                const npx = cx + positions[ni].x;
                const npy = cy + positions[ni].y;
                edges.push(
                  <line
                    key={`edge-${i}-${di}`}
                    x1={px}
                    y1={py}
                    x2={npx}
                    y2={npy}
                    stroke="#0e0e16"
                    strokeWidth={0.5}
                  />
                );
              }
            });
            return <g key={`edges-${i}`}>{edges}</g>;
          })}

          {/* Nodes */}
          {grid.nodes.map((node, i) => {
            const px = cx + positions[i].x;
            const py = cy + positions[i].y;
            const [ixp, iyp, izp, ixn, iyn, izn] = state.signals[i] ?? ZERO_SIGNAL;
            const hasInput = ixp || iyp || izp || ixn || iyn || izn;
            const isOrigin = node.q === 0 && node.r === 0;

            return (
              <g key={`node-${i}`}>
                {/* Hex shape approximated as circle */}
                <circle
                  cx={px}
                  cy={py}
                  r={NODE_RADIUS}
                  fill={isOrigin ? "#14141e" : hasInput ? NODE_ACTIVE_BG : NODE_BG}
                  stroke={isOrigin ? "#3a4048" : hasInput ? NODE_ACTIVE_BORDER : NODE_BORDER}
                  strokeWidth={isOrigin ? 1.5 : 0.8}
                />
                <text
                  x={px}
                  y={py + 2}
                  fontSize="5"
                  fill={hasInput ? TEXT_MID : TEXT_DIM}
                  textAnchor="middle"
                  fontFamily="inherit"
                >
                  {ixp}
                  {iyp}
                  {izp}|{ixn}
                  {iyn}
                  {izn}
                </text>
              </g>
            );
          })}

          {/* Signal indicators */}
          {grid.nodes.map((node, i) => {
            const px = cx + positions[i].x;
            const py = cy + positions[i].y;
            const sigVals = state.signals[i] ?? ZERO_SIGNAL;

            return (
              <g key={`sig-${i}`}>
                {sigDirs.map((dir, si) => {
                  const val = sigVals[si];
                  const col = sigColors[si];
                  // Position signal indicator along the input direction, outside the node
                  const offset = NODE_RADIUS + SIG_LEN + 2;
                  const mx = px + dir.ux * offset;
                  const my = py + dir.uy * offset;
                  const lineU = signalLineOrientation === "direction"
                    ? { x: dir.ux, y: dir.uy }
                    : { x: -dir.uy, y: dir.ux };

                  return (
                    <g
                      key={si}
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSignal(i, si)}
                    >
                      {/* Hit area */}
                      <circle cx={mx} cy={my} r={6} fill="transparent" />
                      {/* Glow */}
                      {val === 1 && (
                        <line
                          x1={mx - lineU.x * (SIG_LEN + 1)}
                          y1={my - lineU.y * (SIG_LEN + 1)}
                          x2={mx + lineU.x * (SIG_LEN + 1)}
                          y2={my + lineU.y * (SIG_LEN + 1)}
                          stroke={col}
                          strokeWidth={7}
                          strokeLinecap="round"
                          opacity={0.2}
                        />
                      )}
                      {/* Signal line orientation is configurable in Settings */}
                      <line
                        x1={mx - lineU.x * SIG_LEN}
                        y1={my - lineU.y * SIG_LEN}
                        x2={mx + lineU.x * SIG_LEN}
                        y2={my + lineU.y * SIG_LEN}
                        stroke={val ? col : SIG_OFF}
                        strokeWidth={val ? 2.5 : 1.5}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Origin marker */}
          <circle
            cx={cx}
            cy={cy}
            r={radius * HEX_SIZE + 2}
            fill="none"
            stroke="#1a1a24"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        </svg>
      </div>

      {/* Stats */}
      <div
        style={{
          marginTop: "12px",
          fontSize: "10px",
          color: "#3a3e48",
        }}
      >
        signals on: <span style={{ color: SIG_ON }}>{totalOn}</span> / {nodeCount * 6}
      </div>
    </div>
  );
}
