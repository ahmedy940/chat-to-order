import { InvalidDetailValue, OptionsNotAllowed } from "./errors";
import { Money } from "./Money";
import {
  DetailStatus,
  FIELD_LABELS,
  ItemField,
  MAX_OPTIONS,
  MONEY_FIELDS,
  SELLER_ONLY_FIELDS,
  type DetailField,
} from "./types";

export interface DetailSnapshot {
  field: DetailField;
  value: string | null;
  status: DetailStatus;
  sourceQuote: string | null;
  offeredOptions: string[];
}

/** What the AI reported for one detail. The AI can only say found or missing. */
export interface DetailReading {
  value: string | null;
  status: "found" | "missing";
  quote: string | null;
}

const MAX_TEXT_LENGTH = 80;
const MAX_QUANTITY = 999;

function normalizeQuantity(text: string): string | null {
  const quantity = /^\d+$/.test(text) ? Number(text) : 0;
  return quantity > 0 && quantity <= MAX_QUANTITY ? String(quantity) : null;
}

/** Cleans a value for its field, or returns null when it isn't valid for that field. */
function normalize(field: DetailField, raw: string | null): string | null {
  const text = raw?.trim() ?? "";
  if (text === "") return null;
  if (MONEY_FIELDS.includes(field)) return Money.parse(text)?.toPayPalValue() ?? null;
  if (field === ItemField.Quantity) return normalizeQuantity(text);
  return text.slice(0, MAX_TEXT_LENGTH);
}

/** One detail of an order (a product, a size, a price…): its value, where it came from, and who set it. */
export class OrderDetail {
  private constructor(private state: DetailSnapshot) {}

  static missing(field: DetailField): OrderDetail {
    return new OrderDetail({
      field,
      value: null,
      status: DetailStatus.Missing,
      sourceQuote: null,
      offeredOptions: [],
    });
  }

  static restore(snapshot: DetailSnapshot): OrderDetail {
    return new OrderDetail({ ...snapshot, offeredOptions: [...snapshot.offeredOptions] });
  }

  get field(): DetailField {
    return this.state.field;
  }

  get value(): string | null {
    return this.state.value;
  }

  get status(): DetailStatus {
    return this.state.status;
  }

  get isOpen(): boolean {
    return this.state.status === DetailStatus.Missing;
  }

  get isSellerOnly(): boolean {
    return SELLER_ONLY_FIELDS.includes(this.state.field);
  }

  get label(): string {
    return FIELD_LABELS[this.state.field];
  }

  get offeredOptions(): readonly string[] {
    return this.state.offeredOptions;
  }

  /** The value as money, for price fields that are filled in. */
  get money(): Money | null {
    return MONEY_FIELDS.includes(this.state.field) && this.state.value !== null
      ? Money.parse(this.state.value)
      : null;
  }

  snapshot(): DetailSnapshot {
    return { ...this.state, offeredOptions: [...this.state.offeredOptions] };
  }

  /** Merges an AI reading. Never overwrites what the seller set. Returns true when the detail changed. */
  applyReading(reading: DetailReading): boolean {
    if (this.state.status === DetailStatus.SetByYou) return false;
    const value = reading.status === DetailStatus.Found ? normalize(this.state.field, reading.value) : null;
    const next: DetailSnapshot =
      value === null
        ? { ...this.state, value: null, status: DetailStatus.Missing, sourceQuote: null }
        : {
            ...this.state,
            value,
            status: DetailStatus.Found,
            sourceQuote: reading.quote,
            offeredOptions: [],
          };
    const changed = next.value !== this.state.value || next.status !== this.state.status;
    this.state = next;
    return changed;
  }

  /** The seller types the value. It's theirs from now on. */
  setBySeller(raw: string): void {
    const value = normalize(this.state.field, raw);
    if (value === null) throw new InvalidDetailValue(this.label);
    this.state = {
      ...this.state,
      value,
      status: DetailStatus.SetByYou,
      sourceQuote: null,
      offeredOptions: [],
    };
  }

  /** The seller offers up to 3 options for the customer to tap. Never for a price. */
  askCustomer(options: readonly string[]): void {
    if (this.isSellerOnly) throw new OptionsNotAllowed("A price is always typed by the seller, never asked.");
    if (!this.isOpen) throw new OptionsNotAllowed(`${this.label} is already filled in.`);
    const clean = [...new Set(options.map((option) => option.trim()).filter((option) => option !== ""))];
    if (clean.length === 0 || clean.length > MAX_OPTIONS) {
      throw new OptionsNotAllowed(`Offer between 1 and ${MAX_OPTIONS} options.`);
    }
    this.state = { ...this.state, offeredOptions: clean };
  }

  /** The customer tapped one of the offered options. Returns false when it wasn't offered. */
  answerFromCustomer(option: string, quote: string): boolean {
    if (!this.isOpen || !this.state.offeredOptions.includes(option)) return false;
    this.state = {
      ...this.state,
      value: option,
      status: DetailStatus.Found,
      sourceQuote: quote,
      offeredOptions: [],
    };
    return true;
  }
}
