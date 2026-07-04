import type { FtueState } from "../game/ftue";
import { getStep } from "../game/ftue";
import type { RivalState } from "../game/rival";

// A simple hint sentence per fallback key — the doc's fallback hints
// ("tile_shimmer", "ghost_arrow_to_3forest_tile", ...) describe bespoke
// visual effects; rendering each as a unique animation is out of scope for
// this greybox pass, so they collapse to one plain-text nudge line instead.
const HINT_TEXT: Record<string, string> = {
  tile_shimmer: "Try any open tile.",
  forest_tiles_pulse: "Look for the green Forest tiles.",
  report_enlarges_once: "Check the panel above the tray.",
  ghost_arrow_to_3forest_tile: "Try the tile with 3 Forest neighbors.",
  icon_bounce_amplifies: "Tap the building to collect.",
  cost_tooltip: "Costs 30 Wood.",
  score_pulses: "Tap the Prosperity number.",
  range_circle_preview_auto_shows: "Place it within 2 tiles of your Cottage.",
  synergy_line_draws_camp_to_mill: "Place it within 2 tiles of your Lumber Camp.",
  quest_hint_to_claim: "Check your quests.",
  card_re_peeks: "Tap the rival chip, top right.",
  chest_glow: "Open your quest chest.",
};

interface Props {
  ftue: FtueState;
  // Only step 11's microcopy currently uses {name}/{rivalScore} placeholders
  // (the doc's locked copy names a fixed example rival — "Thornwick: 340" —
  // that won't match the actual seeded rival; these let it stay accurate).
  rival?: RivalState | null;
  playerScore?: number;
}

function interpolate(text: string, rival: RivalState | null | undefined, playerScore: number | undefined): string {
  if (!text.includes("{")) return text;
  return text
    .replace("{name}", rival?.name ?? "your rival")
    .replace("{rivalScore}", rival ? String(rival.score) : "?")
    .replace("{playerScore}", playerScore !== undefined ? String(playerScore) : "?");
}

export default function FtueDirector({ ftue, rival, playerScore }: Props) {
  if (!ftue.active) return null;
  const step = getStep(ftue.stepIndex);
  const microcopy = interpolate(step.microcopy, rival, playerScore);

  return (
    <div
      style={{
        textAlign: "center",
        marginBottom: 10,
        padding: "6px 10px",
        background: "rgba(255,215,0,0.08)",
        border: "1px solid rgba(255,215,0,0.25)",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#ffe680" }}>{microcopy}</div>
      {ftue.fallbackShown && (
        <div style={{ fontSize: 11, color: "rgba(255,230,128,0.7)", marginTop: 3 }}>
          {HINT_TEXT[step.fallback.hint] ?? step.playerAction}
        </div>
      )}
    </div>
  );
}
