# PANTHERA

Independent single-product storefront for The Panther.

## Approved direction

- Round 7 responsive storefront, with the original image aspect ratios preserved at every breakpoint.
- Image placeholders and provisional typography until approved assets are available.
- No decorative eyebrows, em dashes, redundant captions or scale headline.
- Working product: 80 cm high-gloss black sculpture, USD 745.
- Included standard sea delivery for eligible destinations; priority air delivery where verified rates are available.

## Technical architecture

Vercel-hosted storefront and Node.js serverless API, PostgreSQL for commerce and order state, Stripe-hosted Checkout for payment. No Shopify.

## Development and launch

Start with isolated development and Stripe sandbox credentials. Do not enable live checkout until merchant identity, pricing, shipping rates and destination eligibility, inventory, tax treatment, returns and product specifications are approved. The server must validate price, quantity and destination, and use signed Stripe webhooks and idempotent order creation. No payment credentials or customer data belong in this repository.

The approved storefront prototype is currently a separate design artifact. This repository is the implementation target.
