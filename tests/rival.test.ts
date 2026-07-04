import { describe, it, expect } from "vitest";
import {
  revealRival,
  recordPlayerAction,
  applyBetweenSessionGrowth,
  applyComeback,
  rivalMicrocopy,
  beatsRival,
} from "../src/game/rival";

describe("rival: determinism", () => {
  it("same seed + same action sequence yields identical final state", () => {
    function run() {
      let r = revealRival("save-abc", 306);
      for (let i = 0; i < 20; i++) {
        r = recordPlayerAction(r, 306 + i * 5);
      }
      return r;
    }
    const a = run();
    const b = run();
    expect(a).toEqual(b);
  });

  it("different seeds can diverge in name and growth draws", () => {
    const a = revealRival("save-abc", 306);
    const b = revealRival("save-xyz", 306);
    // Not asserting inequality of name (12-name pool could coincide), but the
    // reveal score itself must be identical (fixed offset, not seed-dependent).
    expect(a.score).toBe(340);
    expect(b.score).toBe(340);
  });
});

describe("rival: first reveal", () => {
  it("rival score is player score + 34 at first reveal", () => {
    const r = revealRival("seed1", 306);
    expect(r.score).toBe(340);
    expect(r.revealed).toBe(true);
    expect(r.actionCount).toBe(0);
  });
});

describe("rival: ongoing growth band", () => {
  it("only updates every 3rd action, and stays within the uniform(1.05,1.15) band before the cap", () => {
    // Reveal at a low player score so the fixed +34 offset floor is well
    // below the growth band's output once the player score climbs.
    let r = revealRival("seed-growth", 100); // rival = 134
    r = recordPlayerAction(r, 2000); // action 1 — no update yet
    expect(r.score).toBe(134);
    r = recordPlayerAction(r, 2000); // action 2 — no update yet
    expect(r.score).toBe(134);
    r = recordPlayerAction(r, 2000); // action 3 — updates against player=2000
    expect(r.score).toBeGreaterThanOrEqual(Math.round(2000 * 1.05));
    expect(r.score).toBeLessThanOrEqual(Math.round(2000 * 1.15));
  });

  it("never decreases even if the growth draw would be lower than the current score", () => {
    let r = revealRival("seed-nodrop", 500); // score = 534
    // Player score collapses (hypothetically); growth band applied to a much
    // lower player score would produce a candidate below the current rival score.
    for (let i = 0; i < 3; i++) r = recordPlayerAction(r, 10);
    expect(r.score).toBeGreaterThanOrEqual(534);
  });
});

describe("rival: cap", () => {
  it("never leads the player by more than maxLeadOverPlayer (150)", () => {
    let r = revealRival("seed-cap", 0);
    for (let i = 0; i < 30; i++) {
      r = recordPlayerAction(r, 10000);
    }
    expect(r.score).toBeLessThanOrEqual(10000 + 150);
  });
});

describe("rival: between-session growth and comeback", () => {
  it("between-session growth increases score by 5-10%", () => {
    const r = revealRival("seed-session", 300); // 334
    const grown = applyBetweenSessionGrowth(r, 1);
    expect(grown.score).toBeGreaterThanOrEqual(Math.round(334 * 1.05));
    expect(grown.score).toBeLessThanOrEqual(Math.round(334 * 1.10));
  });

  it("comeback growth increases score by 8-12%", () => {
    const r = revealRival("seed-comeback", 300); // 334
    const grown = applyComeback(r, 1);
    expect(grown.score).toBeGreaterThanOrEqual(Math.round(334 * 1.08));
    expect(grown.score).toBeLessThanOrEqual(Math.round(334 * 1.12));
  });
});

describe("rival: microcopy and beatsRival", () => {
  it("formats reveal microcopy with name/rival/player scores", () => {
    const r = revealRival("seed-copy", 306);
    const text = rivalMicrocopy(r, 306, "reveal");
    expect(text).toContain(r.name);
    expect(text).toContain("340");
    expect(text).toContain("306");
  });

  it("beatsRival is true once player score meets or exceeds rival score", () => {
    const r = revealRival("seed-beat", 100); // rival 134
    expect(beatsRival(r, 133)).toBe(false);
    expect(beatsRival(r, 134)).toBe(true);
    expect(beatsRival(r, 200)).toBe(true);
  });
});
