/** @jest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useUpdateUserMutation } from "../useUpdateUserMutation";
import {
  buildRepRows,
  repDisplayName,
  repLabel,
} from "@/lib/salesPerformance";
import { CreateUserRequestSchema, UpdateUserRequestSchema } from "@/types/api";

let qc: QueryClient;

function wrapper() {
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

function mockFetch(body: unknown, ok = true, status = ok ? 200 : 400) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as jest.Mock;
}

afterEach(() => jest.resetAllMocks());

const updatedUser = {
  id: "u1",
  email: "priya@acme.in",
  name: "Priya Shah",
  role: "sales_manager",
  isActive: true,
  tenantId: "t1",
};

describe("useUpdateUserMutation", () => {
  it("PATCHes /api/users/:id with the supplied body", async () => {
    mockFetch(updatedUser);
    const { result } = renderHook(() => useUpdateUserMutation(), {
      wrapper: wrapper(),
    });

    await result.current.mutateAsync({
      userId: "u1",
      body: { name: "Priya Shah", role: "sales_manager", isActive: true },
    });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/users/u1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Priya Shah",
      role: "sales_manager",
      isActive: true,
    });
  });

  it("url-encodes the user id", async () => {
    mockFetch(updatedUser);
    const { result } = renderHook(() => useUpdateUserMutation(), {
      wrapper: wrapper(),
    });
    await result.current.mutateAsync({ userId: "a/b c", body: { name: "x" } });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "/api/users/a%2Fb%20c",
    );
  });

  it("invalidates the ['users'] query key on success", async () => {
    mockFetch(updatedUser);
    const { result } = renderHook(() => useUpdateUserMutation(), {
      wrapper: wrapper(),
    });
    const spy = jest.spyOn(qc, "invalidateQueries");

    await result.current.mutateAsync({ userId: "u1", body: { name: "x" } });

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["users"] }),
    );
  });

  it("surfaces the backend message on failure", async () => {
    mockFetch({ message: "role must be one of: sales_manager" }, false, 400);
    const { result } = renderHook(() => useUpdateUserMutation(), {
      wrapper: wrapper(),
    });

    await expect(
      result.current.mutateAsync({ userId: "u1", body: { name: "x" } }),
    ).rejects.toThrow("role must be one of: sales_manager");
  });

  it("falls back to a generic message when the error body has no message", async () => {
    mockFetch({}, false, 500);
    const { result } = renderHook(() => useUpdateUserMutation(), {
      wrapper: wrapper(),
    });
    await expect(
      result.current.mutateAsync({ userId: "u1", body: { name: "x" } }),
    ).rejects.toThrow("Failed to update user");
  });
});

describe("user name display", () => {
  it("prefers users.name over the email local-part", () => {
    expect(
      repDisplayName({ name: "Priya Shah", email: "p.shah@acme.in" }),
    ).toBe("Priya Shah");
  });

  it("falls back to the email local-part when name is null/blank/absent", () => {
    expect(repDisplayName({ name: null, email: "p.shah@acme.in" })).toBe(
      "p.shah",
    );
    expect(repDisplayName({ name: "   ", email: "p.shah@acme.in" })).toBe(
      "p.shah",
    );
    expect(repDisplayName({ email: "p.shah@acme.in" })).toBe("p.shah");
    expect(repLabel("p.shah@acme.in")).toBe("p.shah");
  });

  it("buildRepRows carries name through and uses it as the label", () => {
    const rows = buildRepRows({
      users: [
        { id: "u1", email: "p.shah@acme.in", name: "Priya Shah", role: "sales_agent" },
        { id: "u2", email: "legacy@acme.in", name: null, role: "dealer" },
      ],
      visits: [],
      targets: [],
    });

    const byId = Object.fromEntries(rows.map((r) => [r.userId, r]));
    expect(byId.u1.name).toBe("Priya Shah");
    expect(byId.u1.label).toBe("Priya Shah");
    // name stays null so an edit form pre-fills empty, not the derived label
    expect(byId.u2.name).toBeNull();
    expect(byId.u2.label).toBe("legacy");
  });
});

describe("user request schemas", () => {
  it("CreateUserRequestSchema omits a blank name rather than sending ''", () => {
    const parsed = CreateUserRequestSchema.parse({
      email: "a@b.co",
      name: "   ",
      password: "Passw0rd!23",
      role: "sales_agent",
    });
    expect(parsed.name).toBeUndefined();
    expect("name" in JSON.parse(JSON.stringify(parsed))).toBe(false);
  });

  it("CreateUserRequestSchema trims a supplied name and accepts its absence", () => {
    expect(
      CreateUserRequestSchema.parse({
        email: "a@b.co",
        name: "  Priya Shah ",
        password: "Passw0rd!23",
        role: "sales_agent",
      }).name,
    ).toBe("Priya Shah");
    expect(
      CreateUserRequestSchema.safeParse({
        email: "a@b.co",
        password: "Passw0rd!23",
        role: "sales_agent",
      }).success,
    ).toBe(true);
  });

  it("UpdateUserRequestSchema keeps '' (the clear-name signal) and accepts {}", () => {
    expect(UpdateUserRequestSchema.parse({ name: "" }).name).toBe("");
    expect(UpdateUserRequestSchema.parse({})).toEqual({});
  });

  it("UpdateUserRequestSchema rejects an unassignable role", () => {
    expect(
      UpdateUserRequestSchema.safeParse({ role: "builder_admin" }).success,
    ).toBe(false);
  });
});
