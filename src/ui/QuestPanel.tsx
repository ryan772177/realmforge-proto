import type { QuestDef, QuestId, QuestStatus } from "../game/quests";

interface Props {
  quests: QuestDef[];
  status: Record<QuestId, QuestStatus>;
  onClaim: (id: QuestId) => void;
  pulse?: boolean;
}

function rewardText(reward: QuestDef["reward"]): string {
  if (!reward) return "";
  const isChest = reward.type === "chest";
  const gold = reward.gold;
  if (gold === undefined) return "";
  return isChest ? `${gold} Gold chest` : `${gold} Gold`;
}

export default function QuestPanel({ quests, status, onClaim, pulse }: Props) {
  const visible = quests.filter((q) => status[q.id] !== "locked");
  if (visible.length === 0) return null;

  return (
    <div
      className={pulse ? "rf-pulse" : undefined}
      style={{
        background: "rgba(20,20,20,0.9)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 8,
        fontSize: 12,
        color: "#f0f0f0",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Quests</div>
      {visible.map((q) => {
        const s = status[q.id];
        const reward = rewardText(q.reward);
        return (
          <div
            key={q.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 0",
              opacity: s === "claimed" ? 0.45 : 1,
            }}
          >
            <span style={{ textDecoration: s === "claimed" ? "line-through" : "none" }}>
              {q.objective}
              {reward ? <span style={{ opacity: 0.6 }}> — {reward}</span> : null}
            </span>
            {s === "completed" && q.reward && (
              <button
                onClick={() => onClaim(q.id)}
                style={{
                  background: "#ffd700",
                  border: "none",
                  borderRadius: 4,
                  padding: "3px 8px",
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer",
                  color: "#000",
                  marginLeft: 8,
                  flexShrink: 0,
                }}
              >
                Claim
              </button>
            )}
            {s === "claimed" && <span style={{ fontSize: 11 }}>✓</span>}
          </div>
        );
      })}
    </div>
  );
}
