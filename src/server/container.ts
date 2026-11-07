import { AskCustomer } from "@/application/AskCustomer";
import { CancelOrder } from "@/application/CancelOrder";
import { CapturePayment } from "@/application/CapturePayment";
import { PreparePayPalOrder } from "@/application/PreparePayPalOrder";
import { RefundPayment } from "@/application/RefundPayment";
import { GetCustomerConversation, GetSellerConversation } from "@/application/queries/GetConversation";
import { GetInbox } from "@/application/queries/GetInbox";
import { GetPayPage } from "@/application/queries/GetPayPage";
import { ReadOrder } from "@/application/ReadOrder";
import { ReceiveCustomerMessage } from "@/application/ReceiveCustomerMessage";
import { RequestPayment } from "@/application/RequestPayment";
import { SendReply } from "@/application/SendReply";
import { AddItem, SettleDetail } from "@/application/SettleDetail";
import { StartOrder } from "@/application/StartOrder";
import { GeminiAiProvider } from "@/infrastructure/ai/GeminiAiProvider";
import { DemoChannel } from "@/infrastructure/channels/DemoChannel";
import { ensureSchema, openDatabase, type Db } from "@/infrastructure/db/database";
import { SqliteConversationRepository } from "@/infrastructure/db/SqliteConversationRepository";
import { SqliteDraftRepository } from "@/infrastructure/db/SqliteDraftRepository";
import { SqliteMessageRepository } from "@/infrastructure/db/SqliteMessageRepository";
import { SqliteOrderEventRepository } from "@/infrastructure/db/SqliteOrderEventRepository";
import { SqliteOrderRepository } from "@/infrastructure/db/SqliteOrderRepository";
import { SqliteUnitOfWork } from "@/infrastructure/db/SqliteUnitOfWork";
import { PAYPAL_SANDBOX_URL, PayPalRestGateway } from "@/infrastructure/payments/PayPalRestGateway";
import { RandomIds, RandomTokens, SystemClock } from "@/infrastructure/system";

/** Where the app runs, for pay links: http://localhost:3000 locally, the Render URL when hosted. */
function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
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
  return {
    receiveCustomerMessage: new ReceiveCustomerMessage(a),
    sendReply: new SendReply(a),
    readOrder: new ReadOrder(a),
    askCustomer: new AskCustomer(a),
    startOrder: new StartOrder(a),
    addItem: new AddItem(a),
    settleDetail: new SettleDetail(a),
    requestPayment: new RequestPayment(a),
    preparePayPalOrder: new PreparePayPalOrder(a),
    capturePayment: new CapturePayment(a),
    refundPayment: new RefundPayment(a),
    cancelOrder: new CancelOrder(a),
    getInbox: new GetInbox(a),
    getSellerConversation: new GetSellerConversation(a),
    getCustomerConversation: new GetCustomerConversation(a),
    getPayPage: new GetPayPage(a),
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
