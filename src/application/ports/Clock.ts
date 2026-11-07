/** Time and IDs come through ports so tests can fix them. */
export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  newId(): string;
}
