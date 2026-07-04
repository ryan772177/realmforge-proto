import type { CSSProperties } from "react";
import type { CauseLine } from "../scoring/types";

interface Props {
  buildingName: string;
  // "preview" (default): live drag placement, shows a before -> after delta.
  // "detail" (§21.2 task 5): tapping an already-placed building — same
  // component, same causeLines source, but there's no "after" to show, just
  // what this building is contributing right now.
  mode?: "preview" | "detail";
  rejectionText?: string | null;
  causeLines?: CauseLine[];
  prosperityBefore?: number;
  prosperityAfter?: number;
  contribution?: number;
}

// §18: one component, reads ScoreReport-derived data only — no arithmetic on
// score values happens here, only display formatting.
export default function AdjacencyReport({
  buildingName, mode = "preview", rejectionText, causeLines, prosperityBefore, prosperityAfter, contribution,
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

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>{buildingName}</div>

      {visible.length === 0 ? (
        <div style={{ opacity: 0.6, fontStyle: "italic", marginBottom: 4 }}>
          {mode === "detail" ? "No bonuses or penalties right now." : "No bonuses here. Try near a Forest."}
        </div>
      ) : (
        visible.map((line, i) => (
          <div key={i} style={{ color: line.isConflict ? "#ff6b6b" : "#8fe38f", marginBottom: 2 }}>
            ▸ {line.text}
          </div>
        ))
      )}

      {mode === "detail" ? (
        <div
          style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            fontWeight: 700,
            color: "#ffd700",
          }}
        >
          Contributing {(contribution ?? 0) >= 0 ? "+" : ""}{Math.round(contribution ?? 0)} to Prosperity
        </div>
      ) : (
        <ProsperityDelta before={prosperityBefore ?? 0} after={prosperityAfter ?? (prosperityBefore ?? 0)} />
      )}
    </div>
  );
}

function ProsperityDelta({ before, after }: { before: number; after: number }) {
  const delta = after - before;
  return (
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
