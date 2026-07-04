import type { CSSProperties } from "react";
import type { CauseLine } from "../scoring/types";

interface Props {
  buildingName: string;
  rejectionText?: string | null;
  causeLines?: CauseLine[];
  prosperityBefore?: number;
  prosperityAfter?: number;
}

// §18: one component, reads ScoreReport-derived data only — no arithmetic on
// score values happens here, only display formatting.
export default function AdjacencyReport({
  buildingName, rejectionText, causeLines, prosperityBefore, prosperityAfter,
}: Props) {
  if (rejectionText) {
    return (
      <div style={panelStyle}>
        <div style={titleStyle}>{buildingName}</div>
        <div style={{ color: "#ff6b6b" }}>▸ {rejectionText}</div>
      </div>
    );
  }

  const lines = causeLines ?? [];
  const visible = lines.slice(0, 4);
  const before = prosperityBefore ?? 0;
  const after = prosperityAfter ?? before;
  const delta = after - before;

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>{buildingName}</div>

      {visible.length === 0 ? (
        <div style={{ opacity: 0.6, fontStyle: "italic", marginBottom: 4 }}>
          No bonuses here. Try near a Forest.
        </div>
      ) : (
        visible.map((line, i) => (
          <div key={i} style={{ color: line.isConflict ? "#ff6b6b" : "#8fe38f", marginBottom: 2 }}>
            ▸ {line.text}
          </div>
        ))
      )}

      <div
        style={{
          marginTop: 6,
          paddingTop: 6,
          borderTop: "1px solid rgba(255,255,255,0.12)",
          fontWeight: 700,
          color: delta >= 0 ? "#ffd700" : "#ff6b6b",
        }}
      >
        Prosperity {delta >= 0 ? "+" : ""}{delta} ({before} → {after})
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: "rgba(20,20,20,0.92)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  padding: "8px 12px",
  marginBottom: 8,
  fontSize: 12,
  color: "#f0f0f0",
};

const titleStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 13,
  marginBottom: 4,
};
