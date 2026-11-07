/** Pay-link tokens: random and unguessable (128 bits), so a link reveals only its own order. */
export interface TokenFactory {
  newPayToken(): string;
}

/** Turns a pay token into the link the customer opens. */
export type PayUrl = (payToken: string) => string;
