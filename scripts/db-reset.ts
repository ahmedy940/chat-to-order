/**
 * `npm run db:reset`: empties the demo database (conversations, messages, orders) and restarts order
 * numbers at #1001. Safe while the dev server runs: it clears the same file the server reads.
 */
import { openDatabase, resetDatabase } from "@/infrastructure/db/database";

const db = openDatabase(process.env.DATABASE_PATH || undefined);
resetDatabase(db);
db.close();
console.log("Demo data cleared. Order numbers restart at #1001.");
