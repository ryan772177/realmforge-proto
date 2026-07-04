// §23.1 event schema + task 11: "analytics logger writing every event ...
// with timestamps, with a debug button exporting the log as JSON." Console +
// in-memory log stands in for the warehouse ingest that comes post-soft-launch
// (§22) — same event names migrate unchanged.

export interface AnalyticsEntry {
  event: string;
  payload: Record<string, unknown>;
  t: number; // ms since session start
}

let log: AnalyticsEntry[] = [];
let sessionStart = Date.now();

export function resetSession(): void {
  log = [];
  sessionStart = Date.now();
}

export function track(event: string, payload: Record<string, unknown> = {}): AnalyticsEntry {
  const entry: AnalyticsEntry = { event, payload, t: Date.now() - sessionStart };
  log.push(entry);
  // eslint-disable-next-line no-console
  console.log(`[analytics] ${event}`, payload, `t+${entry.t}ms`);
  return entry;
}

export function getLog(): readonly AnalyticsEntry[] {
  return log;
}

export function clearLog(): void {
  log = [];
}

export function exportLogAsJson(): string {
  return JSON.stringify(log, null, 2);
}

// §23.1 "confusion_tap: Any tap on non-interactive UI; ≥3 in 10s flags a
// confusion cluster with screen context."
const CONFUSION_WINDOW_MS = 10_000;
const CONFUSION_THRESHOLD = 3;
let confusionTimestamps: number[] = [];

export function trackConfusionTap(screen: string): void {
  const entry = track("confusion_tap", { screen });
  confusionTimestamps.push(entry.t);
  confusionTimestamps = confusionTimestamps.filter((t) => entry.t - t <= CONFUSION_WINDOW_MS);
  if (confusionTimestamps.length >= CONFUSION_THRESHOLD) {
    track("confusion_cluster", { screen, count: confusionTimestamps.length });
    confusionTimestamps = [];
  }
}

export function downloadLogAsFile(filename = "realmforge-analytics.json"): void {
  const blob = new Blob([exportLogAsJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
