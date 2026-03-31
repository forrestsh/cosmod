import { Routes, Route, Navigate, Link } from "react-router-dom";
import HomePage from "./HomePage.jsx";
import HexCosmicGrid from "../hex-cosmic-grid.jsx";
import CosmicGrid from "../cosmic-grid-toroidal.jsx";
import CosmicGrid4x4 from "../cosmic-grid-4x4.jsx";
import CosmicMagicSearch from "../cosmic-magic-search.jsx";

const font =
  "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

function HomeLink() {
  return (
    <Link
      to="/"
      style={{
        position: "fixed",
        top: 14,
        left: 14,
        zIndex: 10000,
        fontSize: "11px",
        fontFamily: font,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "#4ee4a3",
        textDecoration: "none",
        padding: "8px 10px",
        borderRadius: "6px",
        background: "rgba(8, 8, 12, 0.85)",
        border: "1px solid #2a2e38",
      }}
    >
      ← Home
    </Link>
  );
}

function ModelShell({ children }) {
  return (
    <>
      <HomeLink />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
