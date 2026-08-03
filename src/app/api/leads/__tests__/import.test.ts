import { NextRequest } from "next/server";
import { POST } from "@/app/api/leads/import/route";

const CSV = "first_name,last_name,phone\nRahul,Sharma,9876543210";

function makeRequest(form: FormData): NextRequest {
  const req = new NextRequest("http://localhost/api/leads/import", {
    method: "POST",
    body: form,
  });
  req.cookies.set("reos_token", "test-access-token");
  return req;
}

function csvForm(text = CSV, filename = "leads.csv"): FormData {
  const form = new FormData();
  form.append("file", new Blob([text], { type: "text/csv" }), filename);
  return form;
}

function upstreamJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/leads/import", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("rejects a request without a file part", async () => {
    const res = await POST(makeRequest(new FormData()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "file_required" });
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(0);
  });

  it("rejects an empty file", async () => {
    const res = await POST(makeRequest(csvForm("")));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "empty_file" });
  });

  it("forwards a multipart body to /leads/import/csv and returns the result", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      upstreamJson({ imported: 2, rejected: [{ row: 4, reason: "missing phone" }] }),
    );

    const res = await POST(makeRequest(csvForm()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      imported: 2,
      rejected: [{ row: 4, reason: "missing phone" }],
    });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/leads\/import\/csv$/);
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toMatch(
      /^multipart\/form-data; boundary=/,
    );
    expect(headers.get("authorization")).toBe("Bearer test-access-token");

    const body = Buffer.from(init.body as Uint8Array).toString("utf8");
    expect(body).toContain('name="file"; filename="leads.csv"');
    expect(body).toContain(CSV);
  });

  it("passes an upstream 400 message through verbatim", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      upstreamJson(
        { statusCode: 400, message: "Missing required column: first_name" },
        400,
      ),
    );

    const res = await POST(makeRequest(csvForm()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      statusCode: 400,
      message: "Missing required column: first_name",
    });
  });

  it("returns 502 when the upstream payload has the wrong shape", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(upstreamJson({ ok: true }));

    const res = await POST(makeRequest(csvForm()));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream_shape_mismatch" });
  });

  it("returns 401 when the upstream rejects and refresh fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response("", { status: 401 }),
    );

    const res = await POST(makeRequest(csvForm()));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});
