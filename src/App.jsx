import { Routes, Route, Navigate, Link } from "react-router-dom";
import HomePage from "./HomePage.jsx";
import HexCosmicGrid from "../hex-cosmic-grid.jsx";
import CosmicGrid from "../cosmic-grid-toroidal.jsx";
import CosmicGrid4x4 from "../cosmic-grid-4x4.jsx";
import CosmicMagicSearch from "../cosmic-magic-search.jsx";
import CosmicGridParticles from "../cosmic-grid-particles.jsx";

const font =
  "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

function HomeLink({ corner = "top-left" }) {
  // For routes whose own UI lives in the top-left (e.g. /particles), use
  // top-right with tighter styling so the link sits in the topbar's empty
  // right edge instead of covering the page title.
  const compact = corner === "top-right";
  const positionStyle = compact
    ? { top: 10, right: 14, fontSize: "10px", padding: "5px 8px" }
    : { top: 14, left: 14, fontSize: "11px", padding: "8px 10px" };
  return (
    <Link
      to="/"
      style={{
        position: "fixed",
        zIndex: 10000,
        fontFamily: font,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "#4ee4a3",
        textDecoration: "none",
        borderRadius: "6px",
        background: "rgba(8, 8, 12, 0.85)",
        border: "1px solid #2a2e38",
        ...positionStyle,
      }}
    >
      ← Home
    </Link>
  );
}

function ModelShell({ children, homeCorner }) {
  return (
    <>
      <HomeLink corner={homeCorner} />
      {children}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/hex"
        element={
          <ModelShell>
            <HexCosmicGrid />
          </ModelShell>
        }
      />
      <Route
        path="/toroidal"
        element={
          <ModelShell>
            <CosmicGrid />
          </ModelShell>
        }
      />
      <Route
        path="/4x4"
        element={
          <ModelShell>
            <CosmicGrid4x4 />
          </ModelShell>
        }
      />
      <Route
        path="/magic-search"
        element={
          <ModelShell>
            <CosmicMagicSearch />
          </ModelShell>
        }
      />
      <Route
        path="/particles"
        element={
          <ModelShell homeCorner="top-right">
            <CosmicGridParticles />
          </ModelShell>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
