import { z } from "zod";
import { container } from "@/server/container";
import { ClientId, MessageText, readJson, respond } from "@/server/http";

const Body = z.object({
  conversationId: z.string().min(1).max(64).nullable(),
  clientId: ClientId,
  text: MessageText,
});

/** The customer phone sends a message. `conversationId: null` starts a new customer. */
export function POST(request: Request): Promise<Response> {
  return respond(async () => container().receiveCustomerMessage.execute(await readJson(request, Body)));
}
