# Parasol by Avantus — Product Vision

**Version:** 5.1 (21 Nov 2026) · **Team:** Avantus Digital · **Scope:** any parametric risk; three at launch (wildfire, extreme rainfall, earthquake) · **First markets:** homes, farms and businesses exposed to those three risks

## 1. Vision

A decentralized protocol where anyone can back anyone's risk, and the bids, not an insurer, set its price. Any risk whose outcome can be read from public data can be listed on Parasol and gets the same behaviour: open bids, a market price, automatic payout. Parasol launches with three: wildfire, extreme rainfall and earthquakes.

> **Parasol is not an insurer. It is an open risk market. No policies, no adjusters: just public data and code.**

Parasol does not issue policies, carry risk or hold anyone's money. It is open infrastructure: parametric contracts, an auction and an oracle, with no insurer in the middle. In v1, clearing runs as a published function anyone can recompute, and a resolver key can only route each escrow to its own buyer or backer; a decentralized resolution layer replaces that key next (see §10).

**Tagline:** let the bids price the risk.

### What Parasol delivers

| Need | Parasol |
|---|---|
| A prediction-market mechanism for protection | Each protection is a market that resolves on an objective fact (did the official fire perimeter touch this home?), like a Polymarket market |
| Anyone can offer protection to anyone | Anyone with a wallet bids a slice of capital and a rate to back a specific home |
| Cover for people insurers turned away | Built for people who were denied cover, from Pacific Palisades homes to Costa Rican coffee farms |
| An open platform, not another insurer | Open, on-chain uniform-price auction per protection, for any risk with a public trigger; no insurer in the middle |
| A real price for risk | The clearing rate is the price of the risk, published on a public map and readable as a probability |

## 2. Problem

- Insurers are walking away from high-risk homes. Allstate and State Farm stopped writing new homeowner policies in California in 2022 and 2023. The state's last-resort FAIR Plan covers more than 555,000 homes, over four times its book five years earlier (Arbol, Feb 2026).
- The January 2025 Palisades and Eaton fires caused about $40B in insured losses (same source).
- The same gap exists far beyond fire: in Costa Rica only 705 agricultural policies were issued in 2025, covering about 8,000 ha (Diario Extra), so most farmers face storms and drought with no cover at all.
- For anyone who has been **denied cover**, there is nowhere left to go, and no price at all for their risk.
- Meanwhile, capital that would happily take that risk at the right price (individuals, funds, crypto-native yield seekers) has no way to reach those homeowners directly.

## 3. Product

Someone exposed to a risk posts a **protection request** built on a **trigger template**; anyone bids to **back** it; a smart contract holds the money and pays automatically when public data shows the event happened.

**The flow in one line:** an insurer said no → the person comes to Parasol → lists their risk → third parties bid to back it.

0. **Templates.** A template is a reusable parametric question with its data source, for example "did an official fire perimeter touch this point?" or "did 72 h rainfall here reach X mm?". Parasol launches with exactly three templates: wildfire perimeter, extreme rainfall and earthquake magnitude (D20). More risk types are added as new templates once these three have real bids; later, anyone can publish one.

1. **Request.** The buyer picks a template and sets the location, the threshold, the amount of protection (limit), the term (e.g. 12 months) and the highest price they accept.
2. **Bids.** Any backer offers a slice of the limit at a yearly rate (e.g. "$50,000 at 3.5% a year"). Every bid locks its full slice of capital in the contract, so every protection is fully funded before it starts.
3. **Clearing.** When the auction closes, the cheapest bids fill the limit. Everyone accepted gets the same rate: the rate of the last bid needed to fill the limit (uniform-price auction).
4. **The price of the risk.** The clearing rate is published on a public map. For a full payout, a rate of 4% means the market prices the chance of that event this year at no more than about 4%, the same way a Polymarket price reads as a probability.
5. **Settlement.** The contract pays the full limit if the template's public data shows the event during the term (e.g. the official fire perimeter touches the property). No adjuster, no claim form, no one to approve it. If not, at expiry the backers get their capital back; they already received the price when the auction cleared.

**Trust promise:** the rule, the data source and the evidence of every payout are public and on chain. Same data + same rule = same result. No key can send funds anywhere except to the protection's own buyer or backer.

### Three risks at launch

| Who | Asset at risk | Trigger | Public data |
|---|---|---|---|
| Homeowner, California | House in a fire zone | Official wildfire perimeter touches the property | NIFC / WFIGS perimeters |
| Coffee farmer, Tarrazú | Harvest | 72 h rainfall above a set amount | ERA5 rainfall |
| Shop or building owner, Nicoya | Premises in a seismic zone | Earthquake of magnitude ≥ M within R km | USGS earthquake catalog |

Each row is the same product: list the risk, strangers bid, the cheapest bids win, public data decides the payout. Adding a risk means adding a template, not building a new product. Candidates for the next templates, in no fixed order: drought, hurricane wind, river level, heat waves, air quality, flight delays and rainy-season days.

## 4. Why our angle is the right one

- **A market needs a question with an objective answer.** Polymarket works because every market resolves on a fact nobody can argue with. Traditional insurance cannot be opened to everyone because every claim needs an adjuster. A parametric contract (pay if the official perimeter touches the home, or if rainfall passes a threshold) resolves like a Polymarket market, so anyone can price it. That is why Parasol is not a fire product: it is a market for every risk that can be measured.
- **A new kind of product.** Parasol pays on a measured public event, not on a proven loss: no policy, no claim, no adjuster, no indemnity. There are no brokers either: buyers and backers meet directly in the protocol. How that is classified in each jurisdiction is settled through the path in §11.
- **The real Palisades problem is that the price can't move.** Practitioners also point out that homeowners can't get cover not because nobody will price the risk, but because California's prior-approval rules (Proposition 103) can make a carrier wait a year or more for a rate increase. That is our point: on Parasol the price is set by bids, freely, per risk.
- **Bids are backed by money, not opinions.** A common objection is that people can "offer" insurance but can't pay claims, and that bids "must be backed by the ability to pay claims". Every Parasol bid locks its full capital before cover starts.
- **Decentralized by design.** Full collateral in escrow, public evidence with open disputes, and a resolver that can only route funds to the buyer or back to the backer mean nobody has to trust the backer, and Parasol's role shrinks to zero as resolution moves to a decentralized layer.
- **The price is the product.** Each cleared auction publishes a local price of risk (fire on this street, floods in this valley) that today does not exist. That signal is useful to lenders, buyers, cities and reinsurers, even for homes that never buy protection.
- **Team background:** we have built parametric triggers from public climate data and back-tested them against documented events; the same discipline applies here.

## 5. Users

| User | Situation | What Parasol gives |
|---|---|---|
| Anyone denied cover | A homeowner dropped in a fire zone; a Costa Rican coffee farmer no insurer will cover for storms | Protection in minutes, paid automatically, at a price set by open competition |
| Template authors (after launch) | Know a risk and a public data source for it | Publish a template; earn when it is used (to be defined) |
| Backer (anyone with capital) | Wants yield on risk they can understand | Direct access to individual risks, with public data on each one |
| Lenders, buyers, cities | Need to know what a local risk costs | Public map of clearing rates |

## 6. Business model (hypothesis)

Protocol fee on each cleared price (e.g. 5%), paid out of the backers' earnings. Later: data access to the price map for lenders and reinsurers.

## 7. Principles

- **Fully funded:** no protection starts without the money to pay it locked in the contract.
- **Objective trigger:** pay on public data with a stated source and version, never on discretion.
- **Basis risk stated up front:** the contract pays on the measured event, not on the actual loss (e.g. it pays when the perimeter touches the property, whether or not the home burns; a 25 km rainfall grid can miss a local storm). Each template states its own basis risk; buyers see it before they pay.
- **Fail closed:** if the official data is unavailable, the contract waits; it never pays or refuses on missing data.
- **AI informs, never decides:** AI drafts a risk brief for backers from the data; every number it writes is checked against the data. The trigger and the payout are code.

## 8. What must be true

1. Enough independent backers bid that clearing rates are competitive.
2. People who were denied cover accept a parametric payout in exchange for getting protection at all.
3. The three launch templates attract buyers and backers, and new templates can be added with reliable public data once they do.
4. Official data (perimeters, rainfall) is published fast and reliably enough to settle within days.
5. The dispute process is cheap enough that wrong outcomes get challenged.

## 9. Competition

- **Arbol:** sells parametric covers (wildfire, weather), but Arbol sets the price.
- **Parametrix:** on-chain parametric cover funded by a pooled vault at a fixed price; no bidding.
- **cat-risk.com (Yokahu):** parametric exchange in London, open to licensed carriers only.
- **California FAIR Plan:** last-resort cover at a state-set price.
- **Kalshi / Polymarket:** binary markets on public events chosen by the exchange. Parasol markets are created by the person exposed, for their own location and threshold, and every position is a fully funded protection.
- **Early entrants (to research):** Verdict Finance ("Polymarket-style coverage"), GenLayer (AI validators deciding outcomes), Qualiq (fractional positions on any asset), Stand Insurance (Palisades homeowner cover).

None of the established players lets anyone bid on an individual risk and publishes the resulting price.

## 10. Roadmap

1. **Reference scenarios:** Palisades fire, Costa Rica storm and Nicoya earthquake replays on a test network (see `SPEC.md` §10).
2. **Pilot:** one area per template, real data, test money, real backers bidding.
3. **Mainnet launch.**
4. **Decentralized resolution:** outcomes and disputes move from the v1 resolver key to a decentralized resolution layer with bonded challenges.
5. **More templates:** new risk types one at a time (drought, wind, river level, heat, air quality), then templates published by others.
6. **Secondary market:** backers trade their positions before expiry.

## 11. Path to real money

Parasol runs on a test network with test money until each step below is in place in a jurisdiction:

1. **Legal opinion** from fintech and digital-asset counsel on how Parasol's contracts are classified there.
2. **Regulatory sandbox launch** where one is available, with limits agreed with the regulator.
3. **Tiered identity checks:** small protections need only a wallet; identity verification applies above set amounts, for buyers and backers.
4. **Geographic filter:** the app only opens markets where the structure has been cleared.
5. **No native token:** protections are priced, funded and paid in a regulated stablecoin (USDC), never in a Parasol token.
6. **Real exposure:** a buyer can only protect a location they are actually exposed to (a home, a farm, a business), declared at request time and verified above the identity threshold.

## 12. Team and advisors

- **Avantus Digital:** product and engineering.
- **Parametric risk advisor (to recruit):** an actuary, reinsurance or climate-modelling professional to review templates, thresholds and basis risk.
- **Legal advisor (to recruit):** fintech and digital-asset counsel to lead the path in §11.

## 13. Risks

- **Thin markets:** few bidders → expensive or unfilled requests. Mitigation: start where demand is acute, seed with professional capital.
- **Correlated losses:** one fire or storm triggers many contracts at once; full collateral means backers can lose their whole slice.
- **Oracle risk:** wrong or late data, or a badly written template. Mitigation: published source, open bonded disputes.
- **Adverse selection:** homeowners know their property better than bidders. Mitigation: public data on every request.
- **Legal:** classification differs by jurisdiction; addressed by the path in §11.
