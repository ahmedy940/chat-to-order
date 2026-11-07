import { CURRENCY } from "./types";

/** "$60", "60", "60.5", "1,200.00", "60$" or "60 usd". Whole dollars, then up to two decimals. */
const MONEY_TEXT = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.(\d{1,2}))?\s*(?:\$|usd)?$/i;
/** PayPal's own format, for example "128.00". */
const PAYPAL_VALUE = /^(\d{1,9})(?:\.(\d{1,2}))?$/;

const display = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY });

function toCents(whole: string, fraction: string | undefined): number {
  return Number(whole.replaceAll(",", "")) * 100 + Number((fraction ?? "0").padEnd(2, "0"));
}

/** An amount in US dollars, held as whole cents so totals never drift. */
export class Money {
  private constructor(readonly cents: number) {}

  static ofCents(cents: number): Money {
    if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError(`Invalid amount in cents: ${cents}`);
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  /** Reads what a person types. Returns null when it isn't an amount. */
  static parse(text: string): Money | null {
    const match = MONEY_TEXT.exec(text.trim());
    return match?.[1] === undefined ? null : Money.ofCents(toCents(match[1], match[2]));
  }

  /** Reads an amount PayPal sent back. Throws, because a malformed amount from PayPal is a real error. */
  static fromPayPalValue(value: string): Money {
    const match = PAYPAL_VALUE.exec(value);
    if (match?.[1] === undefined) throw new RangeError(`Unexpected PayPal amount: ${value}`);
    return Money.ofCents(toCents(match[1], match[2]));
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  times(quantity: number): Money {
    if (!Number.isSafeInteger(quantity) || quantity < 0)
      throw new RangeError(`Invalid quantity: ${quantity}`);
    return new Money(this.cents * quantity);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  /** PayPal's string format: "128.00". */
  toPayPalValue(): string {
    return `${Math.floor(this.cents / 100)}.${String(this.cents % 100).padStart(2, "0")}`;
  }

  /** "$128.00" */
  format(): string {
    return display.format(this.cents / 100);
  }
}

/** "+$128.00" or "−$128.00" for the order timeline's money lines. */
export function formatSignedCents(cents: number): string {
  return `${cents < 0 ? "−" : "+"}${Money.ofCents(Math.abs(cents)).format()}`;
}
