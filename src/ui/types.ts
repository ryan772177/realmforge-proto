import type { BuildingId } from "../scoring/types";

export interface DragUI {
  buildingId: BuildingId;
  hoverRow: number | null;
  hoverCol: number | null;
  hoverValid: boolean;
  hoverText: string | null;
}
