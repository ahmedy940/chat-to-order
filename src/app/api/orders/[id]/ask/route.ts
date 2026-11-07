import { z } from "zod";
import { ItemField, MAX_OPTIONS, OrderField } from "@/domain/types";
import { container } from "@/server/container";
import { readJson, respond, type IdParams } from "@/server/http";

const Body = z.object({
  itemId: z.string().min(1).max(64).nullable(),
  field: z.enum([...Object.values(ItemField), OrderField.DeliveryFee]),
  options: z.array(z.string().max(40)).min(1).max(MAX_OPTIONS),
});

/** Ask customer: offer up to 3 options for a missing detail; the AI rewrites the question in the reply box. */
export function POST(request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => {
    const [{ id }, body] = await Promise.all([params, readJson(request, Body)]);
    return container().askCustomer.execute({ orderId: id, ...body });
  });
}
