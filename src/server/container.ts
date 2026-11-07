import { GetCustomerConversation, GetSellerConversation } from "@/application/queries/GetConversation";
import { GetInbox } from "@/application/queries/GetInbox";
import { ReceiveCustomerMessage } from "@/application/ReceiveCustomerMessage";
import { SendReply } from "@/application/SendReply";
import { DemoChannel } from "@/infrastructure/channels/DemoChannel";
import { openDatabase, type Db } from "@/infrastructure/db/database";
import { SqliteConversationRepository } from "@/infrastructure/db/SqliteConversationRepository";
import { SqliteMessageRepository } from "@/infrastructure/db/SqliteMessageRepository";
import { SqliteUnitOfWork } from "@/infrastructure/db/SqliteUnitOfWork";
import { RandomIds, SystemClock } from "@/infrastructure/system";

/**
 * The one place that picks the real adapters and hands them to the use cases. Routes and pages ask this
 * container for a use case; nothing else creates adapters.
 */
function build(db: Db) {
  const conversations = new SqliteConversationRepository(db);
  const messages = new SqliteMessageRepository(db);
  const uow = new SqliteUnitOfWork(db);
  const clock = new SystemClock();
  const ids = new RandomIds();
  const channel = new DemoChannel(messages);
  return {
    receiveCustomerMessage: new ReceiveCustomerMessage({ conversations, messages, uow, clock, ids }),
    sendReply: new SendReply({ conversations, messages, channel, uow, clock, ids }),
    getInbox: new GetInbox({ conversations, messages }),
    getSellerConversation: new GetSellerConversation({ conversations, messages }),
    getCustomerConversation: new GetCustomerConversation({ conversations, messages }),
  };
}

export type Container = ReturnType<typeof build>;

/** One database connection per server process, kept across dev-server reloads. */
const shared = globalThis as typeof globalThis & { chatToOrderDb?: Db };
let instance: Container | undefined;

export function container(): Container {
  shared.chatToOrderDb ??= openDatabase(process.env.DATABASE_PATH || undefined);
  instance ??= build(shared.chatToOrderDb);
  return instance;
}
