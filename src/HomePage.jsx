import { Link } from "react-router-dom";

const font =
  "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const cardBase = {
  display: "block",
  textDecoration: "none",
  color: "#c8ccd0",
  background: "#12141a",
  border: "1px solid #2a2e38",
  borderRadius: "10px",
  padding: "24px 28px",
  maxWidth: "420px",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease, background 0.15s ease",
};

export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080c",
        color: "#c8ccd0",
        fontFamily: font,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          fontSize: "18px",
          fontWeight: 600,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#e0e4e8",
          margin: "0 0 8px 0",
        }}
      >
        Cosmic grid
      </h1>
      <p
        style={{
          fontSize: "12px",
          color: "#5a6068",
          margin: "0 0 36px 0",
          textAlign: "center",
          lineHeight: 1.5,
          maxWidth: "420px",
        }}
      >
        Pick a simulation model. Each opens the full interactive grid; use{" "}
        <span style={{ color: "#4ee4a3" }}>home</span> (top left) to switch.
      </p>
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          width: "100%",
          alignItems: "stretch",
        }}
      >
        <Link
          to="/hex"
          style={cardBase}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#4ee4a3";
            e.currentTarget.style.background = "#151820";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2a2e38";
            e.currentTarget.style.background = "#12141a";
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#e0e4e8",
            }}
          >
            Hex grid (planar)
          </span>
          <span
            style={{
              display: "block",
              marginTop: "10px",
              fontSize: "11px",
              color: "#6a7078",
              lineHeight: 1.45,
              letterSpacing: "0.02em",
              textTransform: "none",
            }}
          >
            Bounded hex lattice with CM-1 six-port rules, adjustable radius, and
            presets.
          </span>
        </Link>
        <Link
          to="/toroidal"
          style={cardBase}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#4ee4a3";
            e.currentTarget.style.background = "#151820";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2a2e38";
            e.currentTarget.style.background = "#12141a";
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#e0e4e8",
            }}
          >
            Toroidal grid
          </span>
          <span
            style={{
              display: "block",
              marginTop: "10px",
              fontSize: "11px",
              color: "#6a7078",
              lineHeight: 1.45,
              letterSpacing: "0.02em",
              textTransform: "none",
            }}
          >
            10×10 square mesh with wrap-around edges and a 2-input/2-output
            rule table.
          </span>
        </Link>
        <Link
          to="/4x4"
          style={cardBase}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#4ee4a3";
            e.currentTarget.style.background = "#151820";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2a2e38";
            e.currentTarget.style.background = "#12141a";
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#e0e4e8",
            }}
          >
            Cosmic grid 4x4
          </span>
          <span
            style={{
              display: "block",
              marginTop: "10px",
              fontSize: "11px",
              color: "#6a7078",
              lineHeight: 1.45,
              letterSpacing: "0.02em",
              textTransform: "none",
            }}
          >
            Default 10×10 toroidal mesh (configurable 1-30) with four
            directional signal channels and a 4-bit input/output rule editor.
          </span>
        </Link>
        <Link
          to="/magic-search"
          style={cardBase}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#4ee4a3";
            e.currentTarget.style.background = "#151820";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2a2e38";
            e.currentTarget.style.background = "#12141a";
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#e0e4e8",
            }}
          >
            Magic square rule search
          </span>
          <span
            style={{
              display: "block",
              marginTop: "10px",
              fontSize: "11px",
              color: "#6a7078",
              lineHeight: 1.45,
              letterSpacing: "0.02em",
              textTransform: "none",
            }}
          >
            Search all 4x4 linear rules (2^16) and find evolutions that produce a
            4x4 magic square.
          </span>
        </Link>
        <a
          href="/books/"
          style={cardBase}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#4ee4a3";
            e.currentTarget.style.background = "#151820";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2a2e38";
            e.currentTarget.style.background = "#12141a";
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#e0e4e8",
            }}
          >
            Book: Cosmic Grid
          </span>
          <span
            style={{
              display: "block",
              marginTop: "10px",
              fontSize: "11px",
              color: "#6a7078",
              lineHeight: 1.45,
              letterSpacing: "0.02em",
              textTransform: "none",
            }}
          >
            Read the full book online — a unified framework of physics,
            consciousness, and the Creator. Available in English and Chinese.
          </span>
        </a>
      </nav>
    </div>
  );
}
