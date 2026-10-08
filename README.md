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

## Web demo (apps/web)
Next.js App Router, DEMO mode, synthetic orders. Requires two server env vars (never commit them):
`SESSION_SECRET` (32+ random chars) and `DEMO_LOGIN_PASSWORD`. Without them, login stays switched off.

    npm install
    SESSION_SECRET=... DEMO_LOGIN_PASSWORD=... npm run dev

Demo state is in memory and resets when the server restarts. Postgres ledger + worker come next.

## Iteration 2 (ClickPost-style ops workspace, DEMO)
New: sidebar shell, Dispatch stage tabs/filters/bulk/export, order detail tabs, Tracking, NDR desk, Manifest/handover,
Rules cards + simulation, Reports (imported vs synthetic), Settings (config presence only). Core: 560064 BD-Surface-only
rule (both payments), Express NEEDS_POLICY_REVIEW gate, CSV importer + reconciliation, Shopify webhook HMAC + order mapping
(never books), server-side permissions, NDR action gates, manifest batching.

    npm test                                   # 65 unit tests
    npm run import:csv -- --profile clickpost --file /path/export.csv   # local reconciliation; persists nothing
    python3 tests/e2e/e2e2.py                  # browser flows (needs app running on :3100 with DEMO_LOGIN_PASSWORD=localtestpw)

Not done: Postgres persistence + durable worker, real Shopify sync, Blue Dart live adapter (contract needed),
rule editor/drag reorder, import upload UI. Live writes are off everywhere.
