# SanskritAgain Shipping Desk — Phase 1, slice 1 (core engine)

DEMO mode only. No ClickPost dependency. No carrier is contacted; live adapters are inert until contracts are verified.

## Run
    npm install
    npm test            # 39 tests
    npm run typecheck
    npm run demo        # synthetic orders → allocation trace → simulated booking

## Built in this slice (tested)
- Allocation engine: ordered policies, eligibility with explained exclusions, scoped/expiring blacklist, missing/expired quote handling, Express/unknown intent → review, rerun diff
- Seed rules: Prepaid Forward BD Surface > ATS > Delhivery > BD Air (ACTIVE); COD ATS/Delhivery/BD Surface COD (DRAFT_UNVERIFIED); no Express policy
- Packing: 7 box types + unchanged legacy 20x10x10; 26 owner reference rows INACTIVE/UNCONFIRMED; exact-variant bundle rule matcher
- Billable weight per service contract (unknown divisor/slab → unknown, never guessed or clamped)
- Approval hashing, stale-change invalidation, packer denial, exact batch scope
- Booking ledger: double-click safety, timeout = UNKNOWN, reconcile-before-retry, manual reconciliation when no lookup
- Tracking merge (dedupe, time-ordered, corrective scans flagged, terminal polling stop); closedRTO/median/p90 cohorts
- Prisma schema for all 39 entities (validated offline with Prisma 6 engine; not migrated against a live DB here)

## Not built yet (see docs/parity-register.csv)
Next.js UI, auth, Postgres ledger + pg-boss worker, Shopify sync/webhooks, label/manifest/NDR/returns screens, exports, real carrier adapters.
