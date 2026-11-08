import type { DemoStore } from "./ports/DemoStore";

/** Reset demo: clears conversations and orders and restarts numbering at #1001, so judges start fresh. */
export class ResetDemo {
  constructor(private readonly deps: { store: DemoStore }) {}

  execute(): { reset: true } {
    this.deps.store.reset();
    return { reset: true };
  }
}
