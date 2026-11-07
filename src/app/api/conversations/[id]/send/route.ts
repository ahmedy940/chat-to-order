import { z } from "zod";
import { container } from "@/server/container";
import { ClientId, MessageText, readJson, respond, type IdParams } from "@/server/http";

const Body = z.object({
  clientId: ClientId,
  text: MessageText,
  draftId: z.string().min(1).max(64).nullable().optional(),
});

/** The seller sends a typed reply, or the draft waiting in the reply box (`draftId`). */
export function POST(request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => {
    const [{ id }, body] = await Promise.all([params, readJson(request, Body)]);
    return container().sendReply.execute({ conversationId: id, ...body });
  });
}
