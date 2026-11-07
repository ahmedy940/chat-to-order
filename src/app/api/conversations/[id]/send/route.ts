import { z } from "zod";
import { container } from "@/server/container";
import { ClientId, MessageText, readJson, respond, type IdParams } from "@/server/http";

const Body = z.object({ clientId: ClientId, text: MessageText });

/** The seller sends a typed reply. (From step 5 it can also send the AI draft.) */
export function POST(request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => {
    const [{ id }, body] = await Promise.all([params, readJson(request, Body)]);
    return container().sendReply.execute({ conversationId: id, ...body });
  });
}
