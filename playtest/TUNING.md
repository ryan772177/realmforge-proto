# Tuning levers — where the knobs actually live

No real playtest data exists yet to justify changing any of these numbers.
This is not a set of recommendations — it's a map, so that whenever real
behavioral data does arrive (§26 Week 2: "tuning via config only"), whoever's
tuning doesn't have to go hunting through `score.ts`/`validator.ts` to find
where a number lives. Every lever below is pure JSON — no code changes needed
to adjust any of them, and every one is covered by the existing test suite,
so a bad tuning change will fail loudly rather than silently break scoring.

## Terrain bonuses (config/buildings.json → each building's `terrainBonus`)

| Building | Terrain | Rate | Cap | Current effect |
|---|---|---|---|---|
| Lumber Camp (B02) | Forest | 0.20 | 3 | up to +60% production |
| Quarry (B06) | Mountain | 0.20 | 3 | up to +60% production |
| Fishing Dock (B07) | River (required) | 0.15 | 3 | up to +45% production |
| Mage Tower (B08) | Mana Spring | 0.25 | 2 | up to +50% mana |
| Forge (B12) | Mountain | 0.20 | 2 | up to +40% production |
| Garden (B11) | River | flat +10 Beauty per tile (uncapped) | — | not a multiplier |

**§27 candidate lever: "bigger terrain deltas"** means raising these `rate`
values (steeper reward for good placement) or lowering the `cap` (makes the
delta hit sooner) or raising it (rewards deeper terrain-hunting). This is the
most direct lever for the "score comprehension" and "voluntary relocation"
gates — the whole thesis is that terrain deltas should be big enough to
*notice* and act on.

## Synergy bonuses (config/synergies.json)

| ID | Source → Target | Bonus | Range | Cap |
|---|---|---|---|---|
| SYN_01 | Town Hall → producers | +10% | 2 | none |
| SYN_02 | Sawmill → Lumber Camp | +15% | 2 | 1 |
| SYN_03 | Lumber Camp → Sawmill | +10%/camp | 2 | 3 |
| SYN_04 | Quarry → Forge | +20% | 2 | 1 |
| SYN_05 | Shrine → Cottage | +5 Happiness/cottage | 2 | 3 |
| SYN_06 | Watchtower → Cottage | +5 Happiness/cottage | 2 | 4 |
| SYN_07 | Garden → Cottage | +5 Happiness/cottage | 1 | 2 |
| SYN_08 | Market → unique neighbor types | +10%/type | 2 | 5 |

Global synergy clamp: `+50%` cap (hardcoded in `src/scoring/score.ts`'s
`computeSynergy`, not config — a code change, not a config one, if this ever
needs to move).

## Conflicts (config/conflicts.json)

| ID | Source → Target | Penalty | Range | Type |
|---|---|---|---|---|
| CON_01 | Forge → Cottage | −10 Happiness | 2 | happiness |
| CON_02 | Forge → Garden | −10 Beauty | 2 | beauty |
| CON_03 | Quarry → Cottage | −5 Happiness | 1 | happiness |

**§27 candidate lever: "scarcer good tiles"** isn't a single number — it's
`config/terrain.json`'s hand-authored 6×6 map (tile counts: 7 Forest, 5
Mountain, 5 River, 2 Mana Spring, 17 Clear Land per the map's own `_counts`
metadata). Shrinking a terrain cluster or moving it further from the map's
center makes good placement harder to stumble into by accident, which is
the actual lever behind "scarcer."

## Costs (config/buildings.json → each building's `cost`)

All 12 buildings' costs are in one place, already tunable independently of
everything else. Notably: Town Hall is free (`{gold: 0}`), which is why the
maxCount bug (fixed separately) was exploitable — any future "free" building
should get the same maxCount scrutiny.

## Economy pacing (src/game/economy.ts — code constants, not JSON)

- `ACCRUAL_SPEED = 10` — 10x realtime (1 game-minute of output accrues in 6
  real seconds). This is the one pacing lever that lives in code rather than
  config; if it needs to become a tuning lever, it should move to a config
  file rather than staying a `const` (flagged here, not changed — no data to
  justify moving it).
- `RELOCATION_COST = { gold: 10 }` — post-FTUE relocation price. Directly
  relevant to the north-star metric: if voluntary relocation is too low
  because 10 Gold feels expensive post-FTUE, this is the first number to
  test lowering.
- `INITIAL_RESOURCES.gold = 100` — starting gold.

## Rival tuning (config/rival.json)

| Field | Current value |
|---|---|
| `firstRevealOffset` | +34 (rival = player score at reveal + 34) |
| `growthBand` | uniform(1.05, 1.15) per 3-action tick |
| `maxLeadOverPlayer` | 150 |
| `betweenSessionGrowthPercent` | 5-10% after ≥2h away |
| `comebackPercent` | 8-12%, applied the session after the player first beats the rival |
| `updateEveryNActions` | 3 |

**§27 candidate lever: "rival-triggered improve flows"** — the `rival.json`
microcopy table already has an "Improve My Score" button wired to open the
breakdown panel (`rival_improve_clicked` is logged); a stronger version of
this lever would change what that button *does* (e.g. auto-highlight the
single best next placement) rather than just opening the breakdown — that's
a code change, not a config one.

## FTUE pacing (config/ftue.json)

Each step's `fallback.delaySeconds` (currently 10s for most steps, 15-20s for
a couple) controls how long a tester can idle before the fallback hint fires.
If real testers consistently need the hint (i.e. the primary microcopy isn't
landing), shortening these delays gets them unstuck faster; if testers find
the hints intrusive, lengthening them gives more benefit of the doubt.

## What NOT to guess at

Do not change any of these numbers without a specific behavioral signal
(dwell time, drop-off point, survey quote) pointing at *that* number
specifically. Blind tuning with no data is how a working loop gets
accidentally broken — see `docs/realmforge_reset.md` §27's own warning that
the core-loop-redesign path is for when data says the thesis itself is
wrong, not a place to start guessing from.
