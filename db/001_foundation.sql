-- Run once on an isolated Neon development branch using a migration role.
-- The app role must NOT own these tables. Grant only the privileges it needs after review.
BEGIN;
CREATE SCHEMA IF NOT EXISTS commerce;
REVOKE ALL ON SCHEMA commerce FROM PUBLIC;
SET LOCAL search_path = commerce, pg_catalog;
CREATE TABLE products (
  sku text PRIMARY KEY,
  name text NOT NULL,
  currency text NOT NULL CHECK (currency = 'USD'),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0),
  target_height_cm numeric(6,2) CHECK (target_height_cm > 0),
  finish text,
  available_for_sale boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL REFERENCES products(sku),
  asset_url text NOT NULL,
  alt_text text NOT NULL,
  width_px integer NOT NULL CHECK (width_px > 0),
  height_px integer NOT NULL CHECK (height_px > 0),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (sku, position)
);
CREATE TABLE inventory (
  sku text PRIMARY KEY REFERENCES products(sku),
  on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= on_hand)
);
CREATE TABLE shipping_rates (
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  method text NOT NULL CHECK (method IN ('sea','air')),
  currency text NOT NULL CHECK (currency = 'USD'),
  per_unit_cents integer NOT NULL CHECK (per_unit_cents >= 0),
  min_business_days integer NOT NULL CHECK (min_business_days > 0),
  max_business_days integer NOT NULL CHECK (max_business_days >= min_business_days),
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (country_code, method)
);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id text UNIQUE,
  payment_intent_id text UNIQUE,
  currency text NOT NULL CHECK (currency = 'USD'),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','expired','partially_refunded','refunded')),
  fulfillment_status text NOT NULL DEFAULT 'unfulfilled' CHECK (fulfillment_status IN ('unfulfilled','processing','shipped','delivered','cancelled')),
  customer_email text,
  shipping_address jsonb,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  shipping_method text NOT NULL CHECK (shipping_method IN ('sea','air')),
  subtotal_cents bigint NOT NULL CHECK (subtotal_cents > 0),
  shipping_cents bigint NOT NULL CHECK (shipping_cents >= 0),
  tax_cents bigint NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents bigint NOT NULL CHECK (total_cents = subtotal_cents + shipping_cents + tax_cents),
  refunded_cents bigint NOT NULL DEFAULT 0 CHECK (refunded_cents BETWEEN 0 AND total_cents),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CHECK (payment_status NOT IN ('paid','partially_refunded','refunded') OR (paid_at IS NOT NULL AND checkout_session_id IS NOT NULL AND payment_intent_id IS NOT NULL))
);
CREATE TABLE order_items (
  order_id uuid NOT NULL REFERENCES orders(id),
  sku text NOT NULL REFERENCES products(sku),
  name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0),
  PRIMARY KEY(order_id, sku)
);
CREATE TABLE reservations (
  order_id uuid NOT NULL REFERENCES orders(id),
  sku text NOT NULL REFERENCES inventory(sku),
  quantity integer NOT NULL CHECK (quantity > 0),
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'held' CHECK (state IN ('held','released','consumed')),
  PRIMARY KEY(order_id, sku)
);
CREATE INDEX reservations_expiry_idx ON reservations(expires_at) WHERE state='held';
CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  carrier text NOT NULL,
  tracking_number text NOT NULL,
  shipped_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE(carrier, tracking_number)
);
CREATE TABLE webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  kind text NOT NULL CHECK (kind IN ('order_confirmation','dispatch','refund')),
  dedupe_key text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE TABLE store_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  checkout_enabled boolean NOT NULL DEFAULT false
);
CREATE INDEX orders_fulfillment_idx ON orders(fulfillment_status, created_at);
CREATE INDEX orders_payment_idx ON orders(payment_status, created_at);
INSERT INTO products(sku,name,currency,unit_price_cents,target_height_cm,finish)
VALUES ('PANTHER-BLACK-80','The Panther','USD',74500,80,'High-gloss black');
INSERT INTO inventory(sku) VALUES ('PANTHER-BLACK-80');
INSERT INTO store_settings DEFAULT VALUES;
-- No rates, saleable stock or live checkout are seeded.
REVOKE ALL ON ALL TABLES IN SCHEMA commerce FROM PUBLIC;
COMMIT;
