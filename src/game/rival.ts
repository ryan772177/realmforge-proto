import rivalJson from "../../config/rival.json";

export interface RivalState {
  seed: string;
  name: string;
  score: number;
  revealed: boolean;
  actionCount: number;
}

interface RivalConfig {
  firstRevealOffset: number;
  growthBand: { min: number; max: number };
  maxLeadOverPlayer: number;
  betweenSessionGrowthPercent: { min: number; max: number };
  comebackPercent: { min: number; max: number };
  updateEveryNActions: number;
  neverDecreases: boolean;
  names: string[];
  microcopy: { reveal: string; behind: string; close: string; ahead: string; return: string };
}

const CONFIG = rivalJson as RivalConfig;

// Deterministic PRNG (mulberry32) seeded from a hash of a string key, so the
// same (save seed, action index) pair always draws the same value — required
// for §19.1 "Determinism: same rival behavior on replay of the same save."
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randAt(seed: string, salt: string): number {
  return mulberry32(hashString(`${seed}:${salt}`))();
}

function inRange(seed: string, salt: string, min: number, max: number): number {
  return min + randAt(seed, salt) * (max - min);
}

export function pickRivalName(seed: string): string {
  const idx = Math.floor(randAt(seed, "name") * CONFIG.names.length);
  return CONFIG.names[Math.min(idx, CONFIG.names.length - 1)] ?? CONFIG.names[0]!;
}

// §19.1 "First score": rival = player_score_at_first_reveal + fixed offset
export function revealRival(seed: string, playerScoreAtReveal: number): RivalState {
  return {
    seed,
    name: pickRivalName(seed),
    score: Math.round(playerScoreAtReveal + CONFIG.firstRevealOffset),
    revealed: true,
    actionCount: 0,
  };
}

// §19.1 "Ongoing score": recomputed every N player actions:
// rival = max(rival, player * U), U ~ uniform(growthBand), capped at player + maxLead.
// Rival never drops (neverDecreases).
export function recordPlayerAction(state: RivalState, playerScore: number): RivalState {
  if (!state.revealed) return state;
  const actionCount = state.actionCount + 1;
  if (actionCount % CONFIG.updateEveryNActions !== 0) {
    return { ...state, actionCount };
  }
  const u = inRange(state.seed, `action:${actionCount}`, CONFIG.growthBand.min, CONFIG.growthBand.max);
  const candidate = Math.round(playerScore * u);
  const capped = Math.min(candidate, playerScore + CONFIG.maxLeadOverPlayer);
  const nextScore = CONFIG.neverDecreases ? Math.max(state.score, capped) : capped;
  return { ...state, score: nextScore, actionCount };
}

// §19.1 "Between sessions": on app open after >=2h, rival gains 5-10%.
export function applyBetweenSessionGrowth(state: RivalState, sessionIndex: number): RivalState {
  if (!state.revealed) return state;
  const pct = inRange(state.seed, `session:${sessionIndex}`, CONFIG.betweenSessionGrowthPercent.min, CONFIG.betweenSessionGrowthPercent.max);
  return { ...state, score: Math.round(state.score * (1 + pct / 100)) };
}

// §19.1 "Overtake behavior": after the player passes the rival, it "responds"
// next session with +8-12%.
export function applyComeback(state: RivalState, sessionIndex: number): RivalState {
  if (!state.revealed) return state;
  const pct = inRange(state.seed, `comeback:${sessionIndex}`, CONFIG.comebackPercent.min, CONFIG.comebackPercent.max);
  return { ...state, score: Math.round(state.score * (1 + pct / 100)) };
}

export type RivalMicrocopyKey = "reveal" | "behind" | "close" | "ahead" | "return";

// "Close" vs "behind" isn't given an exact threshold in §19.3 — using half the
// first-reveal offset (17 points) as the cutoff between the two encouragement
// tones is a reasonable default for a greybox prototype; revisit if playtest
// feedback says otherwise.
const CLOSE_THRESHOLD = Math.round(CONFIG.firstRevealOffset / 2);

export function rivalMicrocopy(state: RivalState, playerScore: number, key?: RivalMicrocopyKey): string {
  const delta = Math.abs(state.score - playerScore);
  const resolvedKey: RivalMicrocopyKey =
    key ?? (playerScore >= state.score ? "ahead" : delta <= CLOSE_THRESHOLD ? "close" : "behind");
  return CONFIG.microcopy[resolvedKey]
    .replace("{name}", state.name)
    .replace("{rivalScore}", String(state.score))
    .replace("{playerScore}", String(playerScore))
    .replace("{delta}", String(delta));
}

export function beatsRival(state: RivalState, playerScore: number): boolean {
  return state.revealed && playerScore >= state.score;
}
