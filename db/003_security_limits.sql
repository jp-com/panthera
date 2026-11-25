BEGIN;
CREATE TABLE IF NOT EXISTS commerce.request_limits(
 scope text NOT NULL,
 window_start timestamptz NOT NULL,
 hits integer NOT NULL CHECK(hits>0),
 PRIMARY KEY(scope,window_start)
);
REVOKE ALL ON TABLE commerce.request_limits FROM PUBLIC;
COMMIT;
