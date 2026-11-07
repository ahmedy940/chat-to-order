/** Runs a use case's writes as one transaction: either all of them are saved, or none. */
export interface UnitOfWork {
  run<T>(work: () => T): T;
}
