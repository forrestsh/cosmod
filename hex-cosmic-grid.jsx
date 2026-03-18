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

// Output directions (axial deltas):
//   ox: (1, 0)   -> right
//   oy: (-1, 1)  -> upper-left
//   oz: (0, -1)  -> lower-left
// Input directions (from the opposite neighbors):
//   ix: from (-1, 0)  -> left neighbor's ox
//   iy: from (1, -1)  -> lower-right neighbor's oy
//   iz: from (0, 1)   -> upper-right neighbor's oz

const RADIUS = 9; // radius < 10, so 0..9 -> we use distance <= 9
const S3 = Math.sqrt(3);

function generateNodes() {
  const nodes = [];
  const keySet = new Set();
  for (let q = -RADIUS; q <= RADIUS; q++) {
    for (let r = -RADIUS; r <= RADIUS; r++) {
      // Cube coordinate s = -q - r
      const s = -q - r;
      // Hex distance from origin = max(|q|, |r|, |s|)
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (dist <= RADIUS) {
        nodes.push({ q, r });
        keySet.add(`${q},${r}`);
      }
    }
  }
  return { nodes, keySet };
}

const { nodes: ALL_NODES, keySet: NODE_SET } = generateNodes();
const NODE_COUNT = ALL_NODES.length;

// Create index map for fast lookup
const nodeIndex = {};
ALL_NODES.forEach((n, i) => {
  nodeIndex[`${n.q},${n.r}`] = i;
});

// Output direction deltas
const OX_DQ = 1, OX_DR = 0;   // right
const OY_DQ = -1, OY_DR = 1;  // upper-left
const OZ_DQ = 0, OZ_DR = -1;  // lower-left

// For toroidal wrapping on a hex grid, we need to find the "wrapped" neighbor.
// Since we have a hex disk (not a parallelogram), true toroidal wrapping is non-trivial.
// We'll use a simpler approach: if the neighbor is outside the grid, the signal is lost (0).
// This is more physically meaningful for a disk shape.

function getNeighborIndex(q, r, dq, dr) {
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

// Signal state: for each node, 3 input signals (ix, iy, iz)
// ix = signal arriving from left neighbor's ox
// iy = signal arriving from lower-right neighbor's oy
// iz = signal arriving from upper-right neighbor's oz

function initState() {
  // signals[i] = [ix, iy, iz] for node i
  const signals = new Array(NODE_COUNT);
  for (let i = 0; i < NODE_COUNT; i++) {
    signals[i] = [0, 0, 0];
  }
  return { signals, tick: 0 };
}

function copySignals(s) {
  return s.map((a) => [...a]);
}

// Default rule: 3 inputs (ix, iy, iz) -> 3 outputs (ox, oy, oz)
// 2^3 = 8 input combinations, each maps to [ox, oy, oz]
const defaultRule = [
  [0, 0, 0], // 000 -> 000
  [1, 1, 1], // 001 -> 111
  [1, 0, 1], // 010 -> 101
  [0, 1, 0], // 011 -> 010
  [1, 1, 0], // 100 -> 110
  [1, 0, 0], // 101 -> 100
  [0, 0, 1], // 110 -> 001
  [0, 1, 1], // 111 -> 011
];

function applyRule(ix, iy, iz, rule) {
  const idx = (ix << 2) | (iy << 1) | iz;
  return rule[idx];
}

function simulate(state, rule) {
  const { signals } = state;
  const newSignals = new Array(NODE_COUNT);
  for (let i = 0; i < NODE_COUNT; i++) {
    newSignals[i] = [0, 0, 0];
  }

  for (let i = 0; i < NODE_COUNT; i++) {
    const { q, r } = ALL_NODES[i];
    const [ix, iy, iz] = signals[i];
    const [ox, oy, oz] = applyRule(ix, iy, iz, rule);

    // ox goes to neighbor at (q+1, r+0) -> becomes their ix
    const oxTarget = getNeighborIndex(q, r, OX_DQ, OX_DR);
    if (oxTarget >= 0) newSignals[oxTarget][0] = ox;

    // oy goes to neighbor at (q-1, r+1) -> becomes their iy
    const oyTarget = getNeighborIndex(q, r, OY_DQ, OY_DR);
    if (oyTarget >= 0) newSignals[oyTarget][1] = oy;

    // oz goes to neighbor at (q+0, r-1) -> becomes their iz
    const ozTarget = getNeighborIndex(q, r, OZ_DQ, OZ_DR);
    if (ozTarget >= 0) newSignals[ozTarget][2] = oz;
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

export default function HexCosmicGrid() {
  const [state, setState] = useState(initState);
  const [rule, setRule] = useState(defaultRule.map((r) => [...r]));
  const [running, setRunning] = useState(false);
  const ruleRef = useRef(rule);
  ruleRef.current = rule;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setState((s) => simulate(s, ruleRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const handleTick = useCallback(() => {
    setState((s) => simulate(s, rule));
  }, [rule]);

  const handleReset = useCallback(() => {
    setState(initState());
    setRunning(false);
  }, []);

  const toggleSignal = useCallback((nodeIdx, sigIdx) => {
    setState((s) => {
      const newSig = copySignals(s.signals);
      newSig[nodeIdx][sigIdx] = newSig[nodeIdx][sigIdx] === 0 ? 1 : 0;
      return { ...s, signals: newSig };
    });
  }, []);

  const updateRule = useCallback((ruleIdx, outIdx) => {
    setRule((prev) => {
      const next = prev.map((r) => [...r]);
      next[ruleIdx][outIdx] = next[ruleIdx][outIdx] === 0 ? 1 : 0;
      return next;
    });
  }, []);

  // Compute pixel positions
  const positions = useMemo(() => {
    return ALL_NODES.map((n) => axialToPixel(n.q, n.r));
  }, []);

  // SVG viewport
  const margin = 40;
  const maxExtent = RADIUS * HEX_SIZE + margin;
  const svgW = maxExtent * 2;
  const svgH = maxExtent * 2;
  const cx = maxExtent;
  const cy = maxExtent;

  // Signal line directions in pixel space
  // ix comes from (-1, 0) direction -> line points left
  // iy comes from (1, -1) direction -> line points lower-right (in user coords), upper-right on screen
  // iz comes from (0, 1) direction -> line points upper-right (in user coords), lower-right on screen
  const sigDirs = useMemo(() => {
    // Input directions in axial, converted to pixel unit vectors
    const dirs = [
      { dq: -1, dr: 0 },  // ix from left
      { dq: 1, dr: -1 },  // iy from lower-right (user), screen: upper-right-ish
      { dq: 0, dr: 1 },   // iz from upper-right (user), screen: lower-right-ish
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

  const totalOn = state.signals.reduce((sum, s) => sum + s[0] + s[1] + s[2], 0);

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
        {NODE_COUNT} nodes · radius {RADIUS} · 3-in 3-out · tick{" "}
        <span style={{ color: SIG_ON }}>{state.tick}</span>
        {running && (
          <span style={{ color: "#e8a44e", marginLeft: "8px" }}>● auto</span>
        )}
      </p>

      {/* Rule editor */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "12px",
          background: "#0a0a12",
          border: "1px solid #161620",
          borderRadius: "8px",
          padding: "8px 12px",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "700px",
        }}
      >
        <span
          style={{
            fontSize: "8px",
            color: "#484e56",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginRight: "2px",
          }}
        >
          Rule
        </span>
        {ruleLabels.map((label, idx) => (
          <div
            key={idx}
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
                onClick={() => updateRule(idx, outIdx)}
                style={{
                  cursor: "pointer",
                  color: rule[idx][outIdx] ? SIG_ON : "#2a2e38",
                  fontWeight: 700,
                  userSelect: "none",
                  transition: "color 0.15s",
                  padding: "0 1px",
                }}
              >
                {rule[idx][outIdx]}
              </span>
            ))}
          </div>
        ))}
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
      </div>

      <p style={{ fontSize: "8px", color: "#2a2e38", margin: "0 0 10px 0", textAlign: "center" }}>
        Click signal lines to toggle · Click rule digits to edit ·{" "}
        <span style={{ color: SIG_ON }}>ix</span> left{" "}
        <span style={{ color: "#e8a44e" }}>iy</span> lower-right{" "}
        <span style={{ color: "#a44ee8" }}>iz</span> upper-right
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
          {ALL_NODES.map((node, i) => {
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
              const ni = getNeighborIndex(node.q, node.r, dq, dr);
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
          {ALL_NODES.map((node, i) => {
            const px = cx + positions[i].x;
            const py = cy + positions[i].y;
            const [ix, iy, iz] = state.signals[i];
            const hasInput = ix || iy || iz;
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
                  y={py + 3}
                  fontSize="6"
                  fill={hasInput ? TEXT_MID : TEXT_DIM}
                  textAnchor="middle"
                  fontFamily="inherit"
                >
                  {ix}{iy}{iz}
                </text>
              </g>
            );
          })}

          {/* Signal indicators */}
          {ALL_NODES.map((node, i) => {
            const px = cx + positions[i].x;
            const py = cy + positions[i].y;
            const [ix, iy, iz] = state.signals[i];

            const sigColors = [SIG_ON, "#e8a44e", "#a44ee8"];
            const sigVals = [ix, iy, iz];

            return (
              <g key={`sig-${i}`}>
                {sigDirs.map((dir, si) => {
                  const val = sigVals[si];
                  const col = sigColors[si];
                  // Position signal indicator along the input direction, outside the node
                  const offset = NODE_RADIUS + SIG_LEN + 2;
                  const mx = px + dir.ux * offset;
                  const my = py + dir.uy * offset;

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
                          x1={mx - dir.uy * (SIG_LEN + 1)}
                          y1={my + dir.ux * (SIG_LEN + 1)}
                          x2={mx + dir.uy * (SIG_LEN + 1)}
                          y2={my - dir.ux * (SIG_LEN + 1)}
                          stroke={col}
                          strokeWidth={7}
                          strokeLinecap="round"
                          opacity={0.2}
                        />
                      )}
                      {/* Signal line: perpendicular to direction */}
                      <line
                        x1={mx - dir.uy * SIG_LEN}
                        y1={my + dir.ux * SIG_LEN}
                        x2={mx + dir.uy * SIG_LEN}
                        y2={my - dir.ux * SIG_LEN}
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
            r={RADIUS * HEX_SIZE + 2}
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
        signals on: <span style={{ color: SIG_ON }}>{totalOn}</span> / {NODE_COUNT * 3}
      </div>
    </div>
  );
}
