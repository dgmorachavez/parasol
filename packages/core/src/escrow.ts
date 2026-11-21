// Escrow port. Production adapter (to build): Trustless Work on Stellar, one single-release escrow per bid (D19).
// The in-memory adapter mirrors the same lifecycle for tests and offline runs.

export type EscrowId = string;

export type ShareEscrowSpec = {
  protectionId: string;
  backer: string; // funds the escrow; default receiver at expiry
  buyer: string; // receives the collateral if the trigger fires
  amount: bigint; // USDC base units
  resolver: string; // Parasol resolver address (dispute resolver / release signer)
  platform: string; // protocol fee address
};

export interface EscrowPort {
  create(spec: ShareEscrowSpec): Promise<EscrowId>;
  fund(id: EscrowId, from: string, amount: bigint): Promise<void>;
  /** Not triggered at term end: collateral back to the backer. */
  releaseToBacker(id: EscrowId, evidenceRef: string): Promise<void>;
  /** Triggered: resolver routes the collateral to the buyer. */
  payBuyer(id: EscrowId, evidenceRef: string): Promise<void>;
  get(id: EscrowId): Promise<EscrowState>;
}

export type EscrowState = ShareEscrowSpec & {
  id: EscrowId;
  funded: bigint;
  status: 'created' | 'funded' | 'released_to_backer' | 'paid_to_buyer';
  evidenceRef?: string;
};

export class InMemoryEscrow implements EscrowPort {
  private store = new Map<EscrowId, EscrowState>();
  private seq = 0;
  readonly balances = new Map<string, bigint>();

  async create(spec: ShareEscrowSpec): Promise<EscrowId> {
    const id = `mem-${++this.seq}`;
    this.store.set(id, { ...spec, id, funded: 0n, status: 'created' });
    return id;
  }
  async fund(id: EscrowId, from: string, amount: bigint): Promise<void> {
    const e = this.must(id);
    if (from !== e.backer) throw new Error('only the backer funds a share escrow');
    if (e.funded + amount > e.amount) throw new Error('overfunding');
    e.funded += amount;
    if (e.funded === e.amount) e.status = 'funded';
  }
  async releaseToBacker(id: EscrowId, evidenceRef: string): Promise<void> {
    this.close(id, 'released_to_backer', evidenceRef, (e) => e.backer);
  }
  async payBuyer(id: EscrowId, evidenceRef: string): Promise<void> {
    this.close(id, 'paid_to_buyer', evidenceRef, (e) => e.buyer);
  }
  async get(id: EscrowId): Promise<EscrowState> {
    return { ...this.must(id) };
  }
  private close(id: EscrowId, status: EscrowState['status'], evidenceRef: string, to: (e: EscrowState) => string) {
    const e = this.must(id);
    if (e.status !== 'funded') throw new Error(`escrow ${id} is ${e.status}`);
    e.status = status;
    e.evidenceRef = evidenceRef;
    this.balances.set(to(e), (this.balances.get(to(e)) ?? 0n) + e.funded);
  }
  private must(id: EscrowId): EscrowState {
    const e = this.store.get(id);
    if (!e) throw new Error(`unknown escrow ${id}`);
    return e;
  }
}
