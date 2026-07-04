import { useEffect, useRef, useState } from "react";
import type { RivalState } from "../game/rival";
import { rivalMicrocopy } from "../game/rival";

interface Props {
  rival: RivalState;
  playerScore: number;
  onImproveMyScore: () => void;
  onViewedOrOpened: () => void;
  pulse?: boolean;
}

// §19.2: compact chip (name + delta) collapsed; tap expands to the full card
// with banner, both scores, a delta bar, and "Improve My Score".
export default function RivalCard({ rival, playerScore, onImproveMyScore, onViewedOrOpened, pulse }: Props) {
  const [open, setOpen] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => {
      if (!firedRef.current) {
        firedRef.current = true;
        onViewedOrOpened();
      }
    }, 2000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOpen() {
    if (!firedRef.current) {
      firedRef.current = true;
      onViewedOrOpened();
    }
    setOpen(true);
  }

  const delta = Math.abs(rival.score - playerScore);
  const ahead = playerScore >= rival.score;

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className={pulse ? "rf-pulse" : undefined}
        style={{
          position: "absolute",
          top: 12,
          right: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(20,20,20,0.85)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 20,
          padding: "4px 10px",
          cursor: "pointer",
          color: "#f0f0f0",
          fontSize: 11,
        }}
      >
        <span>{rival.name}</span>
        <span style={{ color: ahead ? "#8fe38f" : "#ff6b6b", fontWeight: 700 }}>
          {ahead ? "+" : "−"}{delta}
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        background: "rgba(20,20,20,0.95)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 8,
        fontSize: 12,
        color: "#f0f0f0",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Rival Realm: {rival.name}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span>{rival.name}</span>
        <span style={{ fontWeight: 700 }}>{rival.score}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span>You</span>
        <span style={{ fontWeight: 700 }}>{playerScore}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "rgba(255,255,255,0.12)",
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, Math.round((playerScore / Math.max(playerScore, rival.score, 1)) * 100))}%`,
            background: ahead ? "#8fe38f" : "#ff6b6b",
          }}
        />
      </div>
      <div style={{ opacity: 0.7, marginBottom: 10 }}>{rivalMicrocopy(rival, playerScore)}</div>
      <div style={{ opacity: 0.6, marginBottom: 10, fontStyle: "italic" }}>
        Rivals compare Prosperity weekly.
      </div>
      <button
        onClick={() => {
          setOpen(false);
          onImproveMyScore();
        }}
        style={{
          width: "100%",
          background: "#ffd700",
          border: "none",
          borderRadius: 6,
          padding: "8px 0",
          fontWeight: 700,
          cursor: "pointer",
          color: "#000",
        }}
      >
        Improve My Score
      </button>
    </div>
  );
}
