/** Typed constants for every status, owner, actor and field name, so no magic strings leak into the code. */

type ValueOf<T> = T[keyof T];

export const SHOP_NAME = "Linen and Co.";
export const CURRENCY = "USD";
export const MAX_OPTIONS = 3;
export const FIRST_ORDER_NUMBER = 1001;
export const MAX_MESSAGE_LENGTH = 1000;

/** Where a conversation happens. Only the two-phone demo for now; WhatsApp is a later adapter. */
export const Channel = { Demo: "demo" } as const;
export type Channel = ValueOf<typeof Channel>;

/** "in" came from the customer, "out" was sent by the shop. */
export const MessageDirection = { In: "in", Out: "out" } as const;
export type MessageDirection = ValueOf<typeof MessageDirection>;

export const MessageKind = { Text: "text", OptionReply: "option_reply", PayLink: "pay_link" } as const;
export type MessageKind = ValueOf<typeof MessageKind>;

/** What the prepared message in the seller's reply box is for. */
export const DraftKind = {
  Question: "question",
  Payment: "payment",
  Thanks: "thanks",
  Refund: "refund",
} as const;
export type DraftKind = ValueOf<typeof DraftKind>;

export const OrderStatus = {
  Draft: "Draft",
  WaitingForCustomer: "WaitingForCustomer",
  AwaitingPayment: "AwaitingPayment",
  Paid: "Paid",
  Refunded: "Refunded",
  Cancelled: "Cancelled",
} as const;
export type OrderStatus = ValueOf<typeof OrderStatus>;

/** Done with: a new purchase in the same chat starts a new order. */
export const FINISHED_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.Paid,
  OrderStatus.Refunded,
  OrderStatus.Cancelled,
];

/** How each status reads on screen. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  Draft: "Draft",
  WaitingForCustomer: "Waiting for customer",
  AwaitingPayment: "Awaiting payment",
  Paid: "Paid",
  Refunded: "Refunded",
  Cancelled: "Cancelled",
};

export const DetailStatus = { Found: "found", Missing: "missing", SetByYou: "set_by_you" } as const;
export type DetailStatus = ValueOf<typeof DetailStatus>;

export const ItemField = {
  Product: "product",
  Variant: "variant",
  Size: "size",
  Quantity: "quantity",
  UnitPrice: "unit_price",
} as const;
export type ItemField = ValueOf<typeof ItemField>;

export const OrderField = { DeliveryFee: "delivery_fee" } as const;
export type OrderField = ValueOf<typeof OrderField>;

export type DetailField = ItemField | OrderField;

/** Display order of an item's details on the card. */
export const ITEM_FIELD_ORDER: readonly ItemField[] = [
  ItemField.Product,
  ItemField.Variant,
  ItemField.Size,
  ItemField.Quantity,
  ItemField.UnitPrice,
];

/** Every item needs these before payment can be requested. Size and variant only when they apply. */
export const REQUIRED_ITEM_FIELDS: readonly ItemField[] = [
  ItemField.Product,
  ItemField.Quantity,
  ItemField.UnitPrice,
];

/** Prices are typed by the seller only: never asked of the customer, never invented by the AI. */
export const SELLER_ONLY_FIELDS: readonly DetailField[] = [ItemField.UnitPrice, OrderField.DeliveryFee];

export const MONEY_FIELDS: readonly DetailField[] = [ItemField.UnitPrice, OrderField.DeliveryFee];

export const FIELD_LABELS: Record<DetailField, string> = {
  product: "Product",
  variant: "Colour or style",
  size: "Size",
  quantity: "Quantity",
  unit_price: "Price",
  delivery_fee: "Delivery fee",
};

export const Actor = {
  Customer: "customer",
  Ai: "ai",
  Agent: "agent",
  Seller: "seller",
  PayPal: "paypal",
} as const;
export type Actor = ValueOf<typeof Actor>;

/** Who did it, as the order timeline says it. */
export const ACTOR_LABELS: Record<Actor, string> = {
  customer: "Customer",
  ai: "AI",
  agent: "Agent",
  seller: "You",
  paypal: "PayPal",
};

export const EventType = {
  OrderRead: "OrderRead",
  DetailSet: "DetailSet",
  ItemRemoved: "ItemRemoved",
  QuestionSent: "QuestionSent",
  PaymentRequested: "PaymentRequested",
  PaymentCaptured: "PaymentCaptured",
  PaymentMismatch: "PaymentMismatch",
  RefundProposed: "RefundProposed",
  ProposalApproved: "ProposalApproved",
  ProposalDismissed: "ProposalDismissed",
  RefundIssued: "RefundIssued",
  RefundFailed: "RefundFailed",
  OrderCancelled: "OrderCancelled",
} as const;
export type EventType = ValueOf<typeof EventType>;

export const ProposalKind = {
  Ask: "ask",
  RequestPayment: "request_payment",
  Remind: "remind",
  Refund: "refund",
} as const;
export type ProposalKind = ValueOf<typeof ProposalKind>;

export const Intent = {
  OrderDetails: "order_details",
  ReadyToPay: "ready_to_pay",
  PaymentQuestion: "payment_question",
  RefundRequest: "refund_request",
  Other: "other",
} as const;
export type Intent = ValueOf<typeof Intent>;

/** Points at one detail: an item's field, or an order-level field when itemId is null. */
export interface DetailRef {
  itemId: string | null;
  field: DetailField;
}
