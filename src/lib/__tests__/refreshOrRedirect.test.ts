import {
  doRefresh,
  refreshOrRedirect,
  __resetRefreshPromiseForTests,
} from "@/lib/api";

describe("doRefresh", () => {
  beforeAll(() => {
    process.env.REOS_API_BASE_URL = "http://backend.test";
  });

  beforeEach(() => {
    __resetRefreshPromiseForTests();
    jest.clearAllMocks();
  });

  it("returns { accessToken } on success", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        accessToken: "new-token",
        refreshToken: "rt",
        expiresIn: 900,
      }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const result = await doRefresh("test-token");

    expect(result).toEqual({ accessToken: "new-token", refreshToken: "rt" });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://backend.test/auth/refresh",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "test-token" }),
        cache: "no-store",
      }),
    );
  });

  it("returns null on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await doRefresh("test-token");

    expect(result).toBeNull();
  });

  it("returns null on non-2xx upstream response", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const result = await doRefresh("test-token");

    expect(result).toBeNull();
  });

  it("returns null on malformed body (schema mismatch)", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ unexpected: 1 }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const result = await doRefresh("test-token");

    expect(result).toBeNull();
  });

  it("returns null on empty refresh token without calling fetch", async () => {
    global.fetch = jest.fn();

    const result = await doRefresh("");

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("refreshOrRedirect", () => {
  beforeAll(() => {
    process.env.REOS_API_BASE_URL = "http://backend.test";
  });

  beforeEach(() => {
    __resetRefreshPromiseForTests();
    jest.clearAllMocks();
  });

  it("concurrent callers share one refresh attempt", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveJson: (value: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deferredJson = new Promise<any>((resolve) => {
      resolveJson = resolve;
    });

    const mockResponse = {
      ok: true,
      json: jest.fn(() => deferredJson),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    // Call both refreshOrRedirect in the same synchronous tick (no await between them)
    const promise1 = refreshOrRedirect("rt");
    const promise2 = refreshOrRedirect("rt");

    // Resolve the json() deferred
    resolveJson!({
      accessToken: "new-token",
      refreshToken: "rt",
      expiresIn: 900,
    });

    const result1 = await promise1;
    const result2 = await promise2;

    // Both callers should receive the same value (deep equal)
    expect(result1).toEqual({ accessToken: "new-token", refreshToken: "rt" });
    expect(result2).toEqual({ accessToken: "new-token", refreshToken: "rt" });
    // fetch should have been called exactly once (deduplication)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("singleton is released after settle", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        accessToken: "new-token",
        refreshToken: "rt",
        expiresIn: 900,
      }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    // First refresh
    const result1 = await refreshOrRedirect("rt");
    expect(result1).toEqual({ accessToken: "new-token", refreshToken: "rt" });

    // Second independent call should trigger a new fetch
    const result2 = await refreshOrRedirect("rt");
    expect(result2).toEqual({ accessToken: "new-token", refreshToken: "rt" });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("concurrent failure: no unhandled rejection", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("boom"));

    let unhandledRejectionFired = false;
    const listener = () => {
      unhandledRejectionFired = true;
    };
    process.on("unhandledRejection", listener);

    try {
      const promises = [
        refreshOrRedirect("rt"),
        refreshOrRedirect("rt"),
        refreshOrRedirect("rt"),
      ];
      const results = await Promise.all(promises);

      expect(results).toEqual([null, null, null]);
      // Give event loop a chance to fire unhandledRejection if it would
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandledRejectionFired).toBe(false);
    } finally {
      process.removeListener("unhandledRejection", listener);
    }
  });
});
