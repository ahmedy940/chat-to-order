-- chat-to-order data model (spec.md > Data Model). Money is in integer cents (USD). Times are ISO-8601 UTC text.
-- Step 2 uses conversations and messages; the order tables fill in from step 3.

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  channel TEXT NOT NULL,
  last_customer_message_id TEXT,
  last_handled_message_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  client_id TEXT NOT NULL UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX messages_by_conversation ON messages(conversation_id, created_at);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  status TEXT NOT NULL,
  delivery_fee_cents INTEGER,
  frozen_total_cents INTEGER,
  pay_token TEXT UNIQUE,
  first_message_id TEXT,
  last_read_message_id TEXT,
  draft_id TEXT,
  draft_text TEXT,
  draft_options_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  position INTEGER NOT NULL
);

CREATE TABLE order_details (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  item_id TEXT REFERENCES order_items(id),
  field TEXT NOT NULL,
  value TEXT,
  status TEXT NOT NULL,
  source_quote TEXT,
  offered_options_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  paypal_order_id TEXT,
  attempt INTEGER NOT NULL DEFAULT 0,
  paypal_status TEXT,
  capture_id TEXT UNIQUE,
  refund_id TEXT UNIQUE,
  payer_name TEXT,
  payer_email TEXT,
  ship_name TEXT,
  ship_address_json TEXT,
  captured_cents INTEGER,
  captured_at TEXT,
  refunded_at TEXT
);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  order_id TEXT REFERENCES orders(id),
  kind TEXT NOT NULL,
  reason TEXT NOT NULL,
  quote TEXT,
  based_on_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'approved', 'dismissed')),
  created_at TEXT NOT NULL
);

-- Append-only: rows are never updated or deleted (except by Reset demo).
CREATE TABLE order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  summary TEXT NOT NULL,
  quote TEXT,
  amount_cents INTEGER,
  fee_cents INTEGER,
  net_cents INTEGER,
  paypal_ref TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (order_id, seq)
);

CREATE TABLE sequences (
  name TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL
);
