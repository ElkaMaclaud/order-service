-- Up Migration
CREATE TABLE orders (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  customer_id   uuid        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'paid', 'payment_failed', 'cancelled')),
  total_amount  bigint      NOT NULL CHECK (total_amount >= 0),
  currency      char(3)     NOT NULL DEFAULT 'RUB',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_customer_id_idx ON orders (customer_id);

CREATE TABLE order_items (
  id          uuid    PRIMARY KEY DEFAULT uuidv7(),
  order_id    uuid    NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id  uuid    NOT NULL,
  unit_price  bigint  NOT NULL CHECK (unit_price >= 0),
  quantity    integer NOT NULL CHECK (quantity > 0),
  UNIQUE (order_id, product_id)
);

-- Down Migration
DROP TABLE order_items;
DROP TABLE orders;