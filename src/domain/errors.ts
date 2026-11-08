/** Typed domain errors. Routes map each code to a clear HTTP response and a friendly message. */

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidTransition extends DomainError {
  constructor(status: string, action: string) {
    super("INVALID_TRANSITION", `Can't ${action} an order that is ${status}.`);
  }
}

export class OrderNotPayable extends DomainError {
  constructor(reason: string) {
    super("ORDER_NOT_PAYABLE", reason);
  }
}

export class OrderLocked extends DomainError {
  constructor() {
    super(
      "ORDER_LOCKED",
      "Items can't change after payment is requested. Cancel the order and start a new one.",
    );
  }
}

export class LastItem extends DomainError {
  constructor() {
    super("LAST_ITEM", "An order needs at least one item. Cancel the order instead.");
  }
}

export class InvalidDetailValue extends DomainError {
  constructor(label: string) {
    super("INVALID_DETAIL_VALUE", `That doesn't look like a valid ${label.toLowerCase()}.`);
  }
}

export class OptionsNotAllowed extends DomainError {
  constructor(reason: string) {
    super("OPTIONS_NOT_ALLOWED", reason);
  }
}

export class UnknownDetail extends DomainError {
  constructor() {
    super("UNKNOWN_DETAIL", "That detail isn't on this order.");
  }
}

export class RefundNotAllowed extends DomainError {
  constructor(status: string) {
    super("REFUND_NOT_ALLOWED", `Only paid orders can be refunded. This order is ${status}.`);
  }
}

export class DraftOutdated extends DomainError {
  constructor() {
    super("DRAFT_OUTDATED", "Draft updated");
  }
}

export class InvalidMessage extends DomainError {
  constructor(reason: string) {
    super("INVALID_MESSAGE", reason);
  }
}

export class ConversationNotFound extends DomainError {
  constructor() {
    super("NOT_FOUND", "That conversation doesn't exist any more. The demo may have been reset.");
  }
}

export class OrderNotFound extends DomainError {
  constructor() {
    super("NOT_FOUND", "That order doesn't exist any more. The demo may have been reset.");
  }
}

export class PayLinkNotFound extends DomainError {
  constructor() {
    super("NOT_FOUND", "This pay link isn't valid. Ask the shop for a new one.");
  }
}

export class ProposalNotFound extends DomainError {
  constructor() {
    super("NOT_FOUND", "That suggestion is no longer there. The customer may have written again.");
  }
}

export class NothingToRead extends DomainError {
  constructor() {
    super("NOTHING_TO_READ", "There's nothing new from the customer to read yet.");
  }
}

/** The pay page can't take money for this order (already paid, cancelled, or a different PayPal order). */
export class PaymentNotOpen extends DomainError {
  constructor(reason: string) {
    super("PAYMENT_NOT_OPEN", reason);
  }
}
