# Round 9 commerce foundation

The existing index.html stays untouched. This branch contains a schema migration and pure server-side quote logic, not a functioning payment integration. No production secrets, real customer data, or approved shipping rates are included.

## Provisioning gates
1. Connect a dedicated Neon database in Vercel Storage to the original panthera project. Use isolated development/preview and production databases or branches.
2. Run db/001_foundation.sql using a migration role on the development database. Verify constraints, least-privilege runtime role and backups. Never expose DATABASE_URL to the browser. Use a pooled connection and SSL.
3. Connect a dedicated Stripe sandbox; confirm merchant identity before any live configuration. Store restricted credentials and webhook signing secret in Vercel sensitive server-only environment variables.
4. Confirm actual stock, rates, transit estimates, countries, tax registrations and duties, returns and damages policies. Default seed prevents checkout. No synthetic rates should be deployed.
5. Validate everything in a preview before any merge/production checkout activation.

## API contract (planned, not implemented)
- GET /api/product: public approved product fields and image dimensions; no private operational data.
- POST /api/quote: sku, quantity, country, method only. Resolve price, stock and delivery from DB. No client-provided price or tax.
- POST /api/checkout: validate quote again under a transaction; reserve stock with conditional atomic UPDATE or SELECT FOR UPDATE, insert pending order and immutable line items. Use the order UUID as Stripe idempotency key. Create hosted Checkout in sandbox only until explicitly approved. Restrict shipping destination to selected country. Do not permit Stripe address/rate mismatch. Reconcile abandoned sessions, and release reservations only after Stripe confirms expiry or failed payment; handle delayed methods safely.
- POST /api/stripe/webhook: verify raw body/signature before parsing; use one transaction for unique event ID, expected session/amount/currency validation, monotonic payment-state transitions, stock consumption and notification outbox. Handle completed, async payment succeeded/failed and expired; verify payment status before fulfilment. Handle refunds/disputes without treating them as shipments. Duplicate event deliveries must have no side effects; roll back the event claim if processing fails. Reconcile ambiguous checkout creation failures rather than freeing stock blindly.
- GET /api/order/status: opaque expiring capability or authenticated access; no sequential-ID or email-based enumeration.
- Admin: authenticated staff only with least privilege; protect against CSRF, require role checks on every mutation, audit inventory/shipping/refund changes. Do not expose public write APIs.
- Outbox: durable retry and deduplication for confirmations and dispatch; no live email provider configured.
- Analytics: consent-aware only; dedupe purchase event against order ID, do not send payment/card or private address data.

## Testing
Run node --test tests/quote.test.mjs with Node 22+. These are isolated quote tests, not a database or Stripe integration test. After provisioning, test SQL migration, concurrent reservation attempts, expired/duplicate/out-of-order events, asynchronous payment, incorrect signatures/amounts, tax and delivery eligibility, refunds, and storefront mobile/desktop flows.

## Launch gates
Live payments require explicit approval, production credentials, stock and enabled rates, tested webhook and reconciliation, legal/tax review, fulfillment readiness and user acceptance. Keep the storefront noindex during development. Checkout is not enabled merely by deploying this branch.
