import { randomUUID } from "node:crypto";
import type { Clock, IdGenerator } from "@/application/ports/Clock";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class RandomIds implements IdGenerator {
  newId(): string {
    return randomUUID();
  }
}
