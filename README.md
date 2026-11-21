# Parasol by Avantus

**Parasol is not an insurer. It is an open risk market. No policies, no adjusters: just public data and code.**

Anyone exposed to a measurable risk lists it on Parasol; anyone with capital bids to back it; the cheapest bids win and set the price of the risk. Parasol launches with three risks: wildfire (a home in a fire zone), extreme rainfall (a coffee farm in storm season) and earthquakes (a shop in a seismic zone). Every new risk type is one more template on the same market. Every protection is fully funded on chain and pays automatically when public data shows the event happened.

- Vision: [VISION.md](VISION.md)
- Specification: [SPEC.md](SPEC.md)
- Decisions and their reasons: [docs/DECISIONS.md](docs/DECISIONS.md)
- Core engine: `packages/core` (`npm install && npm test`)

**Status:** the core engine (uniform-price auction, trigger templates, settlement rules and the escrow port) is built and tested in `packages/core`. The web app, the Trustless Work escrow adapter and the resolver are next. Parasol will run on a test network with test money until a legal opinion and a regulatory sandbox are in place in each jurisdiction (see VISION §11).
