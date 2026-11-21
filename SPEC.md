# Parasol by Avantus — Technical Specification

**Version:** 5.1 (21 Nov 2026) · **Companion:** `VISION.md` governs scope and market; this document governs implementation.

## 1. Scope and invariants

Parasol is not an insurer; it is an open risk market: no policies, no adjusters, just public data and code. It is a decentralized, on-chain protocol for **any parametric risk**: anything whose outcome can be read from public data (a fire perimeter, rainfall, an earthquake's shaking, wind speed, a river level). Parts: **trigger templates**, **protection requests**, **bids**, **uniform-price clearing**, **escrow**, **oracle settlement** and a public **price map**.

**Invariants**

1. **Full collateral:** a bid is accepted only if its full capacity is deposited in its own escrow when the bid is placed (D5, D19). Total locked capital ≥ total limit of active protections, always.
2. **Integer arithmetic:** money in the stablecoin's smallest unit (USDC, 6 decimals); rates in basis points (bps); measured values as integers in the template's unit (e.g. tenths of a millimetre). No floating point on chain or in comparisons.
3. **One rule per protection:** template, parameters, threshold and location are fixed at request time and stored in the protection; they never change.
4. **Fail closed:** no outcome is posted without complete official data; missing data is never treated as zero; the contract never pays or releases on missing data.
5. **Evidence on chain:** every outcome stores the template, data source and version, window, observed value, retrieval time and a hash of the data used.
6. **Determinism:** same request + same bids = same clearing result; same data + same rule = same outcome.
7. **Test money only** until legal review: a test network and a mock USDC.

## 2. Architecture

```text
Web app (Next.js + MapLibre + Freighter wallet)
  ├─ Map: requests and clearing rates by template, trigger evidence
  ├─ Request form (pick a template, set location, threshold, limit, term)
  ├─ Bid form · Protection page (status, evidence, payout)
        │
Parasol service (Node/TypeScript, packages/core)
  ├─ Template registry and request book
  ├─ Auction: uniform-price clearing (pure, deterministic)
  ├─ Settlement rules: who receives each escrow, when (fail closed)
  └─ EscrowPort → TrustlessWorkEscrow (production, to build) · InMemoryEscrow (tests)
        │
Trustless Work on Stellar (Soroban), USDC
  └─ One single-release escrow per bid: funded by the backer when
     bidding, released to the backer if the bid is not accepted or at term end, or routed to the buyer by the
     resolver when the trigger fires. The API returns unsigned XDR; the
     user's wallet signs; Parasol never holds keys to user funds.
        │
Resolver (Node) with one adapter per template
  ├─ wildfire.perimeter → WFIGS / NIFC perimeters
  ├─ rain.rolling_max → ERA5 hourly precipitation (Open-Meteo)
  ├─ quake.magnitude_radius → USGS earthquake catalog
  └─ (next) drought (rain.rolling_min), wind, river level, heat, air quality, flight status, rainy days
        │
Risk brief service (AI, server side) → validated text per request
```

**Escrow mapping (Trustless Work roles).** For each bid escrow: depositor and default receiver = the backer; dispute resolver and release signer = the Parasol resolver address; platform address = Parasol, with the Trustless Work platform fee set to 0 (the protocol fee is taken from the price at clearing, §7, so it is never charged twice). Not triggered at term end → release to the backer. Triggered → the resolver opens a dispute with the evidence and resolves it with the full amount to the buyer. To confirm on testnet: whether a contract address can hold the resolver role, and the exact split format of a resolution (also used to return the unused part of a partially filled bid).

## 3. Domain model

```ts
// A reusable kind of parametric question. Anyone can publish one; the market decides if it gets bids.
type TriggerTemplate = {
  id: string;                        // e.g. 'wildfire.perimeter', 'rain.rolling_max'
  version: number;
  description: string;               // the question in plain words
  source: { provider: string; dataset: string; version: string; license: string };
  unit: string;                      // e.g. 'tenths_mm', 'boolean', 'cm_s2'
  aggregation: 'intersects' | 'rolling_max' | 'rolling_min' | 'max';
  comparator: '>=' | '<=' | 'true';
  params: string[];                  // e.g. ['radiusM'] or ['windowHours']
  adapterId: string;                 // resolver adapter that evaluates it
  fixtures: string;                  // hash of the test fixtures that prove the adapter
};

type ProtectionRequest = {
  id: bigint;
  buyer: Address;
  templateId: string; templateVersion: number;
  lat: number; lon: number;          // on chain as int32 micro-degrees
  params: Record<string, number>;    // e.g. { radiusM: 100 } or { windowHours: 72 }
  threshold?: number;                // integer in the template's unit; none for 'true'
  limit: bigint;                     // USDC units
  minFill: bigint;
  maxRateBps: number;                // highest annual rate the buyer accepts
  termStart: number; termEnd: number;
  auctionEnd: number;
  status: 'open' | 'cleared' | 'unfilled' | 'cancelled';
};

type Bid = {
  id: bigint; requestId: bigint; backer: Address;
  capacity: bigint;                  // USDC locked at bid time
  rateBps: number;                   // annual rate asked
  placedAt: number;
};

type Protection = {
  requestId: bigint;
  filledLimit: bigint;
  clearingRateBps: number;
  price: bigint;                     // filledLimit × rate × term / year
  shares: { backer: Address; amount: bigint }[];
  status: 'active' | 'triggered' | 'expired' | 'disputed';
  outcome?: Outcome;
};

type Outcome = {
  triggered: boolean;
  observedValue?: number;            // e.g. 2139 tenths of mm; absent for 'intersects'
  windowStartUtc?: string; windowEndUtc?: string;
  evidenceRef: string;               // e.g. perimeter feature ID, or source URL
  dataVersion: string;
  dataSha256: string;
  retrievedAtUtc: string;
  postedAt: number;
};
```

## 4. Trigger templates

| Template | Question | Data | Status |
|---|---|---|---|
| `wildfire.perimeter` | Does an official fire perimeter, for a fire started in the term, of at least `minAcres` and ignited at least `minIgnitionDistanceM` from the point, intersect the circle of `radiusM` around the point? | WFIGS Interagency Fire Perimeters (NIFC, public domain) | v1 |
| `rain.rolling_max` | Does the rainfall summed over any `windowHours` window in the term reach `threshold`? (floods, storms) | ERA5 hourly precipitation via Open-Meteo (CC BY 4.0) | v1 |
| `rain.rolling_min` | Does the rainfall over every `windowHours` window stay at or below `threshold`? (drought) | Same | Next |
| `quake.magnitude_radius` | Does an earthquake of magnitude ≥ `threshold` occur within `radiusKm` of the point? | USGS earthquake catalog (public domain) | v1 |
| `quake.pga` | Does peak ground acceleration at the point reach `threshold`? | USGS ShakeMap | Later |
| `rain.days_over` | Are there more than `maxDays` days in the term with rainfall ≥ `threshold`? (seasonal businesses) | ERA5 via Open-Meteo | Next |
| `heat.consecutive_days` | Does the daily maximum heat index stay ≥ `threshold` for `days` days in a row? (livestock, outdoor work) | ERA5 temperature and humidity | Next |
| `air.aqi` | Does the daily air-quality index at the nearest official station reach `threshold`? | AirNow / OpenAQ | Next |
| `flight.delay` | Is the flight cancelled, or does it arrive more than `minutes` late? | Public flight-status data | Next |
| `wind.max_sustained` | Does the maximum sustained wind at the point reach `threshold` during a named storm? (hurricanes) | NOAA National Hurricane Center | Next |
| `river.level` | Does the gauge reach `threshold` (e.g. flood stage)? | USGS / national hydromet gauges | Next |

**Anti-manipulation rules (moral hazard):** the payout depends on a public measurement, not on the buyer's loss, so damaging one's own property never triggers anything. Each template must also state why the buyer cannot move the measurement. `wildfire.perimeter` defaults: `minAcres` 100 (a house fire never gets a wildland perimeter), `minIgnitionDistanceM` 2,000 (a fire started near the property does not count), and a `waitingDays` of 14 between the end of the auction and the start of the term (enforced when the request is created). Weather and earthquake templates cannot be influenced by the buyer. A dispute can also reject an outcome with evidence that the fire was set by the buyer.

**Publishing a template:** anyone can publish to `TemplateRegistry` with its description, source, adapter id and fixture hash. A template is usable once a resolver runs its adapter and its fixtures pass. Templates are versioned and immutable; a fix is a new version.

**Rainfall rules:** Open-Meteo timestamps mark the end of each hour, so timestamp `T` covers `[T−1h, T)`; a window exists only if all its hours are present; pin `models=era5`, `timezone=GMT`.

## 5. Request and bids

- **Create request:** the buyer picks a template, sets location, parameters, threshold, limit, term and maximum rate, and deposits `limit × maxRateBps × termFraction`. Requires a known template and `termStart ≥ auctionEnd + waitingDays` (14 days for `wildfire.perimeter`, 0 for the other v1 templates).
- **Place bid:** `0 < rateBps ≤ maxRateBps`, `capacity > 0`; the backer funds one escrow with the full `capacity` (D19). Bids can be withdrawn until `auctionEnd`; the escrow is then released back to the backer.
- **Cancel request:** only before the first bid; refunds the buyer.

## 6. Clearing (uniform-price reverse auction)

At or after `auctionEnd`, anyone can call `clear(requestId)`:

1. Sort bids by `rateBps` ascending; ties by `placedAt`, then by `id`.
2. Accept bids in order until their capacity sums to `limit`. The last accepted bid may be partially filled.
3. `filledLimit` = accepted capacity (≤ `limit`). If `filledLimit < minFill` → `unfilled`: all deposits refunded.
4. `clearingRateBps` = rate of the last accepted bid. Every accepted backer earns this rate on their share.
5. `price = filledLimit × clearingRateBps × (termEnd − termStart) / (10,000 × 365 days)`, rounded down. The excess deposit is refunded to the buyer; escrows of bids not accepted are released to their backers, and the unused part of a partially filled bid is returned to its backer.
6. Emit `Cleared(requestId, templateId, filledLimit, clearingRateBps)`; the price map reads this event.

**Implied probability shown in the UI:** `clearingRateBps / 100` % per year, labelled "market price of this risk (upper bound on the implied annual probability; includes the backers' margin)".

## 7. Settlement

- **At clearing:** the buyer's price is paid out immediately: the protocol fee to the platform address and the rest to the backers pro rata (rounding remainder to the first share). Each accepted bid's escrow now holds that backer's share of the limit; unused capacity goes back to its backer (D19).
- **Outcome:** the resolver runs the template's adapter over the term and records an `Outcome` with its evidence.
- **Dispute window:** 72 h after the outcome is posted. Anyone can challenge it with counter-evidence; nothing moves during the window. On the test network the window can be shortened to minutes.
- **After the window**, for each accepted bid's escrow:
  - `triggered` → the full share goes to the buyer.
  - not triggered and `now ≥ termEnd` → the full share goes back to its backer.
- **Early trigger:** a `rolling_max`, `intersects` or `magnitude_radius` template can trigger before `termEnd`; a `rolling_min` template only after `termEnd`.
- **No data:** without an outcome nothing is released (fail closed).
- **Protocol fee:** `feeBps` of the price (default 500 = 5%), taken at clearing.

## 8. Risk brief (AI)

- For each request, the server builds a JSON of public facts from the template's own data: for wildfire, distance to the nearest historical perimeter and fires within 5 km since 2000; for rainfall, how many of the last 35 years the threshold would have been reached and the largest value. Plus clearing rates of nearby requests on the same template.
- An LLM writes a short brief for backers from that JSON only.
- **Validator:** every number in the text must exist in the JSON; otherwise a deterministic template text is shown.
- The AI has no access to the contracts and cannot affect clearing or settlement.

## 9. Screens

1. **Map:** open requests (time left, best rate) and cleared protections coloured by clearing rate, filterable by template; trigger evidence (perimeters, rainfall windows).
2. **Request:** pick a template, click a location, set threshold, limit, term and max rate. Shows the template's question and basis-risk note in plain words before signing.
3. **Request detail / bid:** risk brief, bid book (rate and capacity, anonymised addresses), bid form, countdown, "Clear" when the auction is over.
4. **Protection:** status, filled limit, clearing rate, shares, outcome with evidence, payouts.
5. **Templates:** published templates, their sources and how many protections use each.

## 10. Reference scenarios: three assets, three risks, one market

- **Wildfire:** term 2024-07-01 to 2025-06-30; 6–8 synthetic points in and around Pacific Palisades (grid points, not real addresses), some inside the final perimeter of the 7 January 2025 Palisades Fire, some outside, one at the edge.
- **Coffee in Costa Rica (same market, another risk):** a coffee farmer in Tarrazú (Los Santos) who was refused cover lists a `rain.rolling_max` protection, 72 h, threshold 400.0 mm, term 2024-07-01 to 2025-06-30, replayed against the November 2024 storms (ERA5 72 h maximum 462.4 mm). A second point in Liberia replays Hurricane Nate (October 2017).
- **A shop in Nicoya (earthquake):** a shop owner lists `quake.magnitude_radius`, magnitude ≥ 7.0 within 50 km, term 2012-01-01 to 2012-12-31, replayed against the 5 September 2012 Nicoya earthquake (USGS catalog).
- **Bids:** 4–5 test backer wallets with different rates; at least one request clears partially and one goes unfilled.
- **Resolution:** the resolver runs the three adapters, posts outcomes, the dispute window is minutes long, payouts execute.
- **Out of scope for v1:** real money, secondary market, templates beyond these three, decentralized oracle network.

**Walkthrough:** "Insurers say no to Palisades homes" → a homeowner posts a request → three strangers bid → it clears at the last accepted rate → the map shows a price for that street → replay January 2025 → the perimeter touches the homes inside it → they are paid in seconds, with evidence → "same market, different risk": a Tarrazú coffee farmer an insurer turned down lists storm protection, strangers bid, and the November 2024 storms trigger the payout → a shop in Nicoya replays the 2012 earthquake → "any asset, any risk you can measure, anyone can back."

## 11. Acceptance tests

Tests marked *(not yet implemented)* have no counterpart in `packages/core/test/core.test.ts` yet; every other test does, under the same number.

**Clearing**
1. Limit 100,000; bids (40,000 @ 300 bps), (50,000 @ 350), (30,000 @ 420), (20,000 @ 500) → accepted 40k, 50k, 10k of the third; filled 100,000; clearing 420 bps.
2. Same bids, limit 200,000, `minFill` 150,000 → filled 140,000 < 150,000 → `unfilled`, all refunded.
3. Two bids at the same rate → the earlier one is filled first.
4. Price for 100,000 at 420 bps over 365 days = 4,200 (in whole USDC; exact in units).
5. A bid above `maxRateBps` reverts; a bid after `auctionEnd` reverts; a request with an unknown template reverts; a `wildfire.perimeter` request whose term starts less than 14 days after `auctionEnd` reverts.

**Templates**
6. `wildfire.perimeter`: point inside the Palisades perimeter, radius 100 m → triggered; point 2 km outside → not triggered; point 50 m outside → triggered (buffer counts).
7. `wildfire.perimeter`: a fire that started before `termStart` does not trigger.
8. `rain.rolling_max`, Liberia (10.59, −85.54), 72 h, threshold 2,000 tenths, term covering October 2017 → triggered, observed 2,139 tenths (213.9 mm), window ending 2017-10-06T18:00Z. *(not yet implemented: needs the ERA5 fixture; the window rules are tested with synthetic data)*
9. `rain.rolling_max`, Tarrazú (9.66, −84.02), 72 h, threshold 4,000 tenths, term 2024-07-01 to 2025-06-30 → triggered, observed 4,624 tenths (462.4 mm) in November 2024. *(not yet implemented: needs the ERA5 fixture)*
10. `quake.magnitude_radius`, point (10.15, −85.45), magnitude ≥ 7.0, 50 km, term 2012 → triggered by the 5 September 2012 Nicoya earthquake (magnitude and epicentre read from the USGS catalog fixture). *(implemented with a synthetic event matching the catalog values; the catalog fixture is to add)*
11. `rain.rolling_max`: one missing hour invalidates every window that contains it; a term with no complete window → no outcome.

**Settlement and invariants**
12. During the dispute window nothing is paid; after it, the buyer receives exactly `filledLimit`.
13. Not triggered at `termEnd` → each backer receives their share back; the price, minus the fee, was already paid pro rata at clearing; sums match to the unit.
14. No outcome → nothing can be withdrawn.
15. Fuzz: across random bids and outcomes, escrow balance always equals what remains owed. *(not yet implemented)*
16. Two resolver runs on the same data produce the same `dataSha256` and outcome. *(not yet implemented)*
17. The validator rejects a brief containing a number not in the JSON. *(not yet implemented)*

## 12. Data and licensing

- WFIGS Interagency Fire Perimeters, NIFC Open Data (US government, public domain). Historical perimeters: CAL FIRE FRAP (public; check terms before commercial use).
- ERA5 via Open-Meteo, CC BY 4.0. The free API is non-commercial only; production needs a commercial plan or ERA5 from Copernicus. Credit "Open-Meteo" and "Copernicus Climate Change Service (ERA5)".
- USGS earthquake catalog (US government, public domain).
- No personal data: reference points are synthetic.

## 13. Security

- Escrows are non-custodial (Trustless Work on Stellar): users sign every transaction in their own wallet; Parasol holds no keys to user funds. The resolver key only routes a bid escrow to its buyer or its backer, never elsewhere, and every routing carries public evidence.
- The Trustless Work API key and the resolver key live on the server only.
- Server keys (LLM, RPC) on the server only.

## 14. Access controls (path to real money)

Disabled on the test network; required before real money (VISION §11).

- **Tiered identity:** `kycThreshold` per jurisdiction; requests or bids above it require a verified identity attestation for the wallet.
- **Geographic filter:** `allowedRegions` list; requests outside it are rejected and the UI hides those markets.
- **Real exposure:** each request carries the buyer's declaration of exposure type (`home`, `farm`, `business`); above `kycThreshold`, proof of address for the location is attested before clearing.
- **No native token:** only the configured stablecoin is accepted; the protocol has no token of its own.

## 15. Open decisions

1. Tiered payouts after v1 (v1 is binary, see D6).
2. Which decentralized resolution layer replaces the v1 resolver wallet, and bond sizes (see D11).
3. Who may run resolver adapters for third-party templates, and how they are paid.
4. Which jurisdiction gets the first legal opinion and sandbox (see D18).
