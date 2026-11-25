# Production checkout gates

This branch implements production-mode checkout code, not an enabled or certified live payment flow. Do not set LIVE_CHECKOUT_ENABLED=true until the following are complete.

- Confirm the merchant account and add a minimally privileged restricted live Stripe key and webhook signing secret in Vercel Secrets (production only).
- Confirm independent production database, least-privilege app role, approved rates, stock and country coverage. Configure a real rate limit/bot protection before reservations can be created.
- Confirm tax handling, including whether prices are tax inclusive; current API requires an explicitly approved tax policy and supports only a total with no additional separately calculated tax. Add Stripe Tax or another verified calculation if required before enabling.
- Register the production webhook /api/stripe-webhook for checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired. Verify signed delivery and retries, session/amount/currency/destination matching, and concurrent reservation correctness.
- Implement reconciliation for reservations with no Stripe session association or missing webhooks, and alert on any payment mismatch; do not release stock solely on time expiry. Refund/dispute synchronisation, staff access, shipment workflow and email dispatch worker remain to be implemented.
- Verify full checkout path without real money using appropriate testing facilities. User declined setting up a separate sandbox; no actual Stripe API requests or payment tests were performed.
- Confirm legal policies, returns, delivery promises and commercial Vercel plan before trading.
- Enable product and checkout only after acceptance; storefront remains noindex and sales disabled by default.

The existing preview storefront remains the baseline. Production integration code is staged in the commerce-foundation branch, not the deployed main branch.
