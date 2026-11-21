// Minimal geodesy for trigger templates. Coordinates are [lon, lat] (GeoJSON order).
export type LonLat = [number, number];
export type Ring = LonLat[];
export type Polygon = Ring[]; // outer ring + holes
export type MultiPolygon = Polygon[];

const R = 6_371_008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LonLat, b: LonLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pointInRing(p: LonLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(p: LonLat, poly: Polygon): boolean {
  const [outer, ...holes] = poly;
  if (!outer || !pointInRing(p, outer)) return false;
  return !holes.some((h) => pointInRing(p, h));
}

/** Distance in metres from a point to a segment, using a local equirectangular projection (fine below ~50 km). */
function pointSegmentM(p: LonLat, a: LonLat, b: LonLat): number {
  const k = Math.cos(rad(p[1]));
  const toXY = (q: LonLat) => [rad(q[0] - p[0]) * k * R, rad(q[1] - p[1]) * R] as const;
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** 0 if the point is inside; otherwise the distance to the nearest edge, in metres. */
export function distanceToPolygonsM(p: LonLat, polys: MultiPolygon): number {
  let best = Infinity;
  for (const poly of polys) {
    if (pointInPolygon(p, poly)) return 0;
    for (const ring of poly) {
      for (let i = 0; i + 1 < ring.length; i++) best = Math.min(best, pointSegmentM(p, ring[i]!, ring[i + 1]!));
    }
  }
  return best;
}
