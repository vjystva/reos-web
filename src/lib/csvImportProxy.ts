import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { ImportCsvResultSchema } from "@/types/api";
import { isDemoRequest } from "@/lib/demo";

/**
 * Shared multipart passthrough for every `import/csv` BFF route.
 *
 * Extracted verbatim from `src/app/api/leads/import/route.ts`, which was the
 * first and only importer. All five backend importers expose the identical
 * contract — multipart field `file`, 5 MB cap, 500-row cap, response
 * `{ imported, rejected[] }` — so the five routes differ ONLY in the upstream
 * path (and, for units, a project id in it).
 *
 * The multipart body is re-encoded here as a byte buffer rather than forwarded
 * as a `FormData` instance because `proxyFetch()` may replay the request once
 * after a token refresh — a buffer is safely re-sendable, a consumed stream is
 * not. Do not "simplify" this to forwarding `req.body`.
 */

/** Mirrors the backend's FileInterceptor limit (`CSV_MAX_FILE_BYTES`). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function encodeMultipart(
  fieldName: string,
  filename: string,
  bytes: Uint8Array,
) {
  const boundary = `----reosImport${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const safeName = filename.replace(/["\r\n]/g, "");
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${safeName}"\r\n` +
      `Content-Type: text/csv\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  // Allocate through an explicit ArrayBuffer so the view types as
  // `Uint8Array<ArrayBuffer>` — the exact BufferSource `fetch` accepts.
  const body = new Uint8Array(
    new ArrayBuffer(head.length + bytes.length + tail.length),
  );
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/** Demo mode has no upstream — count the data rows so the flow still works. */
function demoResult(csvText: string) {
  const rows = csvText
    .split(/\r\n|\r|\n/)
    .slice(1)
    .filter((line) => line.trim() !== "");
  return {
    imported: rows.length,
    rejected: [] as { row: number; reason: string }[],
  };
}

export interface CsvImportProxyOptions {
  /** Filename used when the uploaded part carries none. Cosmetic. */
  defaultFilename?: string;
}

/**
 * Reads the `file` part, validates size, and forwards it to `backendPath`.
 *
 * Upstream 4xx bodies are passed through verbatim — they carry the actionable
 * text ("Missing required column: unit_number", "CSV exceeds 500-row limit")
 * that the import screen shows the user.
 */
export async function handleCsvImportProxy(
  req: NextRequest,
  backendPath: string,
  opts: CsvImportProxyOptions = {},
): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = form.get("file");
  if (
    !file ||
    typeof file === "string" ||
    typeof file.arrayBuffer !== "function"
  ) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  if (isDemoRequest(req)) {
    return NextResponse.json(demoResult(Buffer.from(bytes).toString("utf8")), {
      status: 200,
    });
  }

  const filename =
    "name" in file && file.name ? file.name : (opts.defaultFilename ?? "import.csv");
  const { body, contentType } = encodeMultipart("file", filename, bytes);

  const upstream = await proxyFetch(req, backendPath, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try {
      errBody = await upstream.json();
    } catch {
      /* keep default */
    }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  const parsed = ImportCsvResultSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
