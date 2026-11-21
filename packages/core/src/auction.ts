// Uniform-price reverse auction (SPEC §6). All money is in USDC base units (bigint).

export const BPS = 10_000n;
export const YEAR_SECONDS = 365n * 24n * 3600n;

export type Bid = {
  id: bigint;
  backer: string;
  capacity: bigint; // locked at bid time
  rateBps: number; // annual rate asked
  placedAt: number; // unix seconds
};

export type AuctionRequest = {
  limit: bigint;
  minFill: bigint;
  maxRateBps: number;
  termStart: number;
  termEnd: number;
};

export type Share = { backer: string; bidId: bigint; amount: bigint };

export type ClearingResult =
  | {
      status: 'cleared';
      filledLimit: bigint;
      clearingRateBps: number;
      price: bigint;
      shares: Share[];
      refunds: { to: string; amount: bigint; reason: 'unused_capacity' | 'excess_deposit' }[];
    }
  | {
      status: 'unfilled';
      refunds: { to: string; amount: bigint; reason: 'unfilled' }[];
    };

/** Price owed for `filledLimit` at `rateBps` per year over the term, rounded down. */
export function protectionPrice(filledLimit: bigint, rateBps: number, termStart: number, termEnd: number): bigint {
  if (termEnd <= termStart) throw new Error('term must be positive');
  return (filledLimit * BigInt(rateBps) * BigInt(termEnd - termStart)) / (BPS * YEAR_SECONDS);
}

/** Deposit the buyer makes at request time: the price at their maximum rate. */
export function maxPriceDeposit(req: AuctionRequest): bigint {
  return protectionPrice(req.limit, req.maxRateBps, req.termStart, req.termEnd);
}

export function validateBid(req: AuctionRequest, bid: Bid, auctionEnd: number): void {
  if (bid.capacity <= 0n) throw new Error('capacity must be positive');
  if (!Number.isInteger(bid.rateBps) || bid.rateBps <= 0) throw new Error('rate must be a positive integer');
  if (bid.rateBps > req.maxRateBps) throw new Error('rate above buyer maximum');
  if (bid.placedAt > auctionEnd) throw new Error('auction closed');
}

/**
 * Clears a request: cheapest bids first (ties by time, then id), fill up to the limit,
 * everyone accepted earns the rate of the last accepted bid.
 */
export function clear(req: AuctionRequest, buyer: string, bids: Bid[]): ClearingResult {
  const sorted = [...bids].sort((a, b) =>
    a.rateBps !== b.rateBps ? a.rateBps - b.rateBps
      : a.placedAt !== b.placedAt ? a.placedAt - b.placedAt
      : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  let remaining = req.limit;
  const shares: Share[] = [];
  let clearingRateBps = 0;
  for (const bid of sorted) {
    if (remaining === 0n) break;
    const take = bid.capacity < remaining ? bid.capacity : remaining;
    shares.push({ backer: bid.backer, bidId: bid.id, amount: take });
    remaining -= take;
    clearingRateBps = bid.rateBps;
  }
  const filledLimit = req.limit - remaining;
  const deposit = maxPriceDeposit(req);

  if (filledLimit === 0n || filledLimit < req.minFill) {
    return {
      status: 'unfilled',
      refunds: [
        ...bids.map((b) => ({ to: b.backer, amount: b.capacity, reason: 'unfilled' as const })),
        { to: buyer, amount: deposit, reason: 'unfilled' as const },
      ],
    };
  }

  const price = protectionPrice(filledLimit, clearingRateBps, req.termStart, req.termEnd);
  const used = new Map(shares.map((s) => [s.bidId, s.amount]));
  const refunds: { to: string; amount: bigint; reason: 'unused_capacity' | 'excess_deposit' }[] = [];
  for (const b of bids) {
    const unused = b.capacity - (used.get(b.id) ?? 0n);
    if (unused > 0n) refunds.push({ to: b.backer, amount: unused, reason: 'unused_capacity' });
  }
  if (deposit > price) refunds.push({ to: buyer, amount: deposit - price, reason: 'excess_deposit' });

  return { status: 'cleared', filledLimit, clearingRateBps, price, shares, refunds };
}

/** UI label value: market price of the risk as % per year (upper bound on implied probability). */
export function impliedAnnualPercent(clearingRateBps: number): number {
  return clearingRateBps / 100;
}
