import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { FIRST_ORDER_NUMBER } from "@/domain/types";

export type Db = Database.Database;

export const DEFAULT_DATABASE_PATH = path.join(process.cwd(), "data", "chat-to-order.db");
const SCHEMA_PATH = path.join(process.cwd(), "src", "infrastructure", "db", "schema.sql");

/** Bump when schema.sql changes: an older database file is then rebuilt from scratch (demo data only). */
const SCHEMA_VERSION = 1;

/** Children before parents, so clearing never trips a foreign key. */
const TABLES_CHILD_FIRST = [
  "order_events",
  "proposals",
  "payments",
  "order_details",
  "order_items",
  "orders",
  "messages",
  "conversations",
  "sequences",
] as const;

export function openDatabase(file: string = DEFAULT_DATABASE_PATH): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 3000");
  ensureSchema(db);
  db.pragma("foreign_keys = ON");
  return db;
}

/** Empties every table and restarts order numbers at #1001. Used by `npm run db:reset` (and Reset demo later). */
export function resetDatabase(db: Db): void {
  db.transaction(() => {
    for (const table of TABLES_CHILD_FIRST) db.prepare(`DELETE FROM ${table}`).run();
    seedSequences(db);
  })();
}

function ensureSchema(db: Db): void {
  if (db.pragma("user_version", { simple: true }) === SCHEMA_VERSION) return;
  db.pragma("foreign_keys = OFF");
  db.transaction(() => {
    for (const table of TABLES_CHILD_FIRST) db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
    db.exec(readFileSync(SCHEMA_PATH, "utf8"));
    seedSequences(db);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  })();
}

function seedSequences(db: Db): void {
  db.prepare("INSERT OR REPLACE INTO sequences (name, next_value) VALUES ('order_number', ?)").run(
    FIRST_ORDER_NUMBER,
  );
}
