import type { UnitOfWork } from "@/application/ports/UnitOfWork";
import type { Db } from "./database";

/** One SQLite transaction per use case. If anything throws, nothing is saved. */
export class SqliteUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(work: () => T): T {
    return this.db.transaction(work)();
  }
}
