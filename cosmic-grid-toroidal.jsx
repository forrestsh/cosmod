import { useState, useCallback, useEffect, useRef } from "react";

const GRID_SIZE = 10;

const RULE_MODE_2X2 = "2x2";
const RULE_MODE_4X4 = "4x4";

const defaultRule2 = [
  [0, 1],
  [0, 1],
  [0, 1],
  [0, 1],
];

const defaultRule4 = Array.from({ length: 16 }, () => [0, 0, 0, 0]);

function applyRule2(ix, iy, rule) {
  const idx = (ix << 1) | iy;
  return rule[idx];
}

function applyRule4(ixp, iyp, ixm, iym, rule) {
  const idx = (ixp << 3) | (iyp << 2) | (ixm << 1) | iym;
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

function simulate2(state, rule) {
  const { hSignals, vSignals } = state;
  const newH = deepCopy2D(hSignals);
  const newV = deepCopy2D(vSignals);

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const ix = hSignals[r][c];
      const iy = vSignals[r][c];
      const [ox, oy] = applyRule2(ix, iy, rule);
      newH[r][(c + 1) % GRID_SIZE] = ox;
      newV[(r + 1) % GRID_SIZE][c] = oy;
    }
  }

  return { hSignals: newH, vSignals: newV, tick: state.tick + 1 };
}

/**
 * 4→4 simulation.
 *
 * Each cell reads four inputs from its incident wires, applies the rule to
 * produce four outputs, then every shared wire is updated as the XOR of the
 * two contributing outputs from the cells on either side.
 *
 * Wire semantics (hSignals[r][c] sits between columns c-1 and c on row r):
 *   ix+ at (r,c) = hSignals[r][c]          (left edge coming in)
 *   iy+ at (r,c) = vSignals[r][c]          (top edge coming in)
 *   ix- at (r,c) = hSignals[r][(c+1)%N]   (right edge coming in)
 *   iy- at (r,c) = vSignals[(r+1)%N][c]   (bottom edge coming in)
 *
 * After computing all outputs:
 *   hSignals[r][c] = ox+ of west cell  XOR  ox- of east cell
 *   vSignals[r][c] = oy+ of north cell XOR  oy- of south cell
 */
function simulate4(state, rule) {
  const { hSignals, vSignals } = state;

  const outs = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => [0, 0, 0, 0])
  );

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const ixp = hSignals[r][c];
      const iyp = vSignals[r][c];
      const ixm = hSignals[r][(c + 1) % GRID_SIZE];
      const iym = vSignals[(r + 1) % GRID_SIZE][c];
      outs[r][c] = applyRule4(ixp, iyp, ixm, iym, rule);
    }
  }

  const newH = deepCopy2D(hSignals);
  const newV = deepCopy2D(vSignals);

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const wC = (c - 1 + GRID_SIZE) % GRID_SIZE;
      const oxpW = outs[r][wC][0];
      const oxmE = outs[r][c][2];
      newH[r][c] = oxpW ^ oxmE;

      const nR = (r - 1 + GRID_SIZE) % GRID_SIZE;
      const oypN = outs[nR][c][1];
      const oymS = outs[r][c][3];
      newV[r][c] = oypN ^ oymS;
    }
  }

  return { hSignals: newH, vSignals: newV, tick: state.tick + 1 };
}

const CELL = 52;
const PAD = 50;
const NODE_R = 15;
const NODE_R4 = CELL / 2;
const SIG_LEN = 8;
const SIG_DOT_R = 4;

export default function CosmicGrid() {
  const [state, setState] = useState(initState);
  const [ruleMode, setRuleMode] = useState(RULE_MODE_2X2);
  const [rule2, setRule2] = useState(defaultRule2);
  const [rule4, setRule4] = useState(defaultRule4);
  const [running, setRunning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const rule2Ref = useRef(rule2);
  const rule4Ref = useRef(rule4);
  const ruleModeRef = useRef(ruleMode);
  rule2Ref.current = rule2;
  rule4Ref.current = rule4;
  ruleModeRef.current = ruleMode;

  const simulateStep = useCallback((s) => {
    if (ruleModeRef.current === RULE_MODE_4X4)
      return simulate4(s, rule4Ref.current);
    return simulate2(s, rule2Ref.current);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setState((s) => simulateStep(s));
    }, 1000);
    return () => clearInterval(id);
  }, [running, simulateStep]);

  const handleTick = useCallback(() => {
    setState((s) => simulateStep(s));
  }, [simulateStep]);

  const handleMultiTick = useCallback(
    (n) => {
      setState((s) => {
        let cur = s;
        for (let i = 0; i < n; i++) cur = simulateStep(cur);
        return cur;
      });
    },
    [simulateStep]
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

  const updateRule2 = useCallback((idx, outIdx) => {
    setRule2((prev) => {
      const next = prev.map((r) => [...r]);
      next[idx][outIdx] = next[idx][outIdx] === 0 ? 1 : 0;
      return next;
    });
  }, []);

  const updateRule4 = useCallback((idx, outIdx) => {
    setRule4((prev) => {
      const next = prev.map((r) => [...r]);
      next[idx][outIdx] = next[idx][outIdx] === 0 ? 1 : 0;
      return next;
    });
  }, []);

  const handleRuleModeChange = useCallback((mode) => {
    setRuleMode(mode);
    setRunning(false);
  }, []);

  const nodeX = (c) => PAD + c * CELL;
  const nodeY = (r) => PAD + r * CELL;

  const svgW = PAD * 2 + (GRID_SIZE - 1) * CELL;
  const svgH = PAD * 2 + (GRID_SIZE - 1) * CELL;

  const is4 = ruleMode === RULE_MODE_4X4;
  const accent = is4 ? "#6ec4e8" : "#4ee4a3";
  const nR = is4 ? NODE_R4 : NODE_R;
  const spokeLen = nR - 3;

  const ruleLabels2 = ["00", "01", "10", "11"];

  function fourInLabel(idx) {
    return `${(idx >> 3) & 1}${(idx >> 2) & 1}${(idx >> 1) & 1}${idx & 1}`;
  }

  function hWrapPath(r) {
    const x1 = nodeX(GRID_SIZE - 1) + nR + 4;
    const x0 = nodeX(0) - nR - 4;
    const y = nodeY(r);
    const bulge = 18;
    return `M ${x1} ${y} C ${x1 + bulge} ${y - bulge}, ${x0 - bulge} ${y - bulge}, ${x0} ${y}`;
  }

  function vWrapPath(c) {
    const y1 = nodeY(GRID_SIZE - 1) + nR + 4;
    const y0 = nodeY(0) - nR - 4;
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
      {/* Title + settings button */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "2px" }}>
        <h1
          style={{
            fontSize: "16px",
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#e0e4e8",
            margin: 0,
          }}
        >
          Cosmic Grid{" "}
          <span style={{ color: "#4ee4a3", fontSize: "11px", letterSpacing: "0.15em" }}>
            toroidal
          </span>
        </h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
          style={{
            ...btnBase,
            padding: "6px 12px",
            fontSize: "11px",
            background: "#12121a",
            color: "#8a9098",
            border: "1px solid #2a2e38",
          }}
        >
          Settings
        </button>
      </div>

      <p style={{ fontSize: "11px", color: "#484e56", margin: "0 0 18px 0" }}>
        10×10 circular binary nodes ·{" "}
        <span style={{ color: accent }}>{is4 ? "4→4" : "2→2"} rule</span>{" "}
        · tick <span style={{ color: "#4ee4a3" }}>{state.tick}</span>
        {running && (
          <span style={{ color: "#e8a44e", marginLeft: "8px", fontSize: "10px" }}>● running</span>
        )}
      </p>

      {/* Settings modal */}
      {settingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            style={{
              background: "#0e0e16",
              border: "1px solid #2a2e38",
              borderRadius: "10px",
              padding: "20px 22px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="settings-title"
              style={{
                margin: "0 0 14px 0",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#e0e4e8",
              }}
            >
              Rule mode
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  cursor: "pointer",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: ruleMode === RULE_MODE_2X2 ? "1px solid #3a6a52" : "1px solid #1c1c28",
                  background: ruleMode === RULE_MODE_2X2 ? "#0a1812" : "transparent",
                }}
              >
                <input
                  type="radio"
                  name="ruleMode"
                  checked={ruleMode === RULE_MODE_2X2}
                  onChange={() => handleRuleModeChange(RULE_MODE_2X2)}
                  style={{ marginTop: "3px" }}
                />
                <span>
                  <span style={{ color: "#4ee4a3", fontWeight: 600 }}>2-input / 2-output</span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "10px",
                      color: "#585e68",
                      marginTop: "6px",
                      lineHeight: 1.45,
                    }}
                  >
                    Each node reads one horizontal and one vertical wire, applies a 2-bit → 2-bit
                    rule, and writes east / south. Classic cosmic grid behavior.
                  </span>
                </span>
              </label>
              <label
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  cursor: "pointer",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: ruleMode === RULE_MODE_4X4 ? "1px solid #2a4a5e" : "1px solid #1c1c28",
                  background: ruleMode === RULE_MODE_4X4 ? "#0a1218" : "transparent",
                }}
              >
                <input
                  type="radio"
                  name="ruleMode"
                  checked={ruleMode === RULE_MODE_4X4}
                  onChange={() => handleRuleModeChange(RULE_MODE_4X4)}
                  style={{ marginTop: "3px" }}
                />
                <span>
                  <span style={{ color: "#6ec4e8", fontWeight: 600 }}>4-input / 4-output</span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "10px",
                      color: "#585e68",
                      marginTop: "6px",
                      lineHeight: 1.45,
                    }}
                  >
                    Tuple{" "}
                    <code style={{ color: "#7a8088" }}>
                      [ix+ iy+ ix− iy−] → [ox+ oy+ ox− oy−]
                    </code>{" "}
                    with fixed edge directions. Shared wires are updated as XOR of the two incident
                    cells' outputs.
                  </span>
                </span>
              </label>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              style={{
                ...btnBase,
                marginTop: "16px",
                width: "100%",
                background: "#1a3a2e",
                color: "#4ee4a3",
                border: "1px solid #2a4a3a",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

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
          maxHeight: is4 ? "200px" : "none",
          overflowY: is4 ? "auto" : "visible",
        }}
      >
        <span
          style={{
            fontSize: "9px",
            color: "#484e56",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginRight: "4px",
            width: "100%",
            textAlign: "center",
          }}
        >
          Rule{" "}
          {is4
            ? "(ix+ iy+ ix− iy− → ox+ oy+ ox− oy−)"
            : "(ix iy → ox oy)"}
        </span>
        {!is4
          ? ruleLabels2.map((label, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "13px",
                }}
              >
                <span style={{ color: "#3a3e48" }}>[{label}]→[</span>
                <span
                  onClick={() => updateRule2(idx, 0)}
                  style={{
                    cursor: "pointer",
                    color: rule2[idx][0] ? "#4ee4a3" : "#2a2e38",
                    fontWeight: 700,
                    userSelect: "none",
                    transition: "color 0.15s",
                  }}
                >
                  {rule2[idx][0]}
                </span>
                <span
                  onClick={() => updateRule2(idx, 1)}
                  style={{
                    cursor: "pointer",
                    color: rule2[idx][1] ? "#4ee4a3" : "#2a2e38",
                    fontWeight: 700,
                    userSelect: "none",
                    transition: "color 0.15s",
                  }}
                >
                  {rule2[idx][1]}
                </span>
                <span style={{ color: "#3a3e48" }}>]</span>
              </div>
            ))
          : Array.from({ length: 16 }, (_, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  fontSize: "11px",
                }}
              >
                <span style={{ color: "#3a3e48" }}>
                  [{fourInLabel(idx)}]→[
                </span>
                {[0, 1, 2, 3].map((outIdx) => (
                  <span
                    key={outIdx}
                    onClick={() => updateRule4(idx, outIdx)}
                    style={{
                      cursor: "pointer",
                      color: rule4[idx][outIdx] ? "#6ec4e8" : "#2a2e38",
                      fontWeight: 700,
                      userSelect: "none",
                      transition: "color 0.15s",
                    }}
                  >
                    {rule4[idx][outIdx]}
                  </span>
                ))}
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
          style={{
            ...btnBase,
            background: "#4ee4a3",
            color: "#08080c",
            fontWeight: 700,
            padding: "9px 28px",
          }}
        >
          Tick
        </button>
        <button
          onClick={() => handleMultiTick(5)}
          style={{
            ...btnBase,
            background: "#1a3a2e",
            color: "#4ee4a3",
            border: "1px solid #2a4a3a",
          }}
        >
          ×5
        </button>
        <button
          onClick={() => handleMultiTick(20)}
          style={{
            ...btnBase,
            background: "#1a3a2e",
            color: "#4ee4a3",
            border: "1px solid #2a4a3a",
          }}
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

      <p
        style={{
          fontSize: "9px",
          color: "#2e323a",
          margin: "0 0 12px 0",
          textAlign: "center",
        }}
      >
        Click any signal to toggle · Click rule digits to edit · Edges wrap
        around · <span style={{ color: accent }}>—</span> h-signal{" "}
        <span style={{ color: accent }}>|</span> v-signal
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
                stroke={val ? `${accent}18` : "#0e0e14"}
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
                stroke={val ? `${accent}18` : "#0e0e14"}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            );
          })}

          {/* Wire background lines (2→2 only — in 4→4 circles are tangent) */}
          {!is4 &&
            Array.from({ length: GRID_SIZE }, (_, r) =>
              Array.from({ length: GRID_SIZE }, (_, c) => {
                const x = nodeX(c);
                const y = nodeY(r);
                return (
                  <g key={`wire-${r}-${c}`}>
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

          {/*
            SVG paint order (bottom → top):
            1. Wire signals (h/v) — in 2→2: line segments in gaps; in 4→4: dots at tangent points
            2. Node shapes (disc fill covers any wire bleed)
            3. Output spokes (4→4 only, center → circumference, on top of fill)
          */}

          {/* Horizontal wire signals */}
          {Array.from({ length: GRID_SIZE }, (_, r) =>
            Array.from({ length: GRID_SIZE }, (_, c) => {
              const val = state.hSignals[r][c];
              const dotY = nodeY(r);

              if (is4) {
                const isWrap = c === 0;
                const dotX = isWrap
                  ? nodeX(0) - CELL / 2 + 6
                  : (nodeX(c - 1) + nodeX(c)) / 2;
                return (
                  <g
                    key={`h-${r}-${c}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => toggleH(r, c)}
                  >
                    <rect
                      x={dotX - 10}
                      y={dotY - 10}
                      width={20}
                      height={20}
                      fill="transparent"
                    />
                    {isWrap && val === 1 && (
                      <circle
                        cx={dotX}
                        cy={dotY}
                        r={SIG_DOT_R + 3}
                        fill={accent}
                        opacity={0.18}
                      />
                    )}
                    {isWrap && (
                      <circle
                        cx={dotX}
                        cy={dotY}
                        r={SIG_DOT_R}
                        fill={val ? accent : "#1a1e24"}
                        stroke={val ? accent : "#22262e"}
                        strokeWidth={val ? 0 : 1}
                      />
                    )}
                  </g>
                );
              }

              let dotX;
              if (c === 0) {
                dotX = nodeX(0) - CELL / 2 + 6;
              } else {
                dotX = (nodeX(c - 1) + nodeX(c)) / 2;
              }
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
                      stroke={accent}
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
                    stroke={val ? accent : "#22262e"}
                    strokeWidth={val ? 3 : 2}
                    strokeLinecap="round"
                  />
                </g>
              );
            })
          )}

          {/* Vertical wire signals */}
          {Array.from({ length: GRID_SIZE }, (_, r) =>
            Array.from({ length: GRID_SIZE }, (_, c) => {
              const val = state.vSignals[r][c];
              const dotX = nodeX(c);

              if (is4) {
                const isWrap = r === 0;
                const dotY = isWrap
                  ? nodeY(0) - CELL / 2 + 6
                  : (nodeY(r - 1) + nodeY(r)) / 2;
                return (
                  <g
                    key={`v-${r}-${c}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => toggleV(r, c)}
                  >
                    <rect
                      x={dotX - 10}
                      y={dotY - 10}
                      width={20}
                      height={20}
                      fill="transparent"
                    />
                    {isWrap && val === 1 && (
                      <circle
                        cx={dotX}
                        cy={dotY}
                        r={SIG_DOT_R + 3}
                        fill={accent}
                        opacity={0.18}
                      />
                    )}
                    {isWrap && (
                      <circle
                        cx={dotX}
                        cy={dotY}
                        r={SIG_DOT_R}
                        fill={val ? accent : "#1a1e24"}
                        stroke={val ? accent : "#22262e"}
                        strokeWidth={val ? 0 : 1}
                      />
                    )}
                  </g>
                );
              }

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
                      stroke={accent}
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
                    stroke={val ? accent : "#22262e"}
                    strokeWidth={val ? 3 : 2}
                    strokeLinecap="round"
                  />
                </g>
              );
            })
          )}

          {/* Nodes — shape on top of wires, then spokes on top of fill */}
          {Array.from({ length: GRID_SIZE }, (_, r) =>
            Array.from({ length: GRID_SIZE }, (_, c) => {
              const x = nodeX(c);
              const y = nodeY(r);
              const ixp = state.hSignals[r][c];
              const iyp = state.vSignals[r][c];

              if (is4) {
                const ixm = state.hSignals[r][(c + 1) % GRID_SIZE];
                const iym = state.vSignals[(r + 1) % GRID_SIZE][c];
                const [oxp, oyp, oxm, oym] = applyRule4(ixp, iyp, ixm, iym, rule4);
                const active = oxp || oyp || oxm || oym;
                return (
                  <g key={`node-${r}-${c}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={nR}
                      fill={active ? "#111118" : "#0c0c12"}
                      stroke={active ? "#2e3238" : "#1a1a22"}
                      strokeWidth={1}
                    />
                    {oxp === 1 && (
                      <line
                        x1={x}
                        y1={y}
                        x2={x + spokeLen}
                        y2={y}
                        stroke="#6ec4e8"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    )}
                    {oyp === 1 && (
                      <line
                        x1={x}
                        y1={y}
                        x2={x}
                        y2={y + spokeLen}
                        stroke="#6ec4e8"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    )}
                    {oxm === 1 && (
                      <line
                        x1={x}
                        y1={y}
                        x2={x - spokeLen}
                        y2={y}
                        stroke="#6ec4e8"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    )}
                    {oym === 1 && (
                      <line
                        x1={x}
                        y1={y}
                        x2={x}
                        y2={y - spokeLen}
                        stroke="#6ec4e8"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                );
              }

              const hasInput = ixp || iyp;
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
                    {ixp}{iyp}
                  </text>
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
          <span style={{ color: accent }}>
            {state.hSignals.flat().reduce((a, b) => a + b, 0)}
          </span>
        </span>
        <span>
          v-signals on:{" "}
          <span style={{ color: accent }}>
            {state.vSignals.flat().reduce((a, b) => a + b, 0)}
          </span>
        </span>
      </div>
    </div>
  );
}
