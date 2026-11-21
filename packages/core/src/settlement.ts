// Settlement (SPEC §7), shaped for Trustless Work: each bid funds its own escrow when placed (D19);
// after clearing, an accepted escrow holds only that backer's share. The price is paid out at clearing.
import { BPS, type Share } from './auction.js';

export type Outcome = {
  triggered: boolean;
  observedValue?: number;
  windowStartUtc?: string;
  windowEndUtc?: string;
  evidenceRef: string;
  dataVersion: string;
  dataSha256: string;
  retrievedAtUtc: string;
  postedAt: number; // unix seconds
};

export type Transfer = {
  to: string;
  amount: bigint;
  reason: 'payout' | 'collateral_return' | 'price_share' | 'protocol_fee';
};

export const DISPUTE_WINDOW_SECONDS = 72 * 3600;

/** Splits `total` pro rata to `shares`, rounding down; the remainder goes to the first share. */
export function proRata(total: bigint, shares: Share[]): bigint[] {
  const sum = shares.reduce((a, s) => a + s.amount, 0n);
  if (sum === 0n) return shares.map(() => 0n);
  const parts = shares.map((s) => (total * s.amount) / sum);
  const rest = total - parts.reduce((a, b) => a + b, 0n);
  if (parts.length > 0) parts[0] = parts[0]! + rest;
  return parts;
}

/** At clearing: the buyer's price goes to the backers pro rata, minus the protocol fee. */
export function distributePrice(price: bigint, shares: Share[], feeBps: number, feeRecipient: string): Transfer[] {
  const fee = (price * BigInt(feeBps)) / BPS;
  const parts = proRata(price - fee, shares);
  const out: Transfer[] = [];
  if (fee > 0n) out.push({ to: feeRecipient, amount: fee, reason: 'protocol_fee' });
  shares.forEach((s, i) => out.push({ to: s.backer, amount: parts[i]!, reason: 'price_share' }));
  return out;
}

export type ShareEscrow = { backer: string; buyer: string; amount: bigint; termEnd: number };

export type SettlementState =
  | { state: 'waiting'; reason: 'no_outcome' | 'dispute_window' | 'term_running' }
  | { state: 'final'; triggered: boolean; transfer: Transfer };

/**
 * Decides where one share escrow goes. Fail closed: nothing moves without an outcome,
 * during the dispute window, or before the term ends when nothing has triggered.
 */
export function settleShare(e: ShareEscrow, outcome: Outcome | undefined, now: number, disputeWindow = DISPUTE_WINDOW_SECONDS): SettlementState {
  if (!outcome) return { state: 'waiting', reason: 'no_outcome' };
  if (now < outcome.postedAt + disputeWindow) return { state: 'waiting', reason: 'dispute_window' };
  if (!outcome.triggered && now < e.termEnd) return { state: 'waiting', reason: 'term_running' };
  return outcome.triggered
    ? { state: 'final', triggered: true, transfer: { to: e.buyer, amount: e.amount, reason: 'payout' } }
    : { state: 'final', triggered: false, transfer: { to: e.backer, amount: e.amount, reason: 'collateral_return' } };
}
