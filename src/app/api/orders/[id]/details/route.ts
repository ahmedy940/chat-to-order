import { z } from "zod";
import { ItemField, OrderField } from "@/domain/types";
import { container } from "@/server/container";
import { readJson, respond, type IdParams } from "@/server/http";

const Field = z.enum([...Object.values(ItemField), OrderField.DeliveryFee]);

const Body = z.object({
  itemId: z.string().min(1).max(64).nullable(),
  field: Field,
  value: z.string().max(200),
});

/** The seller types a value on the order card. */
export function PATCH(request: Request, { params }: IdParams): Promise<Response> {
  return respond(async () => {
    const [{ id }, body] = await Promise.all([params, readJson(request, Body)]);
    return container().settleDetail.execute({ orderId: id, ...body });
  });
}
