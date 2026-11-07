import { NextActionPolicy, type AgentProposalDraft } from "@/domain/NextActionPolicy";
import type { Order } from "@/domain/Order";
import { newEvent } from "@/domain/OrderEvent";
import { Proposal } from "@/domain/Proposal";
import { Actor, EventType, Intent, ORDER_STATUS_LABELS, ProposalKind } from "@/domain/types";
import { toChat } from "./orderText";
import type { OrderDeps } from "./orderSupport";
import type { AiProvider, IntentOutput } from "./ports/AiProvider";
import type { ConversationRepository } from "./ports/ConversationRepository";
import type { MessageRepository } from "./ports/MessageRepository";
import type { ProposalRepository } from "./ports/ProposalRepository";

interface Deps extends Pick<OrderDeps, "orders" | "events" | "uow" | "clock" | "ids"> {
  conversations: ConversationRepository;
  messages: MessageRepository;
  proposals: ProposalRepository;
  ai: AiProvider;
}

/** The AI reads only the end of the chat to say what the customer wants now. */
const RECENT_LINES = 6;

/**
 * The agent pass: after each customer message (and after Read order), propose at most one next step for the
 * seller to approve. It runs once per message, and a per-conversation lock stops two polls running it twice.
 * The AI only says what the customer wants; the policy decides what may be proposed. If the AI is down, nothing
 * is proposed and the order card's buttons still work.
 */
export class ProposeNextAction {
  private readonly running = new Set<string>();
  private readonly policy = new NextActionPolicy();

  constructor(private readonly deps: Deps) {}

  /** For the inbox poll: every conversation with a customer message the agent hasn't looked at. */
  async runPending(): Promise<void> {
    const pending = this.deps.conversations.list().filter((c) => c.needsAgentPass());
    for (const conversation of pending) await this.execute(conversation.id);
  }

  async execute(conversationId: string): Promise<void> {
    const conversation = this.deps.conversations.get(conversationId);
    const messageId = conversation?.needsAgentPass() ? conversation.lastCustomerMessageId : null;
    if (!messageId || this.running.has(conversationId)) return;
    this.running.add(conversationId);
    try {
      const intent = await this.intentFor(conversationId);
      this.deps.uow.run(() => this.decide(conversationId, messageId, intent));
    } finally {
      this.running.delete(conversationId);
    }
  }

  private async intentFor(conversationId: string): Promise<IntentOutput | null> {
    const order = this.deps.orders.latestForConversation(conversationId);
    if (!order) return null;
    if (!this.policy.needsIntent(order)) return { intent: Intent.OrderDetails, quote: null };
    const chat = toChat(this.deps.messages.listByConversation(conversationId)).slice(-RECENT_LINES);
    try {
      return await this.deps.ai.classifyIntent({ chat, orderStatus: ORDER_STATUS_LABELS[order.status] });
    } catch {
      return null;
    }
  }

  private decide(conversationId: string, messageId: string, intent: IntentOutput | null): void {
    const { conversations, orders, proposals } = this.deps;
    const conversation = conversations.get(conversationId);
    // A newer message arrived while the AI was thinking: the next poll handles that one instead.
    if (!conversation || conversation.lastCustomerMessageId !== messageId) return;
    const order = orders.latestForConversation(conversationId);
    const draft = this.policy.propose({
      intent: intent?.intent ?? null,
      quote: intent?.quote ?? null,
      order,
    });
    proposals.dropOpen(conversationId);
    if (draft && order) this.open(order, messageId, draft);
    conversation.markHandled(messageId);
    conversations.save(conversation);
  }

  private open(order: Order, messageId: string, draft: AgentProposalDraft): void {
    const { proposals, events, ids, clock } = this.deps;
    const origin = { conversationId: order.conversationId, orderId: order.id, messageId, time: clock.now() };
    proposals.save(Proposal.open(ids.newId(), origin, draft));
    if (draft.kind !== ProposalKind.Refund) return;
    const event = newEvent(EventType.RefundProposed, Actor.Agent, draft.reason, { quote: draft.quote });
    events.append(order.id, event, clock.now());
  }
}
