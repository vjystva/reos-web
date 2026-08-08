/**
 * Turns a failed BFF/backend JSON error body into a message worth showing.
 *
 * The three shapes in play across this app:
 *
 *   BFF zod failure     { error: "validation_error",
 *                         details: { fieldErrors: { targetDealerId: ["…"] } } }
 *   Nest DTO failure    { statusCode: 400, message: ["…", "…"], error: "…" }
 *   Nest thrown error   { statusCode: 404, message: "Routing rule not found" }
 *
 * Reading `body.message ?? body.error` (the previous idiom) collapses the first
 * shape to the literal string "validation_error", which is what a user saw when
 * Save failed — no indication of WHICH field was rejected. Field errors are
 * unpacked here so the banner names the offending field instead.
 */
export async function extractApiErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
    error?: string;
    details?: {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };
  };

  const fieldErrors = body.details?.fieldErrors;
  if (fieldErrors) {
    const parts = Object.entries(fieldErrors)
      .flatMap(([field, msgs]) => (msgs ?? []).map((m) => `${field}: ${m}`));
    const formErrors = body.details?.formErrors ?? [];
    const all = [...parts, ...formErrors];
    if (all.length > 0) return all.join("; ");
  }

  if (Array.isArray(body.message)) return body.message.join(", ");
  if (body.message) return body.message;
  if (body.error) return body.error;
  return fallback;
}
