-- Up Migration
CREATE TABLE outbox (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  aggregate_id uuid NOT NULL,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX outbox_unpublished_idx ON outbox (id) WHERE published_at IS NULL;

-- Down Migration
DROP TABLE outbox;