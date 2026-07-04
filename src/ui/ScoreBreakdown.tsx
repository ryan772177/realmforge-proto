import type { ScoreReport } from "../scoring/types";

interface Props {
  report: ScoreReport;
  open: boolean;
  onToggle: () => void;
  pulse?: boolean;
}

// §16.3 format. Reads ScoreReport only — every number here is already
// computed by the scoring module; this component just formats and joins.
function summarize(lines: { buildingName: string; contribution: number }[]): string {
  if (lines.length === 0) return "";
  return " (" + lines.map((l) => `${l.buildingName} ${Math.round(l.contribution)}`).join(" · ") + ")";
}

export default function ScoreBreakdown({ report, open, onToggle, pulse }: Props) {
  return (
    <div style={{ marginBottom: 8 }} className={pulse ? "rf-pulse" : undefined}>
      <button
        onClick={onToggle}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          font: "inherit",
          color: "#ffd700",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        Prosperity: {report.prosperity}
      </button>

      {open && (
        <div
          style={{
            marginTop: 6,
            background: "rgba(20,20,20,0.92)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "#f0f0f0",
            lineHeight: 1.6,
          }}
        >
          <div>+{Math.round(report.production)} Production{summarize(report.productionBreakdown)}</div>
          <div>+{report.population} Population ({report.totalPop} citizens × 2)</div>
          <div>+{report.happiness} Happiness ({report.happyPts} points × 2)</div>
          <div>+{Math.round(report.mana)} Mana{summarize(report.manaBreakdown)}</div>
          <div>+{Math.round(report.beauty)} Beauty{summarize(report.beautyBreakdown)}</div>
          <div>−{report.imbalance} Imbalance</div>
        </div>
      )}
    </div>
  );
}
