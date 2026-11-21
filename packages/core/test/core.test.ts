import { describe, expect, it } from 'vitest';
import {
  clear, protectionPrice, validateBid, distributePrice, settleShare, rollingSums,
  evaluateRainRollingMax, evaluateWildfire, evaluateQuake, InMemoryEscrow, validateRequestTerms,
  type Bid, type AuctionRequest, type FirePerimeter, type Outcome,
} from '../src/index.js';

const U = 1_000_000n; // 1 USDC in base units
const DAY = 86_400;
const T0 = Date.UTC(2024, 6, 1) / 1000;
const req = (limit: bigint, minFill = 0n): AuctionRequest => ({ limit: limit * U, minFill: minFill * U, maxRateBps: 1000, termStart: T0, termEnd: T0 + 365 * DAY });
const bid = (id: number, capacity: bigint, rateBps: number, placedAt = id): Bid => ({ id: BigInt(id), backer: `b${id}`, capacity: capacity * U, rateBps, placedAt });
const BIDS = [bid(1, 40_000n, 300), bid(2, 50_000n, 350), bid(3, 30_000n, 420), bid(4, 20_000n, 500)];

describe('clearing (SPEC §11, tests 1–5)', () => {
  it('1. fills cheapest first and clears at the last accepted rate', () => {
    const r = clear(req(100_000n), 'buyer', BIDS);
    expect(r.status).toBe('cleared');
    if (r.status !== 'cleared') return;
    expect(r.filledLimit).toBe(100_000n * U);
    expect(r.clearingRateBps).toBe(420);
    expect(r.shares.map((s) => s.amount)).toEqual([40_000n * U, 50_000n * U, 10_000n * U]);
    expect(r.refunds).toContainEqual({ to: 'b3', amount: 20_000n * U, reason: 'unused_capacity' });
    expect(r.refunds).toContainEqual({ to: 'b4', amount: 20_000n * U, reason: 'unused_capacity' });
  });

  it('2. below minFill → unfilled, everything refunded', () => {
    const r = clear(req(200_000n, 150_000n), 'buyer', BIDS);
    expect(r.status).toBe('unfilled');
    const total = r.refunds.filter((x) => x.to !== 'buyer').reduce((a, x) => a + x.amount, 0n);
    expect(total).toBe(140_000n * U);
  });

  it('3. ties at the same rate: earlier bid fills first', () => {
    const r = clear(req(10_000n), 'buyer', [bid(1, 10_000n, 300, 50), bid(2, 10_000n, 300, 10)]);
    expect(r.status === 'cleared' && r.shares[0]!.backer).toBe('b2');
  });

  it('4. price of 100,000 at 420 bps over 365 days is 4,200', () => {
    expect(protectionPrice(100_000n * U, 420, T0, T0 + 365 * DAY)).toBe(4_200n * U);
  });

  it('5. rejects bids above max rate or after the auction', () => {
    const r = req(1_000n);
    expect(() => validateBid(r, bid(1, 1n, 1001), 100)).toThrow();
    expect(() => validateBid(r, bid(1, 1n, 500, 101), 100)).toThrow();
    expect(() => validateBid(r, bid(1, 1n, 500, 100), 100)).not.toThrow();
  });

  it('5. rejects requests with an unknown template', () => {
    expect(() => validateRequestTerms('hail.size', T0 - DAY, T0, T0 + 365 * DAY)).toThrow();
    expect(() => validateRequestTerms('rain.rolling_max', T0, T0, T0 + 365 * DAY)).not.toThrow();
  });

  it('5. wildfire requests need 14 days between the auction end and the term start', () => {
    expect(() => validateRequestTerms('wildfire.perimeter', T0 - 13 * DAY, T0, T0 + 365 * DAY)).toThrow();
    expect(() => validateRequestTerms('wildfire.perimeter', T0 - 14 * DAY, T0, T0 + 365 * DAY)).not.toThrow();
  });

  it('excess buyer deposit is refunded', () => {
    const r = clear(req(100_000n), 'buyer', BIDS);
    if (r.status !== 'cleared') throw new Error();
    expect(r.refunds).toContainEqual({ to: 'buyer', amount: 10_000n * U - 4_200n * U, reason: 'excess_deposit' });
  });
});

// A ~1 km square "perimeter" near Pacific Palisades (synthetic geometry for unit tests).
const SQ: FirePerimeter = {
  id: 'TEST-PERIM-1', name: 'Test Fire', discoveredUtc: '2025-01-07T18:30:00Z', acres: 23_000,
  ignition: [-118.50, 34.07],
  geometry: [[[[-118.540, 34.040], [-118.530, 34.040], [-118.530, 34.049], [-118.540, 34.049], [-118.540, 34.040]]]],
};
const TERM = ['2024-07-01T00:00:00Z', '2025-07-01T00:00:00Z'] as const;

describe('wildfire.perimeter (tests 6–7)', () => {
  it('6. inside → triggered; 2 km outside → not; 50 m outside with 100 m buffer → triggered', () => {
    expect(evaluateWildfire([-118.535, 34.045], ...TERM, [SQ]).status).toBe('triggered');
    expect(evaluateWildfire([-118.535, 34.067], ...TERM, [SQ]).status).toBe('not_triggered');
    expect(evaluateWildfire([-118.5294, 34.045], ...TERM, [SQ]).status).toBe('triggered'); // ~55 m east
  });
  it('7. a fire started before the term does not trigger', () => {
    expect(evaluateWildfire([-118.535, 34.045], '2025-02-01T00:00:00Z', '2026-02-01T00:00:00Z', [SQ]).status).toBe('not_triggered');
  });
  it('anti-manipulation: small fires and fires ignited near the point do not count', () => {
    expect(evaluateWildfire([-118.535, 34.045], ...TERM, [{ ...SQ, acres: 5 }]).status).toBe('not_triggered');
    expect(evaluateWildfire([-118.535, 34.045], ...TERM, [{ ...SQ, ignition: [-118.536, 34.046] }]).status).toBe('not_triggered');
  });
});

function series(startEndUtc: string, values: (number | null)[]) {
  const t0 = Date.parse(startEndUtc);
  return { endUtc: values.map((_, i) => new Date(t0 + i * 3600_000).toISOString()), tenths: values };
}

describe('rain.rolling_max (window rules; tests 8–9 need ERA5 fixtures; test 11)', () => {
  it('finds the exact 72 h peak window and reads hour-end timestamps', () => {
    const v = Array<number | null>(96).fill(0);
    for (let i = 10; i <= 81; i++) v[i] = 30; // 72 hours × 3.0 mm = 216.0 mm
    const s = series('2017-10-03T01:00:00Z', v);
    const e = evaluateRainRollingMax(s, 72, 2000, 'fixture');
    expect(e.status).toBe('triggered');
    if (e.status !== 'triggered') return;
    expect(e.observedValue).toBe(2160);
    expect(e.windowStartUtc).toBe('2017-10-03T10:00:00.000Z'); // first timestamp 11:00 covers [10:00, 11:00)
    expect(e.windowEndUtc).toBe('2017-10-06T10:00:00.000Z');
  });
  it('11. a missing hour invalidates every window that contains it; no window → insufficient data', () => {
    const v = Array<number | null>(72).fill(10);
    v[30] = null;
    expect(rollingSums(series('2024-11-01T01:00:00Z', v), 72)).toHaveLength(0);
    expect(evaluateRainRollingMax(series('2024-11-01T01:00:00Z', v), 72, 1, 'x').status).toBe('insufficient_data');
  });
});

describe('quake.magnitude_radius (test 10, synthetic event with catalog values)', () => {
  const Q = [{ id: 'test-q1', timeUtc: '2012-09-05T14:42:00Z', magnitude: 7.6, epicenter: [-85.31, 10.09] as [number, number] }];
  it('10. magnitude ≥ 7 within 50 km during the term → triggered', () => {
    const e = evaluateQuake([-85.45, 10.15], '2012-01-01T00:00:00Z', '2013-01-01T00:00:00Z', Q, 7.0, 50);
    expect(e).toMatchObject({ status: 'triggered', observedValue: 7.6 });
  });
  it('outside the radius or below the magnitude → not triggered', () => {
    expect(evaluateQuake([-84.08, 9.93], '2012-01-01T00:00:00Z', '2013-01-01T00:00:00Z', Q, 7.0, 50).status).toBe('not_triggered');
    expect(evaluateQuake([-85.45, 10.15], '2012-01-01T00:00:00Z', '2013-01-01T00:00:00Z', Q, 8.0, 50).status).toBe('not_triggered');
  });
});

describe('settlement (tests 12–14)', () => {
  const outcome = (triggered: boolean, postedAt: number): Outcome => ({ triggered, evidenceRef: 'e', dataVersion: 'v', dataSha256: 'h', retrievedAtUtc: 't', postedAt });
  const esc = { backer: 'b1', buyer: 'buyer', amount: 40_000n * U, termEnd: T0 + 365 * DAY };

  it('12. nothing moves during the dispute window; after it the buyer gets the share', () => {
    const o = outcome(true, T0 + 100 * DAY);
    expect(settleShare(esc, o, o.postedAt + 3600)).toEqual({ state: 'waiting', reason: 'dispute_window' });
    expect(settleShare(esc, o, o.postedAt + 72 * 3600)).toMatchObject({ state: 'final', transfer: { to: 'buyer', amount: 40_000n * U } });
  });
  it('13. not triggered → collateral back to the backer only after term end', () => {
    const o = outcome(false, T0 + 10 * DAY);
    expect(settleShare(esc, o, T0 + 200 * DAY)).toEqual({ state: 'waiting', reason: 'term_running' });
    expect(settleShare(esc, o, esc.termEnd)).toMatchObject({ state: 'final', transfer: { to: 'b1', reason: 'collateral_return' } });
  });
  it('14. no outcome → nothing can be withdrawn', () => {
    expect(settleShare(esc, undefined, esc.termEnd + 999 * DAY)).toEqual({ state: 'waiting', reason: 'no_outcome' });
  });
  it('13. price is split pro rata at clearing minus the 5% fee, and sums match to the unit', () => {
    const r = clear(req(100_000n), 'buyer', BIDS);
    if (r.status !== 'cleared') throw new Error();
    const t = distributePrice(r.price, r.shares, 500, 'fee');
    expect(t.reduce((a, x) => a + x.amount, 0n)).toBe(r.price);
    expect(t.find((x) => x.reason === 'protocol_fee')!.amount).toBe(210n * U);
  });
});

describe('in-memory escrow mirrors the Trustless Work lifecycle', () => {
  it('fund → pay buyer; cannot release twice', async () => {
    const e = new InMemoryEscrow();
    const id = await e.create({ protectionId: 'p1', backer: 'b1', buyer: 'buyer', amount: 10n, resolver: 'r', platform: 'f' });
    await expect(e.payBuyer(id, 'x')).rejects.toThrow();
    await e.fund(id, 'b1', 10n);
    await e.payBuyer(id, 'TEST-PERIM-1');
    expect(e.balances.get('buyer')).toBe(10n);
    await expect(e.releaseToBacker(id, 'x')).rejects.toThrow();
  });
});
