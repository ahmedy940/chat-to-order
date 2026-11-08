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
import { AddItem, RemoveItem, SettleDetail } from "@/application/SettleDetail";
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
import { FakeAiProvider } from "./fakeAi";
import { AskCustomer } from "@/application/AskCustomer";
import { ReadOrder } from "@/application/ReadOrder";
import { ApproveProposal, DismissProposal } from "@/application/DecideProposal";
import { ProposeNextAction } from "@/application/ProposeNextAction";
import { InMemoryProposals } from "./inMemoryProposals";

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
    proposals: new InMemoryProposals(),
    uow: new ImmediateUnitOfWork(),
    clock: new FixedClock(),
    ids: new SequentialIds(),
    tokens: new CountingTokens(),
    channel: new SavingChannel(messages),
    gateway: new FakePaymentGateway(),
    ai: new FakeAiProvider(),
    payUrl: (payToken: string) => `${PAY_BASE}${payToken}`,
  };
  const requestPayment = new RequestPayment(a);
  const refund = new RefundPayment(a);
  const decisions = { ...a, requestPayment, refundPayment: refund };
  return {
    ...a,
    receive: new ReceiveCustomerMessage(a),
    reply: new SendReply(a),
    readOrder: new ReadOrder(a),
    askCustomer: new AskCustomer(a),
    startOrder: new StartOrder(a),
    addItem: new AddItem(a),
    removeItem: new RemoveItem(a),
    settle: new SettleDetail(a),
    requestPayment,
    preparePayPal: new PreparePayPalOrder(a),
    capture: new CapturePayment(a),
    refund,
    cancel: new CancelOrder(a),
    agent: new ProposeNextAction(a),
    approve: new ApproveProposal(decisions),
    dismiss: new DismissProposal(decisions),
    inbox: new GetInbox(a),
    sellerView: new GetSellerConversation(a),
    customerView: new GetCustomerConversation(a),
    payPage: new GetPayPage(a),
  };
}

/** Kept for the chat tests from step 2. */
export const chatWorld = appWorld;
