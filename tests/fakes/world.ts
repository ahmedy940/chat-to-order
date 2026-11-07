import { CancelOrder } from "@/application/CancelOrder";
import { CapturePayment } from "@/application/CapturePayment";
import { PreparePayPalOrder } from "@/application/PreparePayPalOrder";
import { RefundPayment } from "@/application/RefundPayment";
import { GetCustomerConversation, GetSellerConversation } from "@/application/queries/GetConversation";
import { GetInbox } from "@/application/queries/GetInbox";
import { GetPayPage } from "@/application/queries/GetPayPage";
import { ReceiveCustomerMessage } from "@/application/ReceiveCustomerMessage";
import { RequestPayment } from "@/application/RequestPayment";
import { SendReply } from "@/application/SendReply";
import { AddItem, SettleDetail } from "@/application/SettleDetail";
import { StartOrder } from "@/application/StartOrder";
import {
  FixedClock,
  ImmediateUnitOfWork,
  InMemoryConversations,
  InMemoryMessages,
  SavingChannel,
  SequentialIds,
} from "./inMemory";
import {
  CountingTokens,
  FakePaymentGateway,
  InMemoryDrafts,
  InMemoryOrderEvents,
  InMemoryOrders,
} from "./inMemoryOrders";

export const PAY_BASE = "https://shop.test/pay/";

/** Every use case wired to in-memory fakes, the same way the container wires the real adapters. */
export function appWorld() {
  const messages = new InMemoryMessages();
  const a = {
    conversations: new InMemoryConversations(),
    messages,
    orders: new InMemoryOrders(),
    events: new InMemoryOrderEvents(),
    drafts: new InMemoryDrafts(),
    uow: new ImmediateUnitOfWork(),
    clock: new FixedClock(),
    ids: new SequentialIds(),
    tokens: new CountingTokens(),
    channel: new SavingChannel(messages),
    gateway: new FakePaymentGateway(),
    payUrl: (payToken: string) => `${PAY_BASE}${payToken}`,
  };
  return {
    ...a,
    receive: new ReceiveCustomerMessage(a),
    reply: new SendReply(a),
    startOrder: new StartOrder(a),
    addItem: new AddItem(a),
    settle: new SettleDetail(a),
    requestPayment: new RequestPayment(a),
    preparePayPal: new PreparePayPalOrder(a),
    capture: new CapturePayment(a),
    refund: new RefundPayment(a),
    cancel: new CancelOrder(a),
    inbox: new GetInbox(a),
    sellerView: new GetSellerConversation(a),
    customerView: new GetCustomerConversation(a),
    payPage: new GetPayPage(a),
  };
}

/** Kept for the chat tests from step 2. */
export const chatWorld = appWorld;
