import { describe, it, expect, beforeEach } from "vitest";
import {
  track, getLog, clearLog, exportLogAsJson, resetSession, trackConfusionTap,
} from "../src/game/analytics";

beforeEach(() => {
  clearLog();
  resetSession();
});

describe("analytics: track", () => {
  it("appends an entry with event, payload, and a non-negative t", () => {
    const entry = track("building_placed", { building_id: "B01" });
    expect(entry.event).toBe("building_placed");
    expect(entry.payload).toEqual({ building_id: "B01" });
    expect(entry.t).toBeGreaterThanOrEqual(0);
    expect(getLog()).toHaveLength(1);
    expect(getLog()[0]).toEqual(entry);
  });

  it("defaults to an empty payload when omitted", () => {
    track("ftue_start");
    expect(getLog()[0]!.payload).toEqual({});
  });

  it("preserves insertion order across multiple events", () => {
    track("ftue_start");
    track("town_hall_placed", { building_id: "B01" });
    track("claim", { resource: "wood", amount: 5 });
    expect(getLog().map((e) => e.event)).toEqual(["ftue_start", "town_hall_placed", "claim"]);
  });
});

describe("analytics: export and clear", () => {
  it("exportLogAsJson produces valid JSON parseable back into the same entries", () => {
    track("session_end", { duration_ms: 1000, buildings: 3, relocations: 1, final_score: 306 });
    const json = exportLogAsJson();
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(getLog());
  });

  it("clearLog empties the log", () => {
    track("ftue_start");
    clearLog();
    expect(getLog()).toHaveLength(0);
    expect(JSON.parse(exportLogAsJson())).toEqual([]);
  });
});

describe("analytics: confusion tap clustering", () => {
  it("does not flag a cluster below the 3-tap threshold", () => {
    trackConfusionTap("grid");
    trackConfusionTap("grid");
    const events = getLog().map((e) => e.event);
    expect(events.filter((e) => e === "confusion_cluster")).toHaveLength(0);
  });

  it("flags a confusion_cluster on the 3rd tap within the 10s window", () => {
    trackConfusionTap("grid");
    trackConfusionTap("grid");
    trackConfusionTap("grid");
    const events = getLog().map((e) => e.event);
    expect(events.filter((e) => e === "confusion_cluster")).toHaveLength(1);
  });
});
