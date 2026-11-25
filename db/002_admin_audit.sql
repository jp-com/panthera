BEGIN;
CREATE TABLE IF NOT EXISTS commerce.admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor text NOT NULL,
 action text NOT NULL,
 target text NOT NULL,
 before_value jsonb,
 after_value jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE commerce.admin_audit FROM PUBLIC;
COMMIT;
