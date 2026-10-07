# Hosting & operating cost worksheet (fill with verified numbers — no rupee total promised)

| Item | Source to recheck | Assumption in brief | Monthly (USD) | INR (rate on date, incl. GST) | Verified? |
|---|---|---|---|---|---|
| App hosting (Vercel Pro, commercial) | https://vercel.com/docs/plans/pro-plan | $20 platform fee, 1 deploying seat, $20 usage credit | | | No |
| Persistent worker (NOT serverless) | provider TBD | needed | | | No |
| PostgreSQL (paid tier or VM) + backups | https://neon.com/faqs/free-plan-limits-and-quotas | Free tier not production-safe | | | No |
| Object storage (labels/POD) | TBD | | | | No |
| Monitoring/logging | TBD | | | | No |
| Email/WhatsApp provider | TBD | off by default | | | No |
| Carrier API fees | per contract | unknown | | | No |
| Engineering/support time | — | | | | — |
Capacity assumption: ~7,000 shipments/month (to be replaced by measured history + load test).
