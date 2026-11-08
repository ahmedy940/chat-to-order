import type { DemoStore } from "@/application/ports/DemoStore";
import { resetDatabase, type Db } from "./database";

/** Reset demo on SQLite: one transaction that empties every table and restarts numbering at #1001. */
export class SqliteDemoStore implements DemoStore {
  constructor(private readonly db: Db) {}

  reset(): void {
    resetDatabase(this.db);
  }
}
