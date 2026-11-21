# Decision log

Every product and technical decision in Parasol, with why we made it, what we rejected and what we give up. Anyone on the team should be able to defend each one in a sentence. New decisions are appended; a reversed decision is marked **Superseded** and links to the one that replaces it.

Format: **Decision** · **Why** · **Alternatives rejected** · **Trade-off we accept** · **Revisit when**.

---

## Product

### D1. Parasol is an open risk market, not an insurer
- **Decision:** Parasol issues no policies, carries no risk and holds no funds. It is infrastructure where buyers and backers meet.
- **Why:** the people we serve were already turned away by insurers; a market lets anyone with capital price their risk. Not holding risk or money keeps the company light and the trust model simple.
- **Alternatives rejected:** becoming an MGA or insurer (capital requirements, licences per jurisdiction, years to launch); selling software to insurers (our earlier direction: slow sales, and it does not help people insurers reject).
- **Trade-off:** we depend on enough backers bidding; classification differs by jurisdiction (see D18).
- **Revisit when:** a regulator or counsel requires a licensed partner in a target market.

### D2. Parametric triggers only
- **Decision:** a protection pays when public data shows the event, never on a proven loss.
- **Why:** an objective trigger is what lets strangers price a risk (like a prediction-market question); it removes claims, adjusters and most fraud; payouts take minutes.
- **Alternatives rejected:** indemnity cover (needs adjusters and loss proof; cannot be opened to anonymous backers).
- **Trade-off:** basis risk: the trigger can fire without a loss, or a loss can happen without a trigger. Each template states its basis risk before purchase.
- **Revisit when:** never for the core; hybrid products could be added by licensed partners.

### D3. Trigger templates: any asset, any measurable risk
- **Decision:** each risk type is a versioned template (question + public data source + evaluator). New risks are new templates, not new products.
- **Why:** one engine serves homes, farms, businesses and travellers; the market decides which templates get bids.
- **Alternatives rejected:** a single-peril product (fire only, or crops only): smaller market, no network effect.
- **Trade-off:** every template needs reliable public data and its own tests.
- **Revisit when:** a template's data source proves unreliable. Scope of the launch set: D20.

### D4. Uniform-price reverse auction
- **Decision:** cheapest bids fill the limit; every accepted backer earns the rate of the last bid needed.
- **Why:** uniform pricing rewards bidding your true rate (no need to guess others' bids), and gives one public number: the price of that risk.
- **Alternatives rejected:** pay-as-bid (encourages strategic bidding, no single price); a continuous order book like Polymarket (needs liquidity and market makers we do not have yet); a fixed-price pooled vault (no price discovery).
- **Trade-off:** requests need an auction window, so protection is not instant.
- **Revisit when:** volume supports a secondary market (roadmap).

### D5. Full collateral
- **Decision:** a bid only counts if its full capacity is locked when it is placed (how: D19).
- **Why:** the buyer never depends on a backer's promise; answers the objection "people can offer cover but can't pay claims".
- **Alternatives rejected:** fractional reserves or leverage (insolvency risk, regulatory exposure).
- **Trade-off:** capital-intensive for backers, so prices are higher than a diversified insurer's.
- **Revisit when:** a regulated capital partner can back portfolios.

### D6. Binary payout in v1
- **Decision:** a triggered protection pays its full filled limit.
- **Why:** simplest to explain, price and verify; maps to a yes/no question.
- **Alternatives rejected:** tiered or linear payouts between a trigger and an exit value: better fit to losses, harder to explain at launch.
- **Trade-off:** more basis risk at the edges of a threshold.
- **Revisit when:** buyers ask for partial payouts (SPEC open decision 1).

### D7. Anti-manipulation rules per template
- **Decision:** wildfire requires ≥ 100 acres, ignition ≥ 2 km from the point, and a 14-day wait; any outcome can be disputed with evidence of arson by the buyer.
- **Why:** since we pay on public data, not loss, burning your own house earns nothing; the rules close the remaining path (starting a wildfire nearby).
- **Trade-off:** a genuine fire that starts very close to a home does not trigger.
- **Revisit when:** a risk advisor reviews thresholds per template.

---

## Money and settlement

### D8. Escrow on Trustless Work (Stellar, USDC)
- **Decision:** collateral sits in Trustless Work escrows on Stellar, in USDC.
- **Why:** non-custodial (users sign in their own wallet; Parasol never holds funds), no smart contracts of our own to write and audit, Stellar fees are fractions of a cent with finality in seconds, USDC is issued natively on Stellar, and Trustless Work ships React hooks. Chosen by the founders on 20 Nov 2026.
- **Alternatives rejected:** our own Solidity contracts on Base (more work and audit risk); a custodial account (contradicts D1).
- **Trade-off:** we depend on Trustless Work's roles and API; to confirm on testnet: contract addresses as roles, and the split format when resolving.
- **Revisit when:** we need an on-chain auction or pooled positions that Trustless Work cannot model.

### D9. One escrow per backer share; price paid at clearing
- **Status:** partly superseded by D19 (escrows are funded when bidding, not at clearing). The price-at-clearing part stands.
- **Decision:** each accepted backer funds one escrow holding only their share of the limit; the buyer's price is paid to backers (minus the fee) when the auction clears.
- **Why:** Trustless Work does not track several depositors with pro-rata refunds; one escrow per share keeps every payout exact and simple.
- **Alternatives rejected:** one pooled escrow per protection (needs per-depositor accounting it lacks); paying the price at expiry (more escrow states, nothing gained).
- **Trade-off:** more escrows per protection (one per backer).
- **Revisit when:** Trustless Work supports multi-depositor accounting.

### D10. Auction runs in our backend, deterministically
- **Decision:** clearing is a pure TypeScript function; inputs and result are published so anyone can recompute it.
- **Why:** Trustless Work has no auction; a pure function is fast to build, test and audit.
- **Alternatives rejected:** an on-chain auction contract (Soroban development and audit time).
- **Trade-off:** users trust our server to run it, mitigated by publishing inputs and result.
- **Revisit when:** volume or trust needs justify moving clearing on chain.

### D11. Resolver wallet, public evidence, 72 h dispute window, fail closed
- **Decision:** a Parasol resolver evaluates each template, posts the outcome with its evidence hash, waits 72 h for disputes, then routes each escrow to the buyer or back to the backer. Without data, nothing moves.
- **Why:** fast to ship on Trustless Work's resolver role; evidence makes every decision checkable; fail closed means no payout or refusal on missing data.
- **Alternatives rejected:** a decentralized oracle network in v1 (time and cost); manual review (slow, not objective).
- **Trade-off:** the resolver is a trusted key; it can only route an escrow to its own buyer or backer.
- **Revisit when:** moving to a decentralized resolution layer (roadmap).

### D12. Protocol fee: 5% of the price, at clearing
- **Decision:** `feeBps` = 500 by default, sent to the platform address when the auction clears.
- **Why:** aligns revenue with the price of risk, not with payouts; simple to explain.
- **Trade-off:** placeholder until unit economics are modelled.
- **Revisit when:** the business model is validated.

---

## Data

### D13. Data sources per template
- **Decision:** wildfire: WFIGS Interagency Fire Perimeters (NIFC); rainfall: ERA5 via Open-Meteo; earthquakes: USGS catalog. Every outcome stores source, version, retrieval time and hash.
- **Why:** official or reference datasets, public, global or national coverage, history for pricing.
- **Trade-off:** Open-Meteo's free tier is non-commercial; production needs its paid plan or ERA5 from Copernicus. ERA5's 25 km grid can miss local storms.
- **Revisit when:** a template shows basis risk in back-tests, or we go to production.

---

## Engineering

### D14. TypeScript core of pure functions, tested from the SPEC
- **Decision:** auction, templates and settlement live in `packages/core` as pure functions; the SPEC's acceptance tests are code.
- **Why:** same data + same rule = same result; one language across server and app; tests prove the rules.
- **Alternatives rejected:** business logic inside the escrow or on-chain contracts (slower to change and test); untested prose rules.
- **Trade-off:** the core must be kept in step with the SPEC; acceptance tests not yet written are marked in SPEC §11.
- **Revisit when:** clearing or settlement moves on chain (D10).

### D15. Integer arithmetic
- **Decision:** money in USDC base units (bigint), rates in basis points, measurements as integers (e.g. tenths of a mm).
- **Why:** no floating-point rounding in money or thresholds; matches on-chain amounts.
- **Alternatives rejected:** floating-point or decimal libraries (rounding drift, mismatch with on-chain units).
- **Trade-off:** values must be converted for display.
- **Revisit when:** never for money; a template may need a finer unit.

### D16. Web app: Next.js, MapLibre, Freighter
- **Decision:** Next.js (React) for the app, MapLibre for maps, Freighter as the Stellar wallet.
- **Why:** Next.js gives a fast, polished web experience and shares TypeScript with the core; MapLibre is open with no licence fees; Freighter is the standard Stellar wallet recommended by Trustless Work.
- **Trade-off:** buyers new to crypto must install a wallet; to reduce later with embedded wallets.
- **Revisit when:** onboarding tests show drop-off at the wallet step.

### D17. AI only writes the risk brief, and is validated
- **Decision:** an LLM drafts a short risk brief for backers from a JSON of public facts; every number must exist in that JSON or a template text is shown.
- **Why:** helps backers price unfamiliar risks without letting AI touch clearing or payouts.
- **Trade-off:** brief quality depends on the facts we compute.
- **Alternatives rejected:** AI pricing or AI-decided outcomes (not verifiable, contradicts D2); no brief at all (backers left alone with raw data).
- **Revisit when:** backers say the brief does not help them price.

---

## Compliance

### D18. Test network until a legal path is in place
- **Decision:** test money only until each jurisdiction has a legal opinion and, where available, a regulatory sandbox; then tiered identity checks above set amounts, a geographic filter, no native token, and buyers limited to locations they are really exposed to.
- **Why:** shows a mature, credible route to real money without slowing product work.
- **Trade-off:** no real volume until the first jurisdiction is cleared.
- **Revisit when:** counsel delivers the first opinion.

---

## Money and settlement (continued)

### D19. Each bid funds its own escrow when it is placed
- **Decision:** a backer funds one Trustless Work escrow with the bid's full capacity at the moment of bidding. At clearing, escrows of bids not accepted are released to their backers, the unused part of a partially filled bid goes back to its backer, and each accepted escrow holds that backer's share of the limit until settlement. Supersedes the funding-at-clearing part of D9.
- **Why:** D5 promises that every bid is real money, not a promise; funding at clearing would leave bids unfunded during the auction and let a backer walk away after winning. Locking at bid time keeps "fully funded" true at every moment.
- **Alternatives rejected:** funding only at clearing (bids are promises until then; a winner who does not fund leaves the protection short); a pooled escrow per request (Trustless Work lacks per-depositor accounting, D9).
- **Trade-off:** backers' capital is locked during the auction even if their bid loses, and returning the unused part of a partial fill needs a split resolution (to confirm on testnet).
- **Revisit when:** Trustless Work supports partial releases or multi-depositor escrows, or auctions get long enough that locked losing bids hurt participation.

---

## Product (continued)

### D20. Launch with exactly three templates
- **Decision:** v1 ships three trigger templates and no others: `wildfire.perimeter` (WFIGS/NIFC), `rain.rolling_max` (ERA5 via Open-Meteo) and `quake.magnitude_radius` (USGS). The registry rejects any other id. Third-party publishing waits until after v1.
- **Why:** each template needs a reliable data source, an adapter, real fixtures, anti-manipulation rules and its own tests; designing many at once spreads the work thin and delays all of them. These three cover three different kinds of trigger (a shape, a time series and a discrete event), already have their evaluators and tests in `packages/core`, and map to the three reference scenarios. Together they prove the claim that matters: one market, any measurable risk.
- **Alternatives rejected:** a catalogue of ten or more templates at launch (most would be untested designs); a single template (would not prove the engine is general).
- **Trade-off:** some buyers (drought, hurricanes, heat, flights) have to wait; the vision still describes them as the expansion path.
- **Revisit when:** the three templates have real bids, or a buyer segment with a reliable public data source asks for a fourth.
