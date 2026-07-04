import type { BuildingId } from "../scoring/types";
import type { Resources } from "../game/economy";
import buildingsJson from "../../config/buildings.json";

const RESOURCE_ABBREV: Record<string, string> = {
  gold: "G", wood: "W", stone: "St", mana: "M", gems: "Gm",
};

function formatCost(cost: Record<string, number>): string {
  return Object.entries(cost)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v}${RESOURCE_ABBREV[k] ?? k}`)
    .join(" ");
}

function affordable(cost: Record<string, number>, resources: Resources): boolean {
  return Object.entries(cost).every(([k, v]) => (resources[k as keyof Resources] ?? 0) >= v);
}

interface Props {
  resources: Resources;
  unlockedIds: ReadonlySet<BuildingId>;
  onBuildingPointerDown: (e: React.PointerEvent, buildingId: BuildingId) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  highlightBuildingId?: BuildingId | null;
}

export default function BuildingTray({
  resources, unlockedIds, onBuildingPointerDown, onPointerMove, onPointerUp, onPointerCancel,
  highlightBuildingId,
}: Props) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "0 4px" }}>
        {buildingsJson.buildings.filter(b => unlockedIds.has(b.id as BuildingId)).map(b => {
          const id = b.id as BuildingId;
          const cost = b.cost as unknown as Record<string, number>;
          const canAfford = affordable(cost, resources);
          const costStr = formatCost(cost);

          return (
            <div
              key={id}
              className={highlightBuildingId === id ? "rf-pulse" : undefined}
              onPointerDown={(e) => { if (canAfford) onBuildingPointerDown(e, id); }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              style={{
                background: canAfford ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
                border: "2px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                color: canAfford ? "#f0f0f0" : "rgba(255,255,255,0.3)",
                padding: "8px 4px",
                cursor: canAfford ? "grab" : "not-allowed",
                textAlign: "center",
                fontSize: 11,
                lineHeight: 1.3,
                userSelect: "none",
                touchAction: "none",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{b.name}</div>
              <div style={{ fontSize: 10, opacity: canAfford ? 0.75 : 0.4 }}>
                {costStr || "Free"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
