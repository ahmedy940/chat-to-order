import { connection } from "next/server";
import { z } from "zod";
import { DomainError } from "@/domain/errors";

/** The `{ params }` every `[id]` route receives. */
export interface IdParams {
  params: Promise<{ id: string }>;
}

/** The ID a phone gives each message it sends, so a retry or double tap is saved once. */
export const ClientId = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);

/** Message text before the domain trims and checks it (the domain limit is 1,000 characters). */
export const MessageText = z.string().max(4000);

class InvalidRequest extends DomainError {
  constructor() {
    super("INVALID_REQUEST", "That request wasn't in the expected shape.");
  }
}

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  DRAFT_OUTDATED: 409,
};

/** Every route: run the work at request time, answer JSON, and turn known errors into clear messages. */
export async function respond(work: () => unknown): Promise<Response> {
  await connection();
  try {
    return Response.json(await work());
  } catch (error) {
    return errorResponse(error);
  }
}

/** Reads and checks a JSON body against its Zod schema. */
export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new InvalidRequest();
  return parsed.data;
}

function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    const status = STATUS_BY_CODE[error.code] ?? 422;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
