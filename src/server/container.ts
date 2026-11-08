import { AskCustomer } from "@/application/AskCustomer";
import { CancelOrder } from "@/application/CancelOrder";
import { CapturePayment } from "@/application/CapturePayment";
import { ApproveProposal, DismissProposal } from "@/application/DecideProposal";
import { PreparePayPalOrder } from "@/application/PreparePayPalOrder";
import { ProposeNextAction } from "@/application/ProposeNextAction";
import { RefundPayment } from "@/application/RefundPayment";
import { GetCustomerConversation, GetSellerConversation } from "@/application/queries/GetConversation";
import { GetInbox } from "@/application/queries/GetInbox";
import { GetPayPage } from "@/application/queries/GetPayPage";
import { ListOrders } from "@/application/queries/ListOrders";
import { ReadOrder } from "@/application/ReadOrder";
import { ReceiveCustomerMessage } from "@/application/ReceiveCustomerMessage";
import { RequestPayment } from "@/application/RequestPayment";
import { ResetDemo } from "@/application/ResetDemo";
import { SendReply } from "@/application/SendReply";
import { AddItem, RemoveItem, SettleDetail } from "@/application/SettleDetail";
import { StartOrder } from "@/application/StartOrder";
import { GeminiAiProvider } from "@/infrastructure/ai/GeminiAiProvider";
import { DemoChannel } from "@/infrastructure/channels/DemoChannel";
import { ensureSchema, openDatabase, type Db } from "@/infrastructure/db/database";
import { SqliteConversationRepository } from "@/infrastructure/db/SqliteConversationRepository";
import { SqliteDemoStore } from "@/infrastructure/db/SqliteDemoStore";
import { SqliteDraftRepository } from "@/infrastructure/db/SqliteDraftRepository";
import { SqliteMessageRepository } from "@/infrastructure/db/SqliteMessageRepository";
import { SqliteOrderEventRepository } from "@/infrastructure/db/SqliteOrderEventRepository";
import { SqliteOrderRepository } from "@/infrastructure/db/SqliteOrderRepository";
import { SqliteProposalRepository } from "@/infrastructure/db/SqliteProposalRepository";
import { SqliteUnitOfWork } from "@/infrastructure/db/SqliteUnitOfWork";
import { PAYPAL_SANDBOX_URL, PayPalRestGateway } from "@/infrastructure/payments/PayPalRestGateway";
import { RandomIds, RandomTokens, SystemClock } from "@/infrastructure/system";

/**
 * Where the app runs, for pay links: APP_BASE_URL if set, else the address Render gives every web service
 * (RENDER_EXTERNAL_URL), else http://localhost:3000.
 */
function appBaseUrl(): string {
  const base = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

/** The real adapters. Secrets come from the environment and are never sent to the browser. */
function adapters(db: Db) {
  const messages = new SqliteMessageRepository(db);
  const gateway = new PayPalRestGateway({
    clientId: process.env.PAYPAL_CLIENT_ID ?? "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
    baseUrl: PAYPAL_SANDBOX_URL,
  });
  return {
    conversations: new SqliteConversationRepository(db),
    messages,
    orders: new SqliteOrderRepository(db),
    events: new SqliteOrderEventRepository(db),
    drafts: new SqliteDraftRepository(db),
    proposals: new SqliteProposalRepository(db),
    uow: new SqliteUnitOfWork(db),
    clock: new SystemClock(),
    ids: new RandomIds(),
    tokens: new RandomTokens(),
    channel: new DemoChannel(messages),
    gateway,
    ai: new GeminiAiProvider({
      apiKey: process.env.GEMINI_API_KEY ?? "",
      readModel: process.env.GEMINI_READ_MODEL,
      writeModel: process.env.GEMINI_INTENT_MODEL,
    }),
    payUrl: (payToken: string) => `${appBaseUrl()}/pay/${payToken}`,
  };
}

/**
 * The one place that picks the real adapters and hands them to the use cases. Routes and pages ask this
 * container for a use case; nothing else creates adapters.
 */
function build(db: Db) {
  const a = adapters(db);
  const requestPayment = new RequestPayment(a);
  const refundPayment = new RefundPayment(a);
  // Approving a proposal runs the same use cases as the order card's buttons.
  const decisions = { ...a, requestPayment, refundPayment };
  return {
    receiveCustomerMessage: new ReceiveCustomerMessage(a),
    sendReply: new SendReply(a),
    readOrder: new ReadOrder(a),
    askCustomer: new AskCustomer(a),
    startOrder: new StartOrder(a),
    addItem: new AddItem(a),
    removeItem: new RemoveItem(a),
    settleDetail: new SettleDetail(a),
    requestPayment,
    preparePayPalOrder: new PreparePayPalOrder(a),
    capturePayment: new CapturePayment(a),
    refundPayment,
    cancelOrder: new CancelOrder(a),
    proposeNextAction: new ProposeNextAction(a),
    approveProposal: new ApproveProposal(decisions),
    dismissProposal: new DismissProposal(decisions),
    getInbox: new GetInbox(a),
    getSellerConversation: new GetSellerConversation(a),
    getCustomerConversation: new GetCustomerConversation(a),
    getPayPage: new GetPayPage(a),
    listOrders: new ListOrders(a),
    resetDemo: new ResetDemo({ store: new SqliteDemoStore(db) }),
  };
}

export type Container = ReturnType<typeof build>;

/** One database connection per server process, kept across dev-server reloads. */
const shared = globalThis as typeof globalThis & { chatToOrderDb?: Db };
let instance: Container | undefined;

export function container(): Container {
  if (instance) return instance;
  shared.chatToOrderDb ??= openDatabase(process.env.DATABASE_PATH || undefined);
  ensureSchema(shared.chatToOrderDb); // after a dev reload, the kept connection may predate a schema change
  instance = build(shared.chatToOrderDb);
  return instance;
}
