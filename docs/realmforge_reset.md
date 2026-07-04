# REALMFORGE RIVALS — MASTER RESET DOCUMENT
**Version:** Reset 1.0 · July 2026
**Replaces as active plan:** GDD v1.0 production phases · Systems Spec Parts 1–2 (both archived as *post-validation* references, not current work)
**One rule governs this document:** nothing gets built that does not prove players voluntarily relocate buildings to raise a number.

---

# 1. Executive Reset Summary

**What is Realmforge Rivals?**
A portrait, one-thumb fantasy realm builder where placement is the skill: put buildings near the right terrain and neighbors to raise a fully transparent Prosperity score higher than a rival realm's.

**What is the current project risk?**
The team has produced two engineering documents (server authority, league service, anti-cheat, live ops, CDN pipelines) for a core loop that has never been played. We are architecting the shell of a live-service game around an unproven center. If adjacency-driven relocation is not fun, every page of that architecture is waste.

**What must be proven first?**
One behavior: a player, unprompted, picks up a building they already placed and moves it to make Prosperity go up. Voluntary relocation is the entire bet. Everything else — leagues, events, monetization, backend — is amplification of that behavior and worthless without it.

**What must be cut immediately?**
All backend, all commerce, all real league infrastructure, events, guilds, biomes, ambient citizens, asset pipelines, admin tools, anti-cheat, push. The prototype is a local, mock-saved, 6×6 greybox with 12 buildings, one scoring module, and a fake rival.

**What gets built next?**
A 7-day greybox prototype: grid, terrain, drag-place, drag-relocate, live adjacency report, transparent score breakdown, fake rival comparison, 10 quests, local save, scoring unit tests. Then a 10-player playtest.

**What is the pass/fail gate?**
≥80% place first building in <30s · ≥70% can say why the score changed · **≥40% voluntarily relocate ≥1 building** · ≥50% engage rival comparison · ≥50% would play again · <20% drop before rival reveal. Miss the relocation gate → redesign the loop. Do not proceed to production systems on a failed gate. No exceptions, including "it almost passed."

---

# 2. Facts, Assumptions, Decisions, Risks

## 2.1 Facts (fixed truths from current direction)

| # | Fact |
|---|---|
| F1 | Fantasy city/world builder; portrait-first; one-thumb; mobile-first |
| F2 | No player character; "movement" = placement, relocation, camera, (later) cosmetic citizens |
| F3 | "Combat" = deterministic realm events; no realtime combat, no sockets, no realtime PvP, ever |
| F4 | Async-only is a design pillar **and** the cost-control strategy |
| F5 | Production economy, score, timers, leagues, inventory, purchases: server-authoritative with idempotency keys and versioned configs |
| F6 | Prototype scoring/save may be fully local mock — production truths do not apply to the prototype |
| F7 | Adjacency report is the most important UI component; it must be one component, one formula source |
| F8 | Scoring must be deterministic and player-transparent; no hidden modifiers |
| F9 | First placement must be understandable in 30 seconds; mastery must scale over months |
| F10 | No pay-to-win; small AI-assisted team; scope discipline outranks ambition |

## 2.2 Assumptions (unvalidated — the prototype exists to test these)

| # | Assumption | Validated by |
|---|---|---|
| A1 | Placing buildings near matching terrain is inherently satisfying | Playtest observation + relocation rate |
| A2 | A visible Prosperity number is motivating on its own | Score-comprehension + retry-click metrics |
| A3 | A fake rival score creates real competitive pressure | Rival engagement metric |
| A4 | A 6×6 grid gives enough placement tension without overwhelm | Confusion taps + first-placement time |
| A5 | 4 resources are enough for a first session to feel like an economy | Quest completion + survey |
| A6 | Synergy/conflict rules are learnable from the adjacency report alone, no text tutorial | % understanding bonus without help |
| A7 | Free FTUE relocation converts into voluntary relocation habit | Voluntary relocation rate post-FTUE |

## 2.3 Decisions (locked — do not relitigate during the sprint)

| # | Decision |
|---|---|
| D1 | Prototype: local mock save, local scoring, local fake rival, console/file analytics |
| D2 | Exactly 12 buildings, 5 terrain types, 4 resources + Gems (named only, unused) |
| D3 | Grid: 6×6; adjacency neighborhood: 8 surrounding tiles; synergy range: distance ≤2 (Chebyshev) |
| D4 | One scoring module feeds preview, detail panel, score breakdown, rival delta, quests — no duplication |
| D5 | Relocation is free during FTUE; costs 10 Gold after FTUE (teaches the future sink without pain) |
| D6 | Prototype is throwaway code (per existing disposal policy); the surviving artifacts are the rule spec, config data, and test suite |
| D7 | Prototype platform: mobile-web (React/TS) for URL-shareable playtests; production engine decision deferred to post-validation |
| D8 | No events, no league service, no backend, no login, no IAP, no ads in prototype |
| D9 | Playtest n=10 minimum, moderated, phones only, portrait only |
| D10 | Kill/continue decided on Day 7 metrics, not on team enthusiasm |

## 2.4 Risks

| # | Risk | Severity | Why it matters | Mitigation |
|---|---|---|---|---|
| R1 | Core loop isn't fun (no voluntary relocation) | Fatal | Whole product thesis fails | This entire reset; gate before any production spend |
| R2 | Score feels opaque despite breakdown UI | High | Kills comprehension gate and mastery promise | One formula, visible math, cause-text microcopy, no % stacking players can't reproduce |
| R3 | UI overload in first 30s | High | First-placement gate fails for UX reasons, not fun reasons | One resource visible at start; one instruction at a time; staged HUD reveal |
| R4 | Building rules too complex to read at a glance | Med | A6 fails; tutorial dependence rises | One-sentence rule per building; max 1 synergy + 1 conflict surfaced per placement |
| R5 | Team rebuilds backend "just a little" during sprint | Med | Burns the 7 days on non-proof work | D1/D8 locked; producer reviews commits daily against the cut list |
| R6 | Fake rival reads as fake → no pressure | Med | A3 fails for presentation reasons | Rival generated relative to player score (see §19); named rival, avatar, delta framing |
| R7 | Web prototype perf misreads as game perf | Low | False negative on "feel" | Greybox art, 60fps budget trivial at 6×6; frame playtest as layout fun, not polish |

---

# 3. What Is Currently On Track

| Area | Why it's genuinely right (operational reason) |
|---|---|
| Async-only pillar | Deletes matchmaking, netcode, realtime infra — the single biggest cost lever for a small team; survives this reset untouched |
| Server-authoritative *production* direction | Correct for soft launch; ledger + idempotency design means the prototype→production migration is a swap, not a rewrite (§22) |
| Deterministic scoring/events | Same math library can run client preview, server truth, and headless tests — this reset exploits it: the scoring module built this week **is** the surviving spec |
| Config-driven content | Prototype building/terrain data ships as JSON from day 1; tuning during playtest week requires zero code changes |
| Adjacency report priority | Already identified as the #1 UI component; this reset makes it the #1 *deliverable* |
| Ethical monetization guardrails | Nothing to build now, but the "no score for sale" rule keeps the prototype honest: the score must be earnable-only or the fun test is contaminated |
| Backend/live-ops discipline docs | Good *post-validation* references; correctly written as phase-gated — the failure was sequencing, not content |

---

# 4. What Is Off Track

| # | Problem | Evidence | Correction |
|---|---|---|---|
| O1 | Architecture before fun | Two engineering specs, zero playable seconds | This reset: nothing but the greybox for 7 days |
| O2 | Future-feature planning depth (guilds, seasons 2–5, subscriptions) | Roadmaps to Season 5 exist; core loop doesn't | Archive roadmaps; revisit only after gate pass |
| O3 | Core placement loop under-specified | No locked building stats, no locked formula, no worked score examples anywhere | §13–§17 lock matrices, formula, and 3 worked layouts |
| O4 | First 5 minutes not concrete | GDD FTUE is beats, not steps with microcopy/analytics/fallbacks | §8–§10 specify every step to the word |
| O5 | Prosperity formula not locked | Score components named, never defined numerically | §16 locks it with unit tests |
| O6 | Events (Goblin Moon cold open) distract from the proof | Cold open tests drama, not the loop; adds enemy sim scope | Cut from prototype; FTUE opens directly on placement (§8) |
| O7 | Monetization/backend sequencing | Commerce, receipts, admin tools scheduled pre-validation | §5 cut table + §22 deferral plan |
| O8 | 30-building content plan before 12 are proven fun | Content scale assumed, not earned | 12 buildings max; content scales only after gate pass |

---

# 5. Immediate Cuts

| Feature/System | Action | Why | Earliest revisit |
|---|---|---|---|
| Real backend (all services) | **Defer** | Proves nothing about fun; §22 contracts prevent rewrite | Post-gate, pre-soft-launch |
| Real login/identity | Defer | Playtest is moderated, local | Soft-launch build |
| Real IAP + receipt validation | Defer | No store in prototype | Soft-launch build |
| Store / offers / Vault / subscriptions | Defer | Contaminates fun test; zero proof value | Soft launch (store), post-launch (sub) |
| Real league settlement / brackets | Defer | Fake rival tests the psychology at 1% of the cost | Vertical slice → soft launch |
| Event calendar, Goblin Moon, Mana Storm, Ancient Wyrm | Defer | Events amplify a loop that must exist first | Vertical slice (1 template max) |
| Guilds (incl. nav flag work) | Defer | Season-4 feature in a week-1 project | Season 4, unchanged |
| Multiple biomes / realm skins | Defer | Greybox by design | Vertical slice (market-appeal test only) |
| Ambient citizen pathing | Defer | Cosmetic; steals sprint days | Vertical slice polish |
| CDN asset bundles | Defer | 12 greybox assets fit in the app | Soft-launch build |
| Advanced anti-cheat (sanity engine, quarantine) | Defer | Local prototype has nothing to steal | Soft-launch build |
| Push notifications / deep links | Defer | No retention system to serve yet | Soft-launch build |
| Admin/CMS tools | Defer | No live game to operate | Soft-launch prep |
| Refined materials (Planks, Blocks, Crystal), Food, Relics | **Cut from MVP** | Violates 4-resource cap; crafting chains banned | Re-evaluate at vertical slice — only if depth metrics demand it |
| Hero/advisor anything | Cut | Already excluded; stays excluded | Season 2+ |
| Landscape/tablet layouts | Cut | Portrait-first rule | Post-launch |

Nothing above is deleted conceptually — Parts 1–2 of the systems spec remain the production reference **if and only if** the gate passes.

---

# 6. Strict MVP Scope (P0–P3)

| Feature | Priority | Build status | Why it matters | Acceptance criteria | Risk if built too early |
|---|---|---|---|---|---|
| 6×6 realm grid + terrain map | P0 | Build now | The board the whole bet plays on | Renders 5 terrain types; tile inspectable by tap | — |
| Drag-place building flow | P0 | Build now | First action of the game | Place in ≤2 gestures; invalid tiles visibly rejected | — |
| Drag-relocate flow | P0 | Build now | The north-star behavior | Any placed building can be picked up and moved; free in FTUE | — |
| Live adjacency report | P0 | Build now | The teaching surface; comprehension gate depends on it | Exact numbers while dragging; same data as detail panel | — |
| Prosperity score + breakdown | P0 | Build now | The number players optimize | Breakdown sums exactly to total; updates <100ms after commit | — |
| 12 buildings (config JSON) | P0 | Build now | Minimum vocabulary for interesting layouts | All stats data-driven; no per-building code | — |
| Fake rival comparison | P0 | Build now | Competitive pressure test | Rival name/score/delta visible after first score reveal | Real league now = weeks of waste |
| Quest checklist (10 quests) | P0 | Build now | Session guidance without tutorial walls | All 10 completable in one session; auto-detect completion | — |
| Local mock save | P0 | Build now | Session persistence for 2nd-session-intent test | Kill app → reopen → identical realm | Real backend = the anti-pattern this reset exists to stop |
| Local analytics logging | P0 | Build now | Gate metrics are unmeasurable without it | Every §23 event fires with timestamp to local file | — |
| Scoring unit tests | P0 | Build now | Determinism + the surviving artifact | §16 worked examples pass as tests; 100% branch coverage on scoring module | — |
| FTUE step flow (§10) | P0 | Build now | First-placement + drop-off gates | All 12 steps instrumented | — |
| Post-FTUE relocation cost (10 Gold) | P1 | After gate pass | Tests sink tolerance | Relocation rate doesn't collapse when cost activates | Adding pre-gate muddies the fun signal |
| Second session content (grid expand to 8×8, +6 buildings) | P1 | After gate pass | D1-return test | Returning players have new decisions | Content before proof |
| Real async rival (snapshot exchange) | P2 | Vertical slice | Bridge to leagues | Two real players compare scores async | — |
| Server-authoritative core (per Spec Parts 1–2) | P2 | Soft-launch build | Production truth F5 | Prototype configs load unchanged; ledger + idempotency live | Building now = the original sin |
| Events (1 template), pass, store, push | P2 | Soft-launch build | Retention/monetization | Per archived GDD | Same |
| Leagues, seasons, biomes, live ops tooling | P3 | Post-soft-launch | Scale | Per archived GDD | Same |
| Guilds, trading, co-op | Cut/park | — | Not on any current critical path | — | — |

---

# 7. Core Fun Spec

**Governing sentence:** *Place buildings near the right terrain and neighbors to raise prosperity higher than rival realms.*

| # | Element | Spec |
|---|---|---|
| 1 | Player promise | "Every placement is a puzzle; every smart move makes my number beat theirs." |
| 2 | First action | Drag the Town Hall from the tray onto the grid (0:10) |
| 3 | First number that changes | Prosperity appears: **0 → 100** on Town Hall commit |
| 4 | First visible improvement | Lumber Camp preview shows **+20% Wood per adjacent Forest** while dragging |
| 5 | First decision | Which of two visible Forest clusters gets the Lumber Camp (2-forest spot vs 1-forest spot) |
| 6 | First "aha" | Dragging the same building across tiles and watching the bonus number change live |
| 7 | First "I can do better" | Tutorial reveals a 3-forest tile just outside where they placed; free relocation offered |
| 8 | First competitive moment | Rival card slides in: "Thornwick's realm: 340. Yours: 306." (~1:50) |
| 9 | First reward | Quest chest: +100 Gold on "Reach 250 Prosperity" |
| 10 | Reason to retry | Rival delta is small and the breakdown shows exactly where points are missing |
| 11 | Reason to return tomorrow | Score persists; rival "improves" between sessions; two quests deliberately left open |
| 12 | Mastery at 30 days (production vision) | Reading a fresh map like a puzzle: chaining Town Hall auras, terrain caps, synergy webs, and conflict spacing to squeeze 30–40% more score from identical buildings than a novice |

---

# 8. First 30 Seconds

Constraints honored: no lore, no account, no store, no event, no pass, one resource visible (none until 0:20 — Prosperity is not a resource), one instruction at a time.

| Time | UI shown | Player action | Microcopy (≤12 words) | Success condition | Fail condition | Analytics event |
|---|---|---|---|---|---|---|
| 0:00–0:05 | Realm grid fades in; everything else hidden; Town Hall ghost attached to a pulsing tray slot | Observe | "Your realm awaits." | Screen visible | — | `ftue_start` |
| 0:05–0:15 | Ghost building follows finger; valid tiles glow softly | Drag Town Hall onto any Clear Land tile | "Place your Town Hall." | Building committed | 10s idle → tile shimmer hint | `first_drag_start`, `town_hall_placed` |
| 0:15–0:20 | Prosperity counter animates in top-center: 0 → **100** | Watch | "Prosperity: 100. Make it grow." | Counter seen (dwell) | — | `prosperity_first_shown` |
| 0:20–0:30 | Tray reveals Lumber Camp; two Forest clusters gently highlighted; adjacency report appears on drag | Begin dragging Lumber Camp | "Wood buildings love Forests." | Drag started by 0:30 | 10s idle → arrow to tray | `second_drag_start` |

**Gate check:** `town_hall_placed` timestamp <30s from `ftue_start` for ≥80% of testers.
**Nothing else on screen:** no resource bar, no quest button, no rival, no settings beyond a mute icon.

---

# 9. First 2 Minutes

| Step | Time | Beat | Player action | System revealed |
|---|---|---|---|---|
| 1 | 0:05 | Town Hall placement | Drag + drop | Placement; Prosperity exists |
| 2 | 0:30 | Lumber Camp placement | Drop beside Forest, guided by live report | Terrain bonus (+20%/Forest); adjacency report |
| 3 | 0:45 | Forest bonus reveal | Read report: "+40% Wood from Forest ×2" | Bonuses are countable and stack |
| 4 | 1:00 | **First relocation** | Tutorial highlights a 3-Forest tile; player moves camp free | Relocation; improvement loop; "+60% beats +40%" |
| 5 | 1:15 | First resource claim | Tap bouncing Wood icon on camp | Collection; Wood counter appears (first resource shown) |
| 6 | 1:25 | Cottage placement | Drag Cottage (costs 30 Wood — affordable from claim) | Costs; Population score category |
| 7 | 1:45 | Prosperity breakdown reveal | Tap the score → breakdown panel | Transparent score: Production + Population lines visible |
| 8 | 1:55 | Rival tease | Rival card slides in | Competition exists (full beat in minute 3) |

---

# 10. First 5 Minutes — Full FTUE Table

Free relocation throughout FTUE (ends after step 12).

| # | Time | UI element | Player action | Microcopy (≤12 words) | System taught | Analytics event | Success condition | Fallback if hesitating | Not shown yet |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0:05 | Grid + ghost Town Hall | Place Town Hall | "Place your Town Hall." | Placement | `town_hall_placed` | Commit <30s | Tile shimmer at 10s | Resources, quests, rival, score |
| 2 | 0:30 | Tray + adjacency report | Place Lumber Camp near Forest | "Wood buildings love Forests." | Terrain bonus | `lumber_camp_placed` (+adjacency payload) | Placed touching ≥1 Forest | Forest tiles pulse at 10s | Stone/Mana, synergies |
| 3 | 0:45 | Adjacency report callout | Read bonus | "+20% for every Forest beside it." | Bonus stacking | `bonus_viewed` | Dwell ≥1.5s on report | Report enlarges once | Conflicts |
| 4 | 1:00 | Better-spot highlight | Relocate Lumber Camp (free) | "Moving is free. Find a better spot." | Relocation | `ftue_relocation_done` | Camp moved to ≥ same bonus | Ghost arrow to 3-Forest tile | Relocation cost |
| 5 | 1:15 | Bouncing resource icon | Claim Wood | "Collect your Wood." | Collection | `first_claim` | Wood ≥30 | Icon bounce amplifies | Gold/Stone/Mana counters |
| 6 | 1:25 | Tray: Cottage (30 Wood) | Place Cottage | "Cottages grow your population." | Cost + Population score | `cottage_placed` | Committed | Cost tooltip | Happiness math detail |
| 7 | 1:45 | Score breakdown panel | Tap Prosperity | "Tap your score anytime. No secrets." | Transparency | `breakdown_opened` | Panel opened | Score pulses at 15s | Imbalance line (zero-state hidden) |
| 8 | 2:10 | Tray: Shrine | Place Shrine near Cottage | "Shrines make nearby cottages happy." | Radius aura (range 2) | `shrine_placed` | Cottage in range | Range circle preview auto-shows | Mana score |
| 9 | 2:40 | Tray: Sawmill | Place Sawmill near Lumber Camp | "Sawmills boost nearby Lumber Camps." | Building synergy | `sawmill_placed` | Camp within range 2 | Synergy line draws camp↔mill | Conflicts |
| 10 | 3:10 | Score ticks up live | Watch Prosperity rise past 250 | "Prosperity 250 reached!" | Score = sum of choices | `prosperity_250` | Score ≥250 | Quest hint to claim | — |
| 11 | 3:30 | Rival card slides in | View rival comparison | "Rival realm Thornwick: 340. Beat them." | Competition | `rival_viewed` | Card opened or dwell ≥2s | Card re-peeks at 20s | League/brackets language |
| 12 | 4:00–5:00 | Quest chest + open tray | Claim reward; free build | "Claim your reward. Your realm, your rules." | Reward loop; autonomy | `reward_claimed`, `freeplay_start` | Chest claimed; ≥1 unprompted action | Chest glow | Everything else stays hidden |

**FTUE exit state:** 5 buildings placed, 1 relocation done, score 306, rival at 340, 3 quests open, full tray (12 buildings) unlocked, relocation now costs 10 Gold (announced gently: "Moving now costs 10 Gold.").

---

# 11. Resource Matrix

Prototype resources: **Gold, Wood, Stone, Mana** + **Gems (named only — appears as a locked counter, never used, never purchasable in prototype).** No Food. No Relics. No refined materials. No crafting chains.

| Resource | Role | Source | Sink | First-session use | Why it exists | What NOT to do with it |
|---|---|---|---|---|---|---|
| Gold | Universal build/upgrade currency | Fishing Dock, Market, Sawmill, Forge, quest rewards | Building costs, post-FTUE relocation (10) | Buy Lumber Camp; feel the relocation cost rule | One currency everything touches → economy legible in session 1 | Don't gate FTUE on it; don't let it buy score directly |
| Wood | Early construction | Lumber Camp | Cottage, Shrine, Sawmill, Fishing Dock costs | First claim (step 5) funds first Cottage | Ties the first production building to the first purchase — closes the loop in 90s | No Wood→Planks refinement; no decay |
| Stone | Mid-session construction | Quarry | Mage Tower, Watchtower, Forge costs | Unlocks the mountain-side decisions | Second production vertical → second terrain lesson | No Stone→Blocks; don't require Stone before minute 3 |
| Mana | Magic-vertical currency + score category | Mage Tower | Garden cost, (future: magic upgrades) | Optional in session 1; visible as a score line | Reserves the fantasy vertical without complexity | No mana regen timers, no spell system, no event costs |
| Gems | Premium placeholder | None in prototype | None in prototype | Seen, never touched | Reserves UI slot + tests that its presence doesn't confuse | Absolutely no purchasable effect of any kind |

---

# 12. Terrain Matrix

| Terrain | Visual fantasy read | Gameplay effect | Buildings it supports | Teaching purpose | Risk |
|---|---|---|---|---|---|
| Forest | Cluster of stylized trees | +20%/adjacent Forest to wood buildings | Lumber Camp | The very first placement lesson | Over-clustering makes choice trivial — map uses 2 clusters of different sizes |
| Mountain | Grey peaks on tile | +20%/adjacent Mountain to stone/forge buildings | Quarry, Forge | Same rule, new vertical → confirms the pattern | Mountains at map edge only → edge placement must still allow range-2 synergies |
| River | Blue ribbon crossing the map | Fishing Dock **requires** river adjacency; +15%/adjacent River; Garden +10 Beauty adjacent | Fishing Dock, Garden | Teaches hard placement *requirements* vs. soft bonuses | Requirement must fail loudly and kindly in preview ("Needs a River tile beside it") |
| Mana Spring | Glowing blue-white pool | +25%/adjacent Spring to magic buildings (cap 2); Shrine adjacent: +10 Mana score | Mage Tower, Shrine | High-value scarce tile → creates the map's premium real estate | Only 2 springs on map — contention is the point; don't add more |
| Clear Land | Plain grass | Neutral; everything placeable | All | The "safe but suboptimal" default — makes bonuses feel earned | If Clear Land is *too* fine, nobody relocates; producer watches this in playtest |

Map layout rule: the 6×6 map is hand-authored once — 7 Forest (clusters of 4 and 3), 5 Mountain (one ridge), 5 River (one bend), 2 Mana Springs, 17 Clear Land. Authored so that no single tile is optimal for two different buildings — forced tradeoffs are the fun.

---

# 13. Building Matrix (exactly 12)

Player starts with 100 Gold. Output rates are per minute (prototype uses fast timers; tuning lives in config).

| ID | Name | Category | Cost | Base output | Prosperity base | Terrain bonus | Neighbor bonus | Neighbor conflict | Unlock | Teaching purpose | One-sentence explanation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B01 | Town Hall | Core | Free (first build, max 1) | — | 100 Production flat; +20 Pop | — | Grants +10% output to buildings within 2 | — | FTUE 1 | Anchors the realm; centrality matters | Your realm's heart — buildings near it work harder. |
| B02 | Lumber Camp | Production | 50 Gold | 10 Wood | 40 Production | +20%/adj Forest (cap 3) | +15% if Sawmill within 2 | — | FTUE 2 | Terrain bonus | Cuts wood — loves standing beside Forests. |
| B03 | Cottage | Housing | 30 Wood | — | +10 Pop | — | Benefits from Shrine/Watchtower/Garden auras | Unhappy near Forge/Quarry | FTUE 6 | Population + being aura *receiver* | Homes for citizens — keep them happy and away from smoke. |
| B04 | Shrine | Magic | 40 Wood + 20 Gold | — | +10 Happiness, +5/Cottage within 2 (cap 3) | Adj Mana Spring: +10 Mana score | (its aura is the bonus) | — | FTUE 8 | Radius auras | Blesses nearby cottages with happiness. |
| B05 | Sawmill | Refinement | 60 Wood + 30 Gold | 5 Gold | 30 Production | — | +10%/Lumber Camp within 2 (cap 3); boosts those camps +15% | — | FTUE 9 | Two-way synergy | Pairs with Lumber Camps — both work better together. |
| B06 | Quarry | Production | 60 Gold | 8 Stone | 40 Production | +20%/adj Mountain (cap 3) | — | −5 Happiness per adjacent Cottage | Post-FTUE | Pattern confirmation + first gentle conflict | Digs stone from mountains — dusty for next-door cottages. |
| B07 | Fishing Dock | Production | 40 Wood | 6 Gold | 40 Production | **Requires** adj River; +15%/adj River (cap 3) | — | — | Post-FTUE | Hard placement requirements | Fishes the river — must touch one. |
| B08 | Mage Tower | Magic | 50 Stone + 30 Gold | 6 Mana | 50 Mana | +25%/adj Mana Spring (cap 2) | — | — | Post-FTUE | Scarce-tile contention | Draws power from Mana Springs. |
| B09 | Market | Trade | 80 Gold | 8 Gold | 35 Production | — | +10% per **unique** building type within 2 (cap 5) | — | Post-FTUE | Rewards variety, not stacking | Thrives surrounded by different neighbors. |
| B10 | Watchtower | Defense | 40 Stone | — | +5 Happiness/Cottage within 2 (cap 4) | — | (its aura is the bonus) | — | Post-FTUE | Second aura source; housing-district planning | Citizens sleep better near a watchtower. |
| B11 | Garden | Beauty | 30 Gold + 10 Mana | — | 30 Beauty; +5 Happiness/adj Cottage (cap 2) | Adj River: +10 Beauty | — | −10 Beauty if Forge within 2 | Post-FTUE | Beauty category; conflict *victim* | A lovely garden — prettier by the river, ruined by forge smoke. |
| B12 | Forge | Refinement | 50 Stone + 50 Gold | 12 Gold | 50 Production | +20%/adj Mountain (cap 2) | +20% if Quarry within 2 | −10 Happiness per Cottage within 2; spoils Gardens within 2 | Post-FTUE | The tradeoff engine: best producer, worst neighbor | The strongest earner — keep it away from homes and gardens. |

Design checks passed: every building has one obvious placement rule; no building needs more than one sentence; exactly zero conversion chains (Wood/Stone are build costs, not craft inputs); all numbers are round and config-tunable.

---

# 14. Building Synergy Table

Range = Chebyshev distance (a 5×5 box for range 2; the 8 surrounding tiles for range 1/"adjacent").

| Source building | Nearby building | Range | Bonus | Player-facing explanation | Why it teaches mastery |
|---|---|---|---|---|---|
| Town Hall | Any producer | 2 | +10% output | "+10% from Town Hall" | Centrality: the map has one free aura — build around it or deliberately leave it |
| Sawmill | Lumber Camp | 2 | Camp gets +15% | "+15% from nearby Sawmill" | First building *pair*; introduces web-building |
| Lumber Camp | Sawmill | 2 | Sawmill gets +10% per camp (cap 3) | "+10% per Lumber Camp nearby" | Reverse direction: hubs want multiple spokes |
| Quarry | Forge | 2 | Forge gets +20% | "+20% from nearby Quarry" | Confirms the pair pattern in the stone vertical |
| Shrine | Cottage | 2 | +5 Happiness per Cottage (cap 3) | "+5 Happiness per nearby Cottage" | Auras reward *district* thinking, not single placements |
| Watchtower | Cottage | 2 | +5 Happiness per Cottage (cap 4) | "+5 Happiness per nearby Cottage" | Stacking aura sources over the same district |
| Garden | Cottage | 1 | +5 Happiness per adjacent Cottage (cap 2) | "+5 Happiness per Cottage beside it" | Tighter range than Shrine → range reading matters |
| Market | Any unique type | 2 | +10% per unique type (cap 5) | "+10% per different neighbor" | Anti-stacking lesson: variety is a strategy of its own |

---

# 15. Building Conflict Table

| Building | Conflicting neighbor | Range | Penalty | Player-facing explanation | Why it matters |
|---|---|---|---|---|---|
| Forge | Cottage | 2 | −10 Happiness per Cottage in range | "−10 Happiness: cottages hate forge smoke" | The core tradeoff: the best producer poisons housing districts — zoning is born |
| Forge | Garden | 2 | Garden loses 10 Beauty | "−10 Beauty: smoke spoils the garden" | Conflicts hit more than one score category → layout is multi-objective |
| Quarry | Cottage | 1 (adjacent) | −5 Happiness per adjacent Cottage | "−5 Happiness: quarry dust" | A *gentle* early conflict so the first mistake stings, not wounds |

Rules honored: conflicts teach tradeoffs; early conflicts are mild (−5 before −10 is reachable); every conflict appears in the adjacency report **during preview, before commit** — the player is warned, never ambushed.

---

# 16. Prosperity Score Formula

## 16.1 Player-facing formula (shown verbatim in the breakdown panel)

> **Prosperity = Production + Population + Happiness + Mana + Beauty − Imbalance**
> Every point is listed below. Nothing is hidden.

Defense category: **cut from MVP** — no events exist to defend against; Watchtower contributes through Happiness instead. Category returns with events (P2).

## 16.2 Internal formula

```
For each building b:
  M(b) = TerrainMult(b) × SynergyMult(b)            // see §17
  TerrainMult = 1 + terrain_rate × min(matching_adj_tiles, terrain_cap)
  SynergyMult = 1 + min(Σ synergy_bonuses, 0.50)     // synergies SUM, capped +50%

Production = Σ producers: prosperity_base(b) × M(b)   // Town Hall contributes flat 100
Population = 2 × Σ pop(b)                             // TH 20, Cottage 10
HappyPts   = max(0, Σ aura_happiness − Σ conflict_happiness)
Happiness  = 2 × HappyPts
Mana       = Σ magic buildings: mana_base(b) × M(b) + shrine_spring_bonus
Beauty     = Σ max(0, beauty_base(b) + river_bonus(b) − forge_penalty(b))
Imbalance  = max(0, TotalPop − 2 × HappyPts)          // "Happiness ≥ half Population"

Prosperity = round(Production + Population + Happiness + Mana + Beauty − Imbalance)
```

No randomness anywhere. One module (`scoring/`) computes all of this; UI reads its output.

## 16.3 Example breakdown (FTUE end state)

```
Prosperity: 306
+216 Production   (Town Hall 100 · Lumber Camp 80 · Sawmill 36)
 +60 Population   (30 citizens × 2)
 +30 Happiness    (15 points × 2)
  +0 Mana
  +0 Beauty
  −0 Imbalance
```

## 16.4 Three worked layouts

**Layout A — FTUE end (5 buildings, taught placement).** Lumber Camp on 3 Forest, Sawmill + Town Hall both within range 2 of it; Shrine covering the Cottage.
LC: 40 × 1.6 × 1.25 = **80** · Sawmill: 30 × 1.0 × 1.20 (1 camp +10%, TH +10%) = **36** · TH flat **100** → Production 216. Pop 30 → 60. HappyPts = 10 + 5 = 15 → 30. Imbalance = max(0, 30 − 30) = 0. **Total 306.**

**Layout B — same 5 buildings, careless sprawl.** LC on 1 Forest, outside every aura; Sawmill isolated; Shrine out of Cottage range.
LC: 40 × 1.2 = **48** · Sawmill: 30 × 1.0 = **30** · TH **100** → Production 178. Pop 30 → 60. HappyPts = 10 → 20. Imbalance = max(0, 30 − 20) = **10**. **Total 248.**
→ *Identical buildings; placement alone is worth +58 points (+23%). This delta is the product.*

**Layout C — 10-building mid-game with one zoning mistake.** TH; LC1 (3 Forest, mill+TH in range): 40×1.6×1.25 = **80**; LC2 (2 Forest, mill+TH): 40×1.4×1.25 = **70**; Sawmill (2 camps + TH = +30%): 30×1.3 = **39**; Quarry (2 Mountain): 40×1.4 = **56**; Forge (2 Mountain, Quarry in range): 50×1.4×1.2 = **84** → Production 429. Cottage×2 + TH: Pop 40 → **80**. Happiness: Shrine 10+10, Garden +5, **Forge −10 (one Cottage in its range — the mistake)** → 15 pts → **30**. Beauty: Garden **30**. Imbalance: max(0, 40−30) = **10**. **Total 559.**
→ Relocate that one Cottage out of Forge range: HappyPts 25 → Happiness 50, Imbalance 0. **New total 589 (+30 from one move).** This is the exact "aha" the rival prompt should provoke.

## 16.5 Edge cases

| Case | Rule |
|---|---|
| Empty realm | Prosperity = 0; breakdown shows all-zero lines |
| Building on grid edge | Fewer neighbors is just fewer bonuses — no penalty, no special case |
| Overlapping auras (Shrine + Watchtower on same Cottage) | Happiness contributions sum; per-source caps apply independently |
| Synergy sum exceeds +50% | Clamped at +50%; report shows "MAX" tag on the synergy line |
| Happiness driven below 0 by Forges | HappyPts floors at 0; Imbalance then bites — double punishment is intended and visible |
| Garden Beauty below 0 | Floors at 0 per building |
| Two buildings claim the same tile | Impossible — placement validator rejects before scoring is called |
| Town Hall relocated | Allowed (free in FTUE, 10 Gold after); all auras recompute — legitimate advanced strategy |

## 16.6 Scoring unit tests (must pass before Day 4 ends)

| # | Test |
|---|---|
| T1 | Empty grid scores 0 with all-zero breakdown |
| T2 | Lone Town Hall scores exactly 140 (100 Production + 40 Population) |
| T3 | Layout A computes 306; Layout B computes 248; Layout C computes 559 (golden tests) |
| T4 | Layout C with Cottage moved computes 589 |
| T5 | Terrain cap: LC with 4 adjacent Forest scores same as with 3 |
| T6 | Synergy clamp: constructed +60% case scores as +50% |
| T7 | Happiness floor: 3 Forges vs 1 Cottage → HappyPts 0, never negative |
| T8 | Imbalance: Pop 40 / HappyPts 10 → penalty exactly 20 |
| T9 | Determinism: same layout scored 1,000× yields identical result; iteration order shuffled |
| T10 | Breakdown lines always sum exactly to total (property test over 500 random layouts) |
| T11 | Preview score for a hovered placement equals committed score after placement (same module, same result) |
| T12 | Relocation: score after move equals score of fresh layout at new position (no state leakage) |

---

# 17. Adjacency Scoring Rules

| # | Rule | Definition |
|---|---|---|
| 1 | Terrain bonus | `1 + rate × min(count_matching_adjacent_terrain, cap)` — adjacent = 8 surrounding tiles; rate/cap per building (§13) |
| 2 | Neighbor synergy | Flat percentages that **sum**, then apply as one multiplier: `1 + min(Σ, 0.50)`; per-source stacking caps from §14 apply before the sum |
| 3 | Neighbor conflict | MVP conflicts subtract flat points from Happiness/Beauty lines (§15) — they do not touch output multipliers. (Output-conflict multiplier `1 − Σ, floor 0.5` is reserved in the module, unused in MVP.) |
| 4 | Range | Chebyshev distance. Range 1 = 8 surrounding tiles. Range 2 = 5×5 box minus self. Shown as a highlighted box during placement, never described in text |
| 5 | Stacking | Terrain: counts tiles up to cap. Synergy: each source contributes once per instance up to its own cap, then global +50% clamp. Auras from different source types always stack |
| 6 | Caps | Every cap is in config, shown in the report when hit ("MAX"), and covered by a unit test |
| 7 | Preview | While dragging: report shows the exact post-commit numbers for the hovered tile — computed by the real scoring module against a hypothetical board, not an estimate |
| 8 | Errors | Scoring module never throws on any valid board; invalid boards are unrepresentable (validator gate) |
| 9 | Invalid placement | Occupied tile, missing requirement (Dock without River), unaffordable cost → tile tints red, report shows one reason line ("Needs a River beside it"), drop returns building to tray. Never a modal |
| 10 | UI breakdown | Every displayed number is a field from the scoring module's `ScoreReport` object. UI performs **zero arithmetic**. Lint rule enforces no `*`/`+` on score values in UI code |

---

# 18. Adjacency Report UI (the #1 component)

**One component, four contexts:** live placement preview (docked above thumb) · building detail panel (tap placed building) · upgrade/inspection panel (same panel, prototype has no upgrades) · rival comparison "why" drill-in (P1).

## 18.1 Layout (portrait, above-thumb dock)

```
┌──────────────────────────────┐
│ Lumber Camp        Wood/min  │
│ 10  →  20   (+100%)          │   ← current → after, delta badge
│ ▸ +60% Wood from Forest ×3   │   ← cause lines, max 4 visible
│ ▸ +15% from nearby Sawmill   │
│ ▸ +10% from Town Hall        │
│ Prosperity  +80  (306 → 386) │   ← score consequence, always last
└──────────────────────────────┘
```

## 18.2 Content rules

| Rule | Spec |
|---|---|
| Always show | Current output → output-after, each bonus/penalty as its own line with number + cause, net Prosperity change |
| Cause text format | `+20% Wood from Forest ×2` · `+10% from nearby Sawmill` · `−10 Happiness near Forge` — number first, source named, ≤6 words after the number |
| Conflicts | Red lines, always visible **during preview** before commit; never discovered after placement |
| Cap state | `+60% from Forest ×3 (MAX)` |
| No vague feedback | "Good spot!", stars, and color-only grades are banned; numbers or nothing |
| Live update | Recomputes per tile entered while dragging; <16ms budget (trivial at 6×6) |
| Empty state | On Clear Land with no neighbors: "No bonuses here. Try near a Forest." — the only advice-flavored line permitted, and it names a concrete target |
| Data source | Reads `ScoreReport` from the scoring module — the same object the breakdown panel and rival delta read (D4) |

---

# 19. Fake Rival Comparison

**Goal:** competitive pressure with zero backend. The rival is a local illusion engineered to be *just beatable*.

## 19.1 Rival generation rules

| Rule | Spec |
|---|---|
| Identity | One named rival per save: name drawn from a 12-name list ("Thornwick", "Maplecrown", "Emberfall"…), fixed greybox banner avatar. Named + faced = pressure; anonymous = ignored |
| First score | `rival = player_score_at_first_reveal + 34` (fixed offset at FTUE; feels close, is close) |
| Ongoing score | Recomputed at session start and every 3 player actions: `rival = max(rival, player × U)` where U ~ uniform(1.05, 1.15), capped at player + 150. Rival never *drops* below its last value (rivals don't get worse) |
| Overtake behavior | When player passes rival: celebration beat, "Realm Bested!" banner + quest Q9 completes; rival "responds" next session (+8–12%) — the comeback creates session 2 pull |
| Between sessions | On app open after ≥2h: rival gains 5–10% ("Thornwick grew while you were away") — honest microcopy, it's a rival, not a friend |
| Determinism | Seeded from save ID → same rival behavior on replay of the same save; analytics comparable across testers |

## 19.2 UI layout

Compact card, top-right under the score (collapsed: name + delta chip "−34"). Tap → full card: rival banner · rival score · player score · delta bar · one line: *"Rivals compare Prosperity weekly."* · button: **"Improve My Score"** → closes card and pulses the score breakdown open (routing the motivation straight into the transparent math).

## 19.3 Microcopy

| Moment | Copy (≤12 words) |
|---|---|
| Reveal | "Rival realm Thornwick: 340. You: 306." |
| Behind | "You trail Thornwick by 34." |
| Close | "Almost there — 12 points behind." |
| Ahead | "Realm Bested! You lead by 22." |
| Return session | "Thornwick grew while you were away." |

## 19.4 Success / failure / analytics

- **Success case:** ≥50% of testers open the card or dwell ≥2s, AND rival mention appears unprompted in think-aloud ("okay how do I beat him").
- **Failure case:** card dismissed instantly and never reopened; no rival references in playtest audio → competitive pressure assumption (A3) fails → iterate presentation once (bigger reveal beat, closer delta) before concluding the *mechanic* fails.
- **Events:** `rival_revealed`, `rival_card_opened`, `rival_improve_clicked`, `rival_beaten`, `rival_comeback_shown` — all with player/rival scores in payload.

## 19.5 Evolution path (design now, build later)

Fake rival (P0, local) → snapshot rival: real player realm snapshots exchanged async, still no live service (P2 vertical slice) → bracket of 50 with weekly settlement per archived League Service design (soft launch). The UI card built this week is the same card all three stages use — only the data source changes. **Do not build brackets, settlement, or reward servers now.**

---

# 20. Quest Checklist (10 prototype quests)

No daily system, no pass XP, no chains beyond simple ordering. Quests are the FTUE's spine and the analytics' milestones.

| ID | Objective | Reward | System taught | Trigger | Completion event | Why it exists |
|---|---|---|---|---|---|---|
| Q1 | Place your Town Hall | 50 Gold | Placement | FTUE start | `q1_done` | First action; funds Lumber Camp |
| Q2 | Place a Lumber Camp beside a Forest | 20 Gold | Terrain bonus | Q1 done | `q2_done` | Forces the terrain lesson |
| Q3 | Earn a +40% Forest bonus | 30 Gold | Bonus stacking | Q2 done | `q3_done` | Rewards *reading the report*, not just placing |
| Q4 | Move a building | 20 Gold | Relocation | Q3 done | `q4_done` | Rehearses the north-star behavior |
| Q5 | Collect 30 Wood | — (the wood is the reward) | Collection | Q4 done | `q5_done` | Funds the Cottage |
| Q6 | Place a Cottage and a Shrine | 30 Gold | Population, auras | Q5 done | `q6_done` | Builds the happiness district |
| Q7 | Reach 250 Prosperity | 100 Gold chest | Score as goal | Q6 done | `q7_done` | The FTUE reward beat (step 12) |
| Q8 | Place a Sawmill near a Lumber Camp | 30 Gold | Synergy | Q7 done | `q8_done` | Building pairs |
| Q9 | Beat your rival's score | 150 Gold chest | Competition | Rival revealed | `q9_done` | The session goal; deliberately left open at FTUE end |
| Q10 | Reach 500 Prosperity | 200 Gold chest | Long-loop pull | Q9 done | `q10_done` | Requires post-FTUE buildings + good layout; the "come back tomorrow" quest |

---

# 21. Claude Code Implementation Plan

**Platform (D7):** React + TypeScript + Vite mobile-web greybox, touch-first, URL-shareable for playtests. Throwaway by contract; the surviving artifacts are `config/`, `scoring/`, and `tests/`. No engine debate this week.

## 21.1 Repo structure

```
realmforge-proto/
  config/
    buildings.json      # all §13 stats — no building logic in code
    terrain.json        # §12 rates/caps + the authored 6x6 map
    synergies.json      # §14 rules
    conflicts.json      # §15 rules
    quests.json         # §20
    rival.json          # §19 tuning (offsets, growth bands)
    ftue.json           # §10 step definitions
  src/
    scoring/            # THE module: pure functions, zero imports from ui/
      score.ts          # computeScore(board) -> ScoreReport
      adjacency.ts      # terrain/synergy/conflict resolution
      types.ts
    board/
      grid.ts           # tile model, occupancy
      validator.ts      # placement legality (never scores)
    game/
      economy.ts        # resources, costs, collection
      quests.ts
      rival.ts
      save.ts           # localStorage mock save
      analytics.ts      # event log -> console + downloadable file
    ui/
      RealmGrid.tsx
      BuildingTray.tsx
      AdjacencyReport.tsx   # the #1 component
      ScoreBreakdown.tsx
      RivalCard.tsx
      QuestPanel.tsx
      FtueDirector.tsx
  tests/
    scoring.test.ts     # §16.6 T1–T12
    validator.test.ts
    rival.test.ts
```

## 21.2 Build sequence — tasks, acceptance criteria, Claude Code prompts

| # | Task | Acceptance criteria | Tests | Claude Code prompt (verbatim) |
|---|---|---|---|---|
| 1 | Config schemas + data files | All §12–§15, §20 data present; schema-validated on load; zero magic numbers in src/ | Schema validation test | "Create JSON schemas and data files for buildings, terrain, synergies, conflicts, and quests exactly per sections 12–15 and 20 of the reset doc. Validate on load, fail loudly on schema errors." |
| 2 | Board + placement validator | Occupancy, terrain requirements (Dock/River), cost checks; returns typed rejection reasons | validator.test.ts covers every rejection reason | "Implement a 6x6 board model and a pure placement validator returning {valid} or {reason} — reasons: occupied, needs_river, cannot_afford, out_of_bounds. No scoring logic here." |
| 3 | **Scoring module** | Pure, deterministic, config-driven; implements §16.2 + §17 exactly; exports ScoreReport with per-line breakdown | **T1–T12 all green — task is not done until golden tests 306/248/559/589 pass** | "Implement computeScore(board): ScoreReport per §16.2 and §17. Pure functions only. Write tests T1–T12 from §16.6 first, then make them pass. Golden values: 306, 248, 559, 589." |
| 4 | Grid + tray UI, drag-place, drag-relocate | Touch drag from tray and from placed buildings; invalid tiles tint red with reason; commit/cancel | Manual + validator integration test | "Build RealmGrid and BuildingTray with touch drag-place and drag-relocate. Use validator for legality and tint. Portrait 390px-wide layout, one-thumb reachable tray." |
| 5 | AdjacencyReport component | Renders ScoreReport fields per §18; used in preview AND detail panel from the same component; zero arithmetic in UI (lint rule) | Snapshot tests for §18.1 example states | "Build AdjacencyReport per §18: current→after output, cause lines with numbers, red conflict lines, MAX tags, prosperity delta. Add an ESLint rule forbidding arithmetic on score fields in ui/." |
| 6 | Score breakdown panel + HUD | Tap score → §16.3 format; lines sum to total (read from module) | Property test reuse (T10) | "Build ScoreBreakdown panel matching §16.3 exactly, reading ScoreReport only." |
| 7 | Economy + collection | Costs deducted, claims accrue per-minute rates, counters reveal per FTUE staging | economy unit tests | "Implement resource accrual, claim taps, cost deduction, and staged counter reveal per §10 'not shown yet' column." |
| 8 | Quests | quests.json driven; auto-detection from analytics events; chest claim flow | quest trigger tests | "Implement the 10 quests from §20, completion auto-detected from the analytics event stream, rewards granted on claim." |
| 9 | Fake rival | §19 generation rules, seeded; card UI + microcopy table | rival.test.ts: determinism, growth bands, cap | "Implement the fake rival per §19: seeded offsets, growth bands, never-decreases rule, comeback logic, card UI with the §19.3 microcopy." |
| 10 | FTUE director | ftue.json step machine: highlights, microcopy, fallbacks, gating per §10; skippable via debug flag | Step-sequence integration test | "Implement FtueDirector executing the 12 steps in ftue.json: staged UI reveal, hint fallbacks on 10s idle, free relocation flag, exact microcopy." |
| 11 | Mock save + analytics | localStorage save/load byte-identical realm; every §23 event logged with t+ms; one-tap export | save round-trip test | "Implement localStorage save/load and an analytics logger writing every event from §23.1 with timestamps, with a debug button exporting the log as JSON." |
| 12 | QA + device pass | §24 checklist executed on 2 low-end phones; 60fps during drag | — | "Run the §24 checklist; profile drag interactions on a throttled mobile profile; fix anything below 60fps." |

## 21.3 Definition of done (prototype)

☐ All 12 tasks' acceptance criteria met ☐ T1–T12 green ☐ §24 checklist passed ☐ FTUE completable start-to-reward in <5 min by a cold tester ☐ Analytics export produces every §23 metric ☐ Playable via URL on a phone in portrait ☐ No backend, login, IAP, ads, or league code anywhere in the repo (producer grep-audit).

---

# 22. Backend Deferral Plan

| Layer | Now (prototype) | Design-only now | Production-grade before soft launch | Post-soft-launch |
|---|---|---|---|---|
| Save/state | localStorage mock | Realm-state document shape (already spec'd, Part 1 §6.1) | Server-authoritative save, optimistic sync | Schema migrations, feature-flagged additions |
| Scoring | Local module — **this is the real one** | — | Same module, run server-side as authority (portable-core plan, Part 2 §10.2) | Config-versioned formula changes |
| Economy | Fake local values | Ledger interface (append-only) | Ledger + idempotency keys | Sanity bounds, telemetry |
| Rival/league | Fake rival (§19) | Bracket/settlement design (archived, done) | Snapshot rival → league service | Timezone-bucket settlement, banded scoring |
| Identity | None | Guest→bind flow (archived) | Platform sign-in + guest bind | — |
| Commerce | Gems counter, inert | Entitlement grant model (archived) | Receipt validation, store | Offers, pass |
| Configs | Local JSON — **same files migrate** | Config-service versioning (archived) | Versioned server configs | A/B, rollout ramps |
| Analytics | Console/file log — **same event names migrate** | Warehouse schema | Real ingest before soft launch (non-negotiable) | Dashboards, alerting |

**Interface contracts that prevent rewrite (write these this week, they're ~5 TypeScript files):**
`ScoreEngine.computeScore(board, config) → ScoreReport` · `SaveStore.load()/save(state)` · `RivalSource.getRival(playerScore) → RivalState` · `Analytics.track(event, payload)` · `EconomyLedger.apply(mutation, idempotencyKey)`.
The prototype implements each with a local class; soft launch swaps implementations behind identical signatures. The idempotency key parameter exists **now**, unused — so no call site changes at migration.

**Risks of overbuilding:** the last three weeks. **Risks of underbuilding:** shipping soft launch on localStorage (impossible — the P2 gate in §6 blocks it) or letting the scoring module grow UI imports (lint rule blocks it).
**Migration path:** gate pass → stand up managed BaaS (identity/social/receipts per Part 2 §10.2) → port `scoring/` + `config/` unchanged to the server runtime → swap the 5 interfaces → soft-launch build. Estimated 4–6 weeks, already designed, zero new design decisions required.

---

# 23. Analytics and Playtest Plan

**North star: voluntary relocation rate** — % of testers who relocate ≥1 building *after* FTUE step 4, without any prompt, hint, or quest requiring it (Q4 completions don't count; post-FTUE moves do).

## 23.1 Event schema

| Event | Payload |
|---|---|
| `ftue_start` / `ftue_step_done` | step_id, t_ms |
| `building_placed` | building_id, tile, adjacency_summary, score_before/after |
| `building_relocated` | building_id, from, to, score_before/after, **prompted:bool**, ftue:bool |
| `report_viewed` | context (preview/detail), dwell_ms |
| `breakdown_opened` | score, dwell_ms |
| `rival_revealed/_card_opened/_improve_clicked/_beaten` | player_score, rival_score |
| `quest_completed` / `reward_claimed` | quest_id, t_ms |
| `claim` | resource, amount |
| `confusion_tap` | Any tap on non-interactive UI; ≥3 in 10s flags a confusion cluster with screen context |
| `session_end` | duration_ms, buildings, relocations, final_score |

## 23.2 Metrics, thresholds, and responses

| Metric | Definition | Pass | Fail | If it fails, change |
|---|---|---|---|---|
| Time to first placement | `ftue_start`→`town_hall_placed` | ≥80% <30s | <60% | Cut §8 further: remove the 0:00 beat, ghost pre-attached to finger |
| Score comprehension | Post-test: "Why did your score change?" answered with a cause (terrain/neighbor) | ≥70% | <50% | Adjacency report: fewer simultaneous lines, bigger delta typography; add one-time "what changed" toast |
| **Voluntary relocation** | §23 north-star definition | **≥40%** | <25% | **Core loop redesign** (see §27) — not UI polish. Candidate levers: bigger terrain deltas, scarcer good tiles, rival-triggered "improve" flows |
| Rival engagement | `rival_card_opened` OR dwell ≥2s | ≥50% | <30% | §19.4 presentation iteration once; if still failing, A3 is false → competition reframe needed before leagues exist |
| Improve-score clicks | `rival_improve_clicked` / testers | ≥30% | — | Diagnostic only |
| Session length | `session_end.duration` | Median ≥6 min | <4 min | Content depth issue → check quest funnel first |
| Quest completion | Q1–Q8 completion rate | ≥80% | <60% | Find the drop quest in funnel; fix that step's fallback |
| Confusion taps | Clusters per tester | ≤2 median | ≥5 | Fix the flagged screens; usually the tray or the report |
| Tutorial drop-off | Quit before `rival_revealed` | <20% | ≥30% | FTUE length cut; steps 8–9 are the merge candidates |
| Second-session intent | Survey: "Would you play another session tomorrow?" | ≥50% yes | <35% | If loop metrics passed but this fails → missing pull; strengthen Q10 + rival comeback |

## 23.3 Playtest protocol (Day 7, n=10)

- **Recruits:** 10 mobile gamers, mixed: 4 casual-builder players, 3 puzzle players, 3 midcore strategy. No friends/family of the team. Phones only.
- **Script:** zero explanation beyond "play this for 15 minutes, think aloud." Moderator silent except scripted probes at 8 min ("what does the score mean?") and 15 min (survey).
- **Observer checklist per tester:** first-placement stopwatch ☐ report actually read (eyes/verbal) ☐ unprompted relocation (the moment, timestamped) ☐ rival reaction quote ☐ confusion moments ☐ where they'd stop playing.
- **Survey (5 questions):** Why did your score change? · What would you do differently next time? · Did the rival matter to you? · Would you play tomorrow? (Y/N) · What was confusing?
- **Decision matrix:** All 6 gates pass → **Continue**. Relocation ≥40% but 1–2 secondary gates miss → **Iterate** (1 week, retest n=5). Relocation 25–40% → **Iterate the loop itself** (levers above), full retest. Relocation <25% or comprehension <50% after one iteration → **Pivot/Kill** discussion.
- **What matters most:** if only one number survives the playtest, it is voluntary relocation rate. A tester who moves a building nobody told them to move has demonstrated the entire product thesis.

---

# 24. QA Checklist

| # | Test case | Steps | Expected result | Priority | Pass/Fail |
|---|---|---|---|---|---|
| 1 | Valid placement | Drag Cottage to empty Clear Land, affordable | Commits; score updates <100ms | P0 | ☐ |
| 2 | Occupied tile | Drag onto occupied tile | Red tint, "Occupied", returns to tray | P0 | ☐ |
| 3 | River requirement | Drag Dock to non-river-adjacent tile | Red tint, "Needs a River beside it" | P0 | ☐ |
| 4 | Unaffordable | Attempt purchase without funds | Tray item dimmed with cost shown; drag disabled | P0 | ☐ |
| 5 | Terrain bonus | LC beside 2 Forest | Report: "+40% Wood from Forest ×2"; output 14/min | P0 | ☐ |
| 6 | Terrain cap | LC beside 4 Forest | "+60% (MAX)"; equals 3-Forest output | P0 | ☐ |
| 7 | Synergy | Sawmill within 2 of LC | Both reports show their §14 lines | P0 | ☐ |
| 8 | Conflict preview | Drag Forge to within 2 of Cottage | Red "−10 Happiness" line **before** commit | P0 | ☐ |
| 9 | Conflict applied | Commit that Forge | Happiness line drops by 20 (10×2 scale); Imbalance appears if triggered | P0 | ☐ |
| 10 | Breakdown integrity | Any board state | Lines sum exactly to total | P0 | ☐ |
| 11 | Live preview accuracy | Note preview delta, commit | Committed score change == previewed change | P0 | ☐ |
| 12 | Relocation | Move placed LC to better spot | Old tile frees; new bonuses apply; score correct (T12) | P0 | ☐ |
| 13 | FTUE free relocation | Move during FTUE | No Gold charge; post-FTUE move charges 10 | P0 | ☐ |
| 14 | Quest completion | Complete Q1–Q8 in order | Each auto-detects; rewards claimable once | P0 | ☐ |
| 15 | Rival flow | Reach FTUE step 11 | Rival = player+34; card, microcopy, delta correct | P0 | ☐ |
| 16 | Rival comeback | Beat rival, restart session | "Realm Bested!" then rival +8–12% next session | P1 | ☐ |
| 17 | Save/load | Kill app mid-session, reopen | Identical realm, score, quests, rival state | P0 | ☐ |
| 18 | Analytics log | Full FTUE run, export | Every §23.1 event present, ordered, timestamped | P0 | ☐ |
| 19 | Portrait safe areas | Notched phone test | No UI under notch/home bar; tray thumb-reachable | P0 | ☐ |
| 20 | Readability | 390×844 viewport | All report text legible; no truncated microcopy | P0 | ☐ |
| 21 | Low-end perf | 4× CPU throttle profile | Drag stays ≥50fps; no input lag on commit | P1 | ☐ |
| 22 | Idle fallbacks | Stall 10s at each FTUE step | Correct hint fires per §10 fallback column | P1 | ☐ |

---

# 25. 7-Day Production Plan

| Day | Objective | Tasks | Owner role | Deliverable | Acceptance criteria | Risk |
|---|---|---|---|---|---|---|
| 1 | Lock design ground truth | Finalize §7 fun spec, §13 matrix, §16 formula; author the 6×6 map; write config JSONs (task 1) | Game Director + Economy Designer | Signed §7/§13/§16 + config files | Golden layouts hand-computed: 306/248/559 verified on paper | Relitigating locked decisions — producer enforces D-list |
| 2 | Board foundations | Grid render, terrain map, placement validator (task 2), tray shell | Tech (Claude Code) | Tappable 6×6 with terrain, rejection reasons working | QA #1–4 pass | Touch ergonomics on small screens — test on device day 2, not day 6 |
| 3 | Placement + relocation | Drag-place, drag-relocate, costs, collection (tasks 4, 7) | Tech + UX | Buildings placeable/movable with economy live | QA #12–13 pass | Drag feel is make-or-break — timebox juice, not mechanics |
| 4 | **Scoring + report** | Scoring module w/ tests T1–T12 (task 3), AdjacencyReport (task 5), breakdown panel (task 6) | Tech + Data | The core proof surfaces working | T1–T12 green; QA #5–11 pass | The critical day; if slipping, cut Day 5's quest polish, never the tests |
| 5 | FTUE + rival + quests | FtueDirector (task 10), quests (task 8), fake rival (task 9) | UX + Design | Cold-start playable FTUE through reward | Cold internal tester completes FTUE <5 min unassisted | FTUE microcopy drift — copy is locked in §10, no rewrites without director |
| 6 | Save, analytics, QA | Mock save + analytics (task 11), full §24 pass, low-end profile (task 12), internal dry-run playtest ×2 | QA Lead + Tech | Release candidate + working metric export | §24 all P0 pass; analytics export complete | Dry-run reveals FTUE stalls — fix fallbacks, don't add features |
| 7 | **Playtest + decision** | 10-tester moderated protocol (§23.3), metrics compiled, gate review | Producer + Data + all observing | Metrics report + kill/continue call | All 6 gates evaluated with data, decision documented | Team grades its own homework — moderator ≠ builder; quotes recorded verbatim |

---

# 26. 30-Day Production Plan

| Week | Goal | Build work | Design work | Analytics work | QA work | Decision gate |
|---|---|---|---|---|---|---|
| 1 | Greybox prototype (the §25 plan) | Tasks 1–12 | Lock matrices/formula/FTUE | Event schema live | §24 pass | **Gate A (Day 7): §27 table — Continue / Iterate / Pivot / Kill** |
| 2 | Fix what the playtest exposed | FTUE clarity fixes, report iteration, tuning via config only | Retune terrain deltas/costs from observed behavior; NO new systems | Re-run funnel on n=5 retest | Regression on §24 | **Gate B: previously failed metrics now pass; relocation holds ≥40%** |
| 3 | Market-appeal skin + deeper rival loop | Replace greybox with first-pass fantasy art (12 buildings, 5 terrains, 1 style); rival comeback loop; quests 11–16; post-FTUE relocation cost live (P1) | Art style test (the "does it look generic?" CPI risk probe — 3 static store-style screenshots, 20-person preference test) | Add relocation-after-cost metric; session-2 return logging | Perf with real art on low-end | **Gate C: art preference ≥60% positive; relocation rate survives the 10-Gold cost within 10 pts** |
| 4 | Retention probe | 8×8 grid expansion + 4 new buildings (config-only additions); day-2/day-3 content | Second-session quest arc; rival growth tuning | 3-day mini-retention panel (n=15, D1/D2 return tracked) | Full regression | **Gate D: D1 return ≥50% of panel, session-2 relocations occur → approve soft-launch architecture planning (the §22 migration)** |

Explicitly absent from all 30 days: real IAP, guilds, full backend, events, league settlement, push, biomes beyond the one art style.

---

# 27. Kill / Continue Gates

| Signal | Continue | Iterate | Pivot | Kill |
|---|---|---|---|---|
| First placement <30s | ≥80% | 60–79% (FTUE cut) | — | — (UX-fixable, never fatal alone) |
| Score comprehension | ≥70% | 50–69% (report iteration) | <50% after 2 iterations → score model too complex → simplify formula categories | — |
| **Voluntary relocation** | **≥40%** | 25–39% → redesign loop levers (terrain deltas, tile scarcity, rival triggers), full retest | <25% after loop redesign → placement-optimization thesis failing → pivot candidates: merge-style board, or event-pressure-driven placement | <15% twice → the core bet is wrong; stop |
| Rival engagement | ≥50% | 30–49% (presentation) | <30% after iteration → async-competition hook weak → test co-op/goal framing before building any league | — |
| Session length | ≥6 min median | 4–6 min | — | — |
| Replay desire (survey) | ≥50% | 35–49% | <35% with passing loop metrics → wrapper/fantasy problem, not loop problem | — |
| Tutorial completion | ≥80% before rival | 60–79% | — | — |
| Observed behavior | Testers narrate placement reasoning unprompted ("this goes here because…") | Testers place silently but correctly | Testers place randomly and don't notice score | Testers ask "what am I supposed to do?" after FTUE, repeatedly |

**Ruthlessness clause:** metrics may only be waived upward, never downward. "It felt fun to us" is not data. If voluntary relocation fails, the correct next build is a redesigned core loop prototype — not events, not monetization, not backend, not art. Any teammate proposing production systems before Gate A passes is pointed at §4.O1.

---

# 28. Final Recommended Next Action

**Build the greybox prototype now.**

6×6 map · 12 buildings from §13 · live adjacency report per §18 · transparent prosperity score per §16 · fake rival per §19 · free FTUE relocation · 10 quests · local save · scoring tests T1–T12 · 10-player playtest on Day 7.

Day 1 starts with three signatures: fun spec (§7), building matrix (§13), score formula (§16). Everything a small AI-assisted team needs to start Task 1 this morning is in this document.

Do not build backend, monetization, events, guilds, or live ops next. They are all waiting, fully designed, on the other side of one number: **40% of ten strangers moving a building nobody told them to move.**
