import { z } from "zod";
import { container } from "@/server/container";
import { ClientId, MessageText, readJson, respond } from "@/server/http";

const Body = z.object({
  conversationId: z.string().min(1).max(64).nullable(),
  clientId: ClientId,
  text: MessageText,
  /** True when the customer tapped one of the offered options (the text is that option). */
  option: z.boolean().optional(),
});

/** The customer phone sends a message or taps an option. `conversationId: null` starts a new customer. */
export function POST(request: Request): Promise<Response> {
  return respond(async () => container().receiveCustomerMessage.execute(await readJson(request, Body)));
}
