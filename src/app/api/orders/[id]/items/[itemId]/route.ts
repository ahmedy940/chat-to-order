import { container } from "@/server/container";
import { respond } from "@/server/http";

interface ItemParams {
  params: Promise<{ id: string; itemId: string }>;
}

/** The seller removes an item line from the order card (for example one added by mistake). */
export function DELETE(_request: Request, { params }: ItemParams): Promise<Response> {
  return respond(async () => {
    const { id, itemId } = await params;
    return container().removeItem.execute({ orderId: id, itemId });
  });
}
