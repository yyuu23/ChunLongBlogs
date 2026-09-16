import { z } from "zod";

export class PublicWriteError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

export async function readJson<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
  maxBytes = 16 * 1024,
): Promise<z.infer<TSchema>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new PublicWriteError(415, "unsupported_media_type");
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PublicWriteError(413, "payload_too_large");
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new PublicWriteError(413, "payload_too_large");

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new PublicWriteError(400, "invalid_json");
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new PublicWriteError(400, "invalid");
  return parsed.data;
}
