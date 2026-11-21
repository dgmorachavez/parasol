# Parasol by Avantus — Product Requirements (PRD)

**Version:** 0.1 draft (21 Nov 2026) · **Status:** sections 1–5 for founder review; sections 6–12 and the work breakdown follow once goals, metrics and the first template are confirmed.
**Sources of truth:** `VISION.md` (scope and market), `SPEC.md` (implementation), `docs/DECISIONS.md` (D1–D20, D24). This PRD does not override them; where it adds something they do not say, it is marked **Assumption** with how we will test it.
**Vocabulary:** protection, price, backer, buyer, trigger, payout.

---

## 1. Summary

| | |
|---|---|
| **Problem** | Insurers are walking away from high-risk homes: Allstate and State Farm stopped writing new homeowner cover in California in 2022–2023, and the state's last-resort FAIR Plan covers more than 555,000 homes, over four times its book five years earlier (Arbol, Feb 2026, cited in VISION §2). In Costa Rica only 705 agricultural contracts were issued in 2025 (Diario Extra, VISION §2). People turned away have nowhere to go and no price for their risk; capital willing to take that risk cannot reach them. |
| **Who it is for** | **Buyers:** people exposed to a measurable risk (a home in a fire zone, a coffee farm in storm season, a shop in a seismic zone) who could not get protection elsewhere (D24: buyers protect only what they are exposed to). **Backers:** anyone with capital who wants to back a specific risk at their own rate (D24: open to anyone). |
| **What we ship** | A test-network web app where a buyer lists a protection on one of three trigger templates (D20), backers bid in a uniform-price reverse auction (D4), every bid is fully collateralised in its own Trustless Work escrow on Stellar in test USDC (D5, D8, D19), and a resolver posts the outcome from public data with evidence, waits 72 h for disputes, then routes each escrow (D11). Clearing is a published function anyone can recompute (D10). |
| **Why now** | Non-custodial escrow is available as an API without writing our own contracts (Trustless Work, D8); USDC is native on Stellar with sub-cent fees; the public datasets for the three templates exist (WFIGS, ERA5, USGS; D13). **Assumption A0:** people turned away by insurers will accept a parametric payout to get protection at all (VISION §8.2). Test: 10 buyer interviews and a waitlist on the landing page (count: _placeholder_). |

## 2. Goals and non-goals

**Goals**

| # | Goal | Source |
|---|---|---|
| G1 | A buyer goes from first visit to a filled, funded protection on the test network, on any of the three templates. | VISION §3, SPEC §5–7 |
| G2 | A backer goes from first bid to collateral plus price returned, or payout routed, and can verify every amount. | SPEC §6–7, D19 |
| G3 | Every clearing and every outcome can be recomputed by anyone from published inputs and evidence hashes. | D10, SPEC §1 invariants 5–6 |
| G4 | The three reference scenarios (Palisades wildfire, Tarrazú rainfall, Nicoya earthquake) run end to end on testnet. | SPEC §10, D20 |
| G5 | Before any signature, every screen shows the data source, escrow state, basis risk and exposure status. | VISION §7, D24 |

**Non-goals (v1)**

Real money or mainnet (D18) · native token (D18) · templates beyond the three (D20) · third-party template publishing (D20) · secondary market (D4) · tiered or partial payouts (D6) · decentralised resolution layer (D11) · our own Soroban contracts (D8, D10) · embedded wallets (D16) · L1 identity and exposure verification in code (designed in SPEC §14, built before real money) · mobile apps · pricing advice to backers · indemnity products (D2).

## 3. Success metrics

No baselines exist yet. Every target below is a placeholder until we have data, except guardrails, which are absolute.

| Type | Metric | Definition | How measured | Target |
|---|---|---|---|---|
| **North star** | Settled protections | Protections that cleared, had all accepted escrows funded on testnet and settled (payout or collateral return) with a posted outcome and evidence hash | Count of protections in `triggered` or `expired` with `outcome.dataSha256` set and every escrow closed | Hackathon: ≥ 1 per template (G4). After: _placeholder_ |
| Input | Fill ratio | `filledLimit ÷ limit` per auction | `clear()` output | _placeholder_ (sample after 20 auctions) |
| Input | Bid coverage | Total bid capacity at `auctionEnd ÷ limit` | Bid book at close | _placeholder_ |
| Input | Time to protected | Request created → all accepted escrows funded | Event timestamps | _placeholder_ |
| Input | First-run completion | Wallet connected → request submitted | Funnel events, wallet address only, no personal data | _placeholder_ (5 moderated sessions) |
| Input | Backer repeat rate | Backers who bid again after their first settlement | Wallet address cohort | _placeholder_ |
| Guardrail | Settlement mismatches | On-chain escrow movements ≠ `settleShare` / `distributePrice` result | Reconciliation job | **0** |
| Guardrail | Payouts without evidence | Escrow routed to a buyer with no posted outcome and hash | Reconciliation job | **0** |
| Guardrail | Moves on missing data | Escrow routed while the outcome is absent or insufficient | Reconciliation job | **0** |
| Guardrail | Recompute mismatches | Public recompute of `clear()` ≠ published result | CI and a public script | **0** |
| Guardrail | Custody | User funds held by any Parasol-controlled address, except the protocol fee | Address audit | **0** |
| Guardrail | Over-limit requests | Active request with `limit > declaredValue` | Request book query | **0** (D24) |

## 4. Personas and jobs to be done

All personas are **assumptions**; no users have been interviewed yet.

| Persona | Situation (assumed) | Job to be done | How we test it |
|---|---|---|---|
| **Buyer** | Owns a home, farm or business exposed to wildfire, extreme rain or earthquakes; turned away or priced out by insurers | "When a known risk threatens my asset, I want money in my wallet soon after it happens, without proving a loss." | 10 interviews; does a stated basis-risk example still lead to a yes? |
| **Backer** | Holds USDC, wants yield on a risk they can understand; comfortable with a wallet | "When I see a risk I understand, I want to back it at my own rate and know my worst case exactly." | 8 interviews with crypto-native users; a mock bid test |
| **Resolver / operator** | Parasol team member running the resolver service | "When a term ends or a trigger fires, I want to post an outcome anyone can verify and route escrows without judgement calls." | Dry run on the three reference scenarios |

## 5. User journeys

Screens follow SPEC §9 (Map, Request, Request detail / bid, Protection, Templates). Routes are **assumptions** until the web app exists. Escrow states use the `EscrowPort` names in `packages/core/src/escrow.ts` (`created`, `funded`, `released_to_backer`, `paid_to_buyer`); Trustless Work's own state names are confirmed in the escrow spike (§10).

### 5.1 Buyer: first visit → first protection

| # | Screen | System action | Escrow state |
|---|---|---|---|
| 1 | Map `/` | Shows open requests and cleared protections coloured by clearing rate; "Parasol is not an insurer…" | — |
| 2 | Connect wallet | Freighter connects; checks test network and USDC trustline; guides the buyer if either is missing (D16) | — |
| 3 | Request `/request/new` · template | Buyer picks one of the three templates; shows its question, data source and basis-risk note (SPEC §4, §9) | — |
| 4 | Request · location and terms | Buyer clicks the location, sets threshold, limit, term, max rate; for wildfire, the term must start ≥ 14 days after the auction ends (D7) | — |
| 5 | Request · exposure | Buyer declares what is exposed and its value, ticks "I am exposed to this asset"; `limit ≤ declaredValue` and the per-wallet cap within 100 m are enforced (D24, SPEC §5) | — |
| 6 | Request · review and sign | Request created; buyer deposits `limit × maxRateBps × termFraction` (SPEC §5). **Open:** where the deposit sits (Q1) | buyer deposit locked (Q1) |
| 7 | Request detail `/requests/:id` | Bid book, countdown, "Exposure declared, not verified" badge; buyer may cancel only before the first bid (SPEC §5) | backer escrows `funded` |
| 8 | Request detail · cleared | Anyone presses "Clear" after `auctionEnd`; `clear()` runs and its inputs and result are published; price paid to backers minus the 5 % fee; excess deposit back to buyer; or `unfilled` and everything refunded (SPEC §6–7) | accepted: `funded`; unused capacity returned |
| 9 | Protection `/protections/:id` | Status, filled limit, clearing rate, shares, escrow links, data source | `funded` |
| 10 | Protection · outcome | See 5.3 | `paid_to_buyer` or `released_to_backer` |

### 5.2 Backer: first bid → first return

| # | Screen | System action | Escrow state |
|---|---|---|---|
| 1 | Connect wallet | As 5.1 step 2 | — |
| 2 | Map `/` | Filters open requests by template; shows time left and best rate | — |
| 3 | Request detail `/requests/:id` | Risk brief (AI, validated; D17, SPEC §8), basis risk, exposure badge, active protection within 100 m (D24) | — |
| 4 | Request detail · bid | Backer sets capacity and annual rate; `validateBid` checks rate ≤ max and time ≤ `auctionEnd`; backer signs creation and funding of one escrow for the full capacity (D5, D19) | `created` → `funded` |
| 5 | Request detail · withdraw (optional) | Before `auctionEnd`, the backer withdraws and the escrow goes back to them (SPEC §5) | `released_to_backer` |
| 6 | Protection `/protections/:id` · cleared | Accepted: escrow holds the backer's share; price share arrives in the wallet. Partially filled: unused part returned. Not accepted: escrow released (SPEC §6–7) | `funded` / `released_to_backer` |
| 7 | Protection · term ends, no trigger | After the 72 h dispute window, collateral returns to the backer (SPEC §7) | `released_to_backer` |

### 5.3 Resolver: trigger → payout

| # | Screen | System action | Escrow state |
|---|---|---|---|
| 1 | Ops queue `/ops` (**Assumption:** not in SPEC §9) | Lists protections at term end or with a candidate trigger | `funded` |
| 2 | — | Adapter fetches the source (WFIGS, ERA5 or USGS) and stores source, version, retrieval time and SHA-256 (SPEC §1, §12) | `funded` |
| 3 | Ops · outcome | Evaluator runs (`evaluateWildfire`, `evaluateRainRollingMax`, `evaluateQuake`) and produces an `Outcome` with evidence | `funded` |
| 4 | Ops · post | Resolver posts the outcome and evidence hash; the 72 h dispute window opens (minutes on testnet; SPEC §7) | `funded` |
| 5 | Protection · dispute | Anyone challenges with counter-evidence, including evidence that the buyer set the fire (D7). **Open:** who decides (Q2) | `funded` |
| 6 | — | After the window: `settleShare` per escrow → full share to the buyer if triggered, back to the backer if not and the term has ended | `paid_to_buyer` / `released_to_backer` |
| 7 | — | No complete data → no outcome; nothing moves; retry and alert (fail closed, SPEC §1 invariant 4) | `funded` |

---

## Open questions blocking sections 6–12

| # | Question | Recommendation | Who decides |
|---|---|---|---|
| Q1 | Where does the buyer's deposit sit? SPEC §5 collects it but §2 assigns it no escrow; without one, Parasol would hold funds (contradicts D1). | Its own Trustless Work escrow, resolved at clearing with a split (proposed D21) | Founders |
| Q2 | Who resolves disputes? Trustless Work V2 docs say the dispute resolver cannot share an address with any other role, so the SPEC §2 mapping must change. | A separate arbiter key, held by a person on testnet (proposed D22) | Founders |
| Q3 | Trustless Work charges 0.30 % on each release; SPEC test 13 expects sums to match to the unit. | The receiving party bears it, shown before signing (proposed D23) | Founders |
| Q4 | Confirm G1–G5, the north star and guardrails. | As written | Founders |
| Q5 | Which template leads the demo? | Wildfire (Palisades) first, as in the brief; rainfall and earthquake follow in the same walkthrough (SPEC §10) | Founders |
| Q6 | Hackathon scope: delivery closes Sun 22 Nov 23:59 (UTC−6). | Ship M1 (walking skeleton on wildfire) and as much of the three scenarios as fits; the rest becomes the roadmap | Founders |
