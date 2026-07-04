import type { RefObject } from "react";
import type { BoardState } from "../scoring/types";
import { hasPendingClaim } from "../game/economy";
import type { PendingAccrual } from "../game/economy";
import type { DragUI } from "./types";

const TERRAIN_COLOR: Record<string, string> = {
  F: "#2d6a2d", M: "#5e5e5e", R: "#2a6fa8", S: "#6a2fa8", C: "#8a6940",
};
const TERRAIN_LABEL: Record<string, string> = {
  F: "For", M: "Mtn", R: "Riv", S: "Spr", C: "",
};
const BUILDING_SHORT: Record<string, string> = {
  B01: "TH", B02: "LC", B03: "Co", B04: "Sh",
  B05: "SW", B06: "Qu", B07: "Dk", B08: "MT",
  B09: "Mk", B10: "Wt", B11: "Gd", B12: "Fg",
};

const TILE = 56;
const GAP = 2;

interface Props {
  board: BoardState;
  dragUI: DragUI | null;
  pendingAccrual: PendingAccrual;
  gridRef: RefObject<HTMLDivElement | null>;
  onTilePointerDown: (e: React.PointerEvent, row: number, col: number) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  highlightTiles?: { row: number; col: number }[];
  bounceClaimBadges?: boolean;
}

export default function RealmGrid({
  board, dragUI, pendingAccrual, gridRef,
  onTilePointerDown, onPointerMove, onPointerUp, onPointerCancel,
  highlightTiles, bounceClaimBadges,
}: Props) {
  const gridSize = TILE * 6 + GAP * 5;
  const highlighted = new Set((highlightTiles ?? []).map((t) => `${t.row},${t.col}`));

  return (
    <div
      ref={gridRef}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(6, ${TILE}px)`,
        gap: GAP,
        width: gridSize,
        margin: "0 auto",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {board.tiles.map(row =>
        row.map(tile => {
          const key = `${tile.row},${tile.col}`;
          const isHover = dragUI !== null
            && dragUI.hoverRow === tile.row
            && dragUI.hoverCol === tile.col;
          const hasClaim = hasPendingClaim(pendingAccrual, key);

          const borderColor = isHover
            ? (dragUI!.hoverValid ? "#00ff88" : "#ff4444")
            : "transparent";
          const isHinted = highlighted.has(key);

          return (
            <div
              key={key}
              className={isHinted ? "rf-pulse" : undefined}
              onPointerDown={(e) => onTilePointerDown(e, tile.row, tile.col)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              style={{
                width: TILE,
                height: TILE,
                background: TERRAIN_COLOR[tile.terrain] ?? "#444",
                border: `2px solid ${borderColor}`,
                borderRadius: 4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: tile.building ? "grab" : "default",
                position: "relative",
                transition: "border-color 0.08s",
                touchAction: "none",
              }}
            >
              {tile.building ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                  {BUILDING_SHORT[tile.building] ?? tile.building}
                </span>
              ) : (
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>
                  {TERRAIN_LABEL[tile.terrain]}
                </span>
              )}
              {hasClaim && (
                <div
                  className={bounceClaimBadges ? "rf-bounce" : undefined}
                  style={{
                    position: "absolute",
                    top: 2, right: 2,
                    width: 14, height: 14,
                    background: "#ffd700",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "#000",
                  }}
                >
                  +
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
