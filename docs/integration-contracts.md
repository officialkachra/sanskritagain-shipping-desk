# Integration contracts (verification ledger)

Nothing below is verified for SanskritAgain accounts yet. All live adapters are `unverifiedLiveAdapter()` and book nothing.

| Integration | Discovery URL (from brief) | Retrieved | Auth | Host/version | Units | Mandatory fields | Quote TTL | Idempotency / lookup-by-ref | Rate limits | Sandbox | Webhook verification | Entitlement status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Blue Dart waybill (Surface prepaid / Surface COD / Air prepaid — separate) | https://www.bluedart.com/business-integrations | not yet | ? | ? | ? | ? | ? | ? | ? | ? | ? | Need account onboarding pack |
| Blue Dart tracking | https://developer.dhl.com/api-reference/blue-dart-tracking-shipment | not yet | JWT/authenticator per portal (unconfirmed for us) | ? | — | ? | — | — | ? | ? | ? | Tracking ≠ booking |
| Delhivery B2C | https://one.delhivery.com/developer-portal/document/b2c/detail/order-creation | not yet (may need login) | ? | ? | ? | ? | ? | ? | ? | ? | ? | Do not use B2B docs |
| Amazon Shipping v2 (ATS) | https://developer-docs.shipping.amazon.com/apis/docs/shipping-api-v2-reference , https://shipping.amazon.in/integrations | not yet | ? (India onboarding) | ? | ? | ? | ? | ? | ? | ? | ? | Verify India region/auth |
| Shopify Admin GraphQL | https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentCreate | not yet | Admin token | pin version | — | — | — | — | ? | dev store | raw-body HMAC (https://shopify.dev/docs/apps/build/webhooks/verify-deliveries) | Scopes to confirm |
| Kwik Ship | — | — | — | — | — | — | — | — | — | — | — | Optional, disabled |

Fill each row from official docs/onboarding packs before flipping any read or write switch.
