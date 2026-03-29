import { useState, useCallback, useEffect, useRef } from "react";

const GRID_SIZE = 10;

const defaultRule = [
  [0, 1], // [0,0] -> [0,1]
  [0, 1], // [0,1] -> [0,1]
  [0, 1], // [1,0] -> [0,1]
  [0, 1], // [1,1] -> [0,1]
];

function applyRule(ix, iy, rule) {
  const idx = (ix << 1) | iy;
  return rule[idx];
}

function initState() {
  const hSignals = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(0)
  );
  const vSignals = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(0)
  );
  return { hSignals, vSignals, tick: 0 };
}

function deepCopy2D(arr) {
  return arr.map((row) => [...row]);
}

function simulate(state, rule) {
  const { hSignals, vSignals } = state;
  const newH = deepCopy2D(hSignals);
  const newV = deepCopy2D(vSignals);

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const ix = hSignals[r][c];
      const iy = vSignals[r][c];
      const [ox, oy] = applyRule(ix, iy, rule);
      newH[r][(c + 1) % GRID_SIZE] = ox;
      newV[(r + 1) % GRID_SIZE][c] = oy;
    }
  }

  return { hSignals: newH, vSignals: newV, tick: state.tick + 1 };
}

const CELL = 52;
const PAD = 50;
const NODE_R = 15;
const SIG_LEN = 8; // half-length of signal line indicator

export default function CosmicGrid() {
  const [state, setState] = useState(initState);
  const [rule, setRule] = useState(defaultRule);
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

  const handleMultiTick = useCallback(
    (n) => {
      setState((s) => {
        let cur = s;
        for (let i = 0; i < n; i++) cur = simulate(cur, rule);
        return cur;
      });
    },
    [rule]
  );

  const handleReset = useCallback(() => {
    setState(initState());
    setRunning(false);
  }, []);

  const toggleH = useCallback((r, c) => {
    setState((s) => {
      const newH = deepCopy2D(s.hSignals);
      newH[r][c] = newH[r][c] === 0 ? 1 : 0;
      return { ...s, hSignals: newH };
    });
  }, []);

  const toggleV = useCallback((r, c) => {
    setState((s) => {
      const newV = deepCopy2D(s.vSignals);
      newV[r][c] = newV[r][c] === 0 ? 1 : 0;
      return { ...s, vSignals: newV };
    });
  }, []);

  const updateRule = useCallback((idx, outIdx) => {
    setRule((prev) => {
      const next = prev.map((r) => [...r]);
      next[idx][outIdx] = next[idx][outIdx] === 0 ? 1 : 0;
      return next;
    });
  }, []);

  const nodeX = (c) => PAD + c * CELL;
  const nodeY = (r) => PAD + r * CELL;

  const svgW = PAD * 2 + (GRID_SIZE - 1) * CELL;
  const svgH = PAD * 2 + (GRID_SIZE - 1) * CELL;

  const ruleLabels = ["00", "01", "10", "11"];

  function hWrapPath(r) {
    const x1 = nodeX(GRID_SIZE - 1) + NODE_R + 4;
    const x0 = nodeX(0) - NODE_R - 4;
    const y = nodeY(r);
    const bulge = 18;
    return `M ${x1} ${y} C ${x1 + bulge} ${y - bulge}, ${x0 - bulge} ${y - bulge}, ${x0} ${y}`;
  }

  function vWrapPath(c) {
    const y1 = nodeY(GRID_SIZE - 1) + NODE_R + 4;
    const y0 = nodeY(0) - NODE_R - 4;
    const x = nodeX(c);
    const bulge = 18;
    return `M ${x} ${y1} C ${x + bulge} ${y1 + bulge}, ${x + bulge} ${y0 - bulge}, ${x} ${y0}`;
  }

  const btnBase = {
    border: "none",
    borderRadius: "6px",
    padding: "9px 16px",
    fontSize: "13px",
    fontFamily: "inherit",
    cursor: "pointer",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080c",
        color: "#c8ccd0",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px",
      }}
    >
      <h1
        style={{
          fontSize: "16px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#e0e4e8",
          margin: "0 0 2px 0",
        }}
      >
        Cosmic Grid{" "}
        <span style={{ color: "#4ee4a3", fontSize: "11px", letterSpacing: "0.15em" }}>
          toroidal
        </span>
      </h1>
      <p style={{ fontSize: "11px", color: "#484e56", margin: "0 0 18px 0" }}>
        10×10 circular binary nodes · tick{" "}
        <span style={{ color: "#4ee4a3" }}>{state.tick}</span>
        {running && (
          <span style={{ color: "#e8a44e", marginLeft: "8px", fontSize: "10px" }}>● running</span>
        )}
      </p>

      {/* Rule editor */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "14px",
          background: "#0e0e16",
          border: "1px solid #1c1c28",
          borderRadius: "8px",
          padding: "10px 16px",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: "9px",
            color: "#484e56",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginRight: "4px",
          }}
        >
          Rule
        </span>
        {ruleLabels.map((label, idx) => (
          <div
            key={idx}
            style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "13px" }}
          >
            <span style={{ color: "#3a3e48" }}>[{label}]→[</span>
            <span
              onClick={() => updateRule(idx, 0)}
              style={{
                cursor: "pointer",
                color: rule[idx][0] ? "#4ee4a3" : "#2a2e38",
                fontWeight: 700,
                userSelect: "none",
                transition: "color 0.15s",
              }}
            >
              {rule[idx][0]}
            </span>
            <span
              onClick={() => updateRule(idx, 1)}
              style={{
                cursor: "pointer",
                color: rule[idx][1] ? "#4ee4a3" : "#2a2e38",
                fontWeight: 700,
                userSelect: "none",
                transition: "color 0.15s",
              }}
            >
              {rule[idx][1]}
            </span>
            <span style={{ color: "#3a3e48" }}>]</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "10px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          onClick={handleTick}
          style={{ ...btnBase, background: "#4ee4a3", color: "#08080c", fontWeight: 700, padding: "9px 28px" }}
        >
          Tick
        </button>
        <button
          onClick={() => handleMultiTick(5)}
          style={{ ...btnBase, background: "#1a3a2e", color: "#4ee4a3", border: "1px solid #2a4a3a" }}
        >
          ×5
        </button>
        <button
          onClick={() => handleMultiTick(20)}
          style={{ ...btnBase, background: "#1a3a2e", color: "#4ee4a3", border: "1px solid #2a4a3a" }}
        >
          ×20
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

      <p style={{ fontSize: "9px", color: "#2e323a", margin: "0 0 12px 0", textAlign: "center" }}>
        Click any signal to toggle · Click rule digits to edit · Edges wrap around ·{" "}
        <span style={{ color: "#4ee4a3" }}>—</span> h-signal{" "}
        <span style={{ color: "#4ee4a3" }}>|</span> v-signal
      </p>

      {/* Grid SVG */}
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: "block" }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Wrap-around arcs horizontal */}
          {Array.from({ length: GRID_SIZE }, (_, r) => {
            const val = state.hSignals[r][0];
            return (
              <path
                key={`hwrap-${r}`}
                d={hWrapPath(r)}
                fill="none"
                stroke={val ? "#4ee4a318" : "#0e0e14"}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            );
          })}

          {/* Wrap-around arcs vertical */}
          {Array.from({ length: GRID_SIZE }, (_, c) => {
            const val = state.vSignals[0][c];
            return (
              <path
                key={`vwrap-${c}`}
                d={vWrapPath(c)}
                fill="none"
                stroke={val ? "#4ee4a318" : "#0e0e14"}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            );
          })}

          {/* Wire background lines between nodes */}
          {Array.from({ length: GRID_SIZE }, (_, r) =>
            Array.from({ length: GRID_SIZE }, (_, c) => {
              const x = nodeX(c);
              const y = nodeY(r);
              const nextC = (c + 1) % GRID_SIZE;
              const nextR = (r + 1) % GRID_SIZE;
              return (
                <g key={`wire-${r}-${c}`}>
                  {/* Horizontal wire to next node (only within grid, not wrap) */}
                  {c < GRID_SIZE - 1 && (
                    <line
                      x1={x + NODE_R}
                      y1={y}
                      x2={nodeX(c + 1) - NODE_R}
                      y2={y}
                      stroke="#101016"
                      strokeWidth={1}
                    />
                  )}
                  {/* Vertical wire to next node */}
                  {r < GRID_SIZE - 1 && (
                    <line
                      x1={x}
                      y1={y + NODE_R}
                      x2={x}
                      y2={nodeY(r + 1) - NODE_R}
                      stroke="#101016"
                      strokeWidth={1}
                    />
                  )}
                </g>
              );
            })
          )}

          {/* Nodes (rendered first so signals appear on top) */}
          {Array.from({ length: GRID_SIZE }, (_, r) =>
            Array.from({ length: GRID_SIZE }, (_, c) => {
              const x = nodeX(c);
              const y = nodeY(r);
              const ix = state.hSignals[r][c];
              const iy = state.vSignals[r][c];
              const hasInput = ix || iy;
              return (
                <g key={`node-${r}-${c}`}>
                  <rect
                    x={x - NODE_R}
                    y={y - NODE_R}
                    width={NODE_R * 2}
                    height={NODE_R * 2}
                    rx={4}
                    fill={hasInput ? "#111118" : "#0c0c12"}
                    stroke={hasInput ? "#2e3238" : "#1a1a22"}
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={y + 4}
                    fontSize="10"
                    fill={hasInput ? "#6a7078" : "#2a2e38"}
                    textAnchor="middle"
                    fontFamily="inherit"
                  >
                    {ix}{iy}
                  </text>
                </g>
              );
            })
          )}

          {/* Horizontal signals — rendered as horizontal lines */}
          {Array.from({ length: GRID_SIZE }, (_, r) =>
            Array.from({ length: GRID_SIZE }, (_, c) => {
              const val = state.hSignals[r][c];
              let dotX;
              if (c === 0) {
                dotX = nodeX(0) - CELL / 2 + 6;
              } else {
                dotX = (nodeX(c - 1) + nodeX(c)) / 2;
              }
              const dotY = nodeY(r);

              return (
                <g
                  key={`h-${r}-${c}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleH(r, c)}
                >
                  <rect
                    x={dotX - SIG_LEN - 4}
                    y={dotY - 8}
                    width={SIG_LEN * 2 + 8}
                    height={16}
                    fill="transparent"
                  />
                  {val === 1 && (
                    <line
                      x1={dotX - SIG_LEN - 2}
                      y1={dotY}
                      x2={dotX + SIG_LEN + 2}
                      y2={dotY}
                      stroke="#4ee4a3"
                      strokeWidth={8}
                      strokeLinecap="round"
                      opacity={0.25}
                    />
                  )}
                  <line
                    x1={dotX - SIG_LEN}
                    y1={dotY}
                    x2={dotX + SIG_LEN}
                    y2={dotY}
                    stroke={val ? "#4ee4a3" : "#22262e"}
                    strokeWidth={val ? 3 : 2}
                    strokeLinecap="round"
                  />
                </g>
              );
            })
          )}

          {/* Vertical signals — rendered as vertical lines */}
          {Array.from({ length: GRID_SIZE }, (_, r) =>
            Array.from({ length: GRID_SIZE }, (_, c) => {
              const val = state.vSignals[r][c];
              const dotX = nodeX(c);
              let dotY;
              if (r === 0) {
                dotY = nodeY(0) - CELL / 2 + 6;
              } else {
                dotY = (nodeY(r - 1) + nodeY(r)) / 2;
              }

              return (
                <g
                  key={`v-${r}-${c}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleV(r, c)}
                >
                  <rect
                    x={dotX - 8}
                    y={dotY - SIG_LEN - 4}
                    width={16}
                    height={SIG_LEN * 2 + 8}
                    fill="transparent"
                  />
                  {val === 1 && (
                    <line
                      x1={dotX}
                      y1={dotY - SIG_LEN - 2}
                      x2={dotX}
                      y2={dotY + SIG_LEN + 2}
                      stroke="#4ee4a3"
                      strokeWidth={8}
                      strokeLinecap="round"
                      opacity={0.25}
                    />
                  )}
                  <line
                    x1={dotX}
                    y1={dotY - SIG_LEN}
                    x2={dotX}
                    y2={dotY + SIG_LEN}
                    stroke={val ? "#4ee4a3" : "#22262e"}
                    strokeWidth={val ? 3 : 2}
                    strokeLinecap="round"
                  />
                </g>
              );
            })
          )}

          {/* Column labels */}
          {Array.from({ length: GRID_SIZE }, (_, c) => (
            <text
              key={`cl-${c}`}
              x={nodeX(c)}
              y={PAD - CELL / 2 - 6}
              fontSize="8"
              fill="#22262e"
              textAnchor="middle"
              fontFamily="inherit"
            >
              {c}
            </text>
          ))}
          {/* Row labels */}
          {Array.from({ length: GRID_SIZE }, (_, r) => (
            <text
              key={`rl-${r}`}
              x={PAD - CELL / 2}
              y={nodeY(r) + 3}
              fontSize="8"
              fill="#22262e"
              textAnchor="middle"
              fontFamily="inherit"
            >
              {r}
            </text>
          ))}
        </svg>
      </div>

      {/* Stats */}
      <div
        style={{
          marginTop: "16px",
          display: "flex",
          gap: "20px",
          fontSize: "11px",
          color: "#3a3e48",
        }}
      >
        <span>
          h-signals on:{" "}
          <span style={{ color: "#4ee4a3" }}>
            {state.hSignals.flat().reduce((a, b) => a + b, 0)}
          </span>
        </span>
        <span>
          v-signals on:{" "}
          <span style={{ color: "#4ee4a3" }}>
            {state.vSignals.flat().reduce((a, b) => a + b, 0)}
          </span>
        </span>
      </div>
    </div>
  );
}
