import { POST, GET } from "@/app/api/auth/logout/route";

describe("logout route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure fetch is available as a jest.fn for test 2
    global.fetch = jest.fn();
  });

  describe("POST", () => {
    it("clears both cookies and returns 204", async () => {
      const res = await POST();

      expect(res.status).toBe(204);

      const cookieHeader = res.headers.get("set-cookie") ?? "";
      expect(cookieHeader).toMatch(/reos_token=;.*Max-Age=0/);
      expect(cookieHeader).toMatch(/reos_refresh=;.*Max-Age=0/);
      expect(cookieHeader).toMatch(/HttpOnly/i);
      expect(cookieHeader).toMatch(/SameSite=lax/i);
    });

    it("makes no upstream backend call", async () => {
      global.fetch = jest.fn();

      await POST();

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(0);
    });
  });

  describe("GET", () => {
    it("returns 405 with method_not_allowed error", async () => {
      const res = await GET();

      expect(res.status).toBe(405);
      const json = await res.json();
      expect(json).toEqual({ error: "method_not_allowed" });
    });
  });
});
