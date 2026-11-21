// Trigger templates (SPEC §4). Each evaluator is pure: same data + same rule = same result.
import { distanceToPolygonsM, haversineM, type LonLat, type MultiPolygon } from './geo.js';

export type Evaluation =
  | { status: 'triggered'; observedValue?: number; windowStartUtc?: string; windowEndUtc?: string; evidenceRef: string }
  | { status: 'not_triggered'; observedValue?: number; evidenceRef: string }
  | { status: 'insufficient_data'; reason: string };

// ---------- wildfire.perimeter ----------
export type FirePerimeter = {
  id: string; // official feature ID
  name: string;
  discoveredUtc: string; // ISO time the fire started
  acres: number;
  ignition: LonLat; // point of origin
  geometry: MultiPolygon;
};

export type WildfireParams = { radiusM: number; minAcres: number; minIgnitionDistanceM: number };
export const WILDFIRE_DEFAULTS: WildfireParams = { radiusM: 100, minAcres: 100, minIgnitionDistanceM: 2000 };

export function evaluateWildfire(point: LonLat, termStartUtc: string, termEndUtc: string, fires: FirePerimeter[], params: WildfireParams = WILDFIRE_DEFAULTS): Evaluation {
  const start = Date.parse(termStartUtc), end = Date.parse(termEndUtc);
  for (const f of fires) {
    const t = Date.parse(f.discoveredUtc);
    if (!(t >= start && t < end)) continue; // fire must start within the term
    if (f.acres < params.minAcres) continue; // a house fire never counts
    if (haversineM(point, f.ignition) < params.minIgnitionDistanceM) continue; // anti-manipulation
    if (distanceToPolygonsM(point, f.geometry) <= params.radiusM) {
      return { status: 'triggered', evidenceRef: f.id };
    }
  }
  return { status: 'not_triggered', evidenceRef: fires.map((f) => f.id).join(',') || 'none' };
}

// ---------- rain.rolling_max ----------
// Open-Meteo hourly values: timestamp T (UTC, hour end) covers [T-1h, T). Values in tenths of mm; null = missing.
export type HourlySeries = { endUtc: string[]; tenths: (number | null)[] };

export type Window = { startUtc: string; endUtc: string; sumTenths: number };

const HOUR = 3600_000;

/** Every complete window of `hours` consecutive, non-null hours. Missing data is never zero. */
export function rollingSums(s: HourlySeries, hours: number): Window[] {
  if (s.endUtc.length !== s.tenths.length) throw new Error('series length mismatch');
  const out: Window[] = [];
  for (let i = 0; i + hours <= s.tenths.length; i++) {
    let sum = 0, ok = true;
    for (let k = i; k < i + hours; k++) {
      const v = s.tenths[k];
      if (v === null || v === undefined || v < 0) { ok = false; break; }
      if (k > i && Date.parse(s.endUtc[k]!) - Date.parse(s.endUtc[k - 1]!) !== HOUR) { ok = false; break; }
      sum += v;
    }
    if (!ok) continue;
    const startUtc = new Date(Date.parse(s.endUtc[i]!) - HOUR).toISOString();
    out.push({ startUtc, endUtc: new Date(Date.parse(s.endUtc[i + hours - 1]!)).toISOString(), sumTenths: sum });
  }
  return out;
}

export function evaluateRainRollingMax(s: HourlySeries, windowHours: number, thresholdTenths: number, sourceRef: string): Evaluation {
  const windows = rollingSums(s, windowHours);
  if (windows.length === 0) return { status: 'insufficient_data', reason: 'no complete window in term' };
  let best = windows[0]!;
  for (const w of windows) if (w.sumTenths > best.sumTenths) best = w; // ties: earliest wins
  return best.sumTenths >= thresholdTenths
    ? { status: 'triggered', observedValue: best.sumTenths, windowStartUtc: best.startUtc, windowEndUtc: best.endUtc, evidenceRef: sourceRef }
    : { status: 'not_triggered', observedValue: best.sumTenths, evidenceRef: sourceRef };
}

// ---------- quake.magnitude_radius ----------
export type Quake = { id: string; timeUtc: string; magnitude: number; epicenter: LonLat };

export function evaluateQuake(point: LonLat, termStartUtc: string, termEndUtc: string, quakes: Quake[], minMagnitude: number, radiusKm: number): Evaluation {
  const start = Date.parse(termStartUtc), end = Date.parse(termEndUtc);
  const hits = quakes
    .filter((q) => { const t = Date.parse(q.timeUtc); return t >= start && t < end; })
    .filter((q) => q.magnitude >= minMagnitude && haversineM(point, q.epicenter) <= radiusKm * 1000)
    .sort((a, b) => b.magnitude - a.magnitude);
  const top = hits[0];
  return top
    ? { status: 'triggered', observedValue: top.magnitude, evidenceRef: top.id }
    : { status: 'not_triggered', evidenceRef: 'usgs-catalog' };
}

// ---------- registry of v1 templates ----------
/** v1 templates and the minimum days between the end of the auction and the start of the term. */
export const TEMPLATE_WAITING_DAYS: Readonly<Record<string, number>> = {
  'wildfire.perimeter': 14, // anti-manipulation (SPEC §4, D7)
  'rain.rolling_max': 0,
  'quake.magnitude_radius': 0,
};

/** Request-time checks (SPEC §5): the template must be known and the term must respect its waiting period. */
export function validateRequestTerms(templateId: string, auctionEnd: number, termStart: number, termEnd: number): void {
  const waitingDays = TEMPLATE_WAITING_DAYS[templateId];
  if (waitingDays === undefined) throw new Error(`unknown template ${templateId}`);
  if (termEnd <= termStart) throw new Error('term must be positive');
  if (termStart < auctionEnd + waitingDays * 86_400) throw new Error(`term must start at least ${waitingDays} days after the auction ends`);
}
