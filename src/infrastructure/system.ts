import { randomBytes, randomUUID } from "node:crypto";
import type { Clock, IdGenerator } from "@/application/ports/Clock";
import type { TokenFactory } from "@/application/ports/TokenFactory";

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

/** 128 random bits, URL-safe: a pay link can't be guessed from another one. */
export class RandomTokens implements TokenFactory {
  newPayToken(): string {
    return randomBytes(16).toString("base64url");
  }
}
