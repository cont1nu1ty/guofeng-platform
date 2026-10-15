import { afterEach, beforeEach, expect, it, vi } from "vitest";

let storage: Map<string, string>;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_DATA_MODE", "http");
  storage = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each([200, 401])("rejects an old account response (%s) without expiring the new account", async (status) => {
  const auth = await import("../src/utils/auth");
  const { api } = await import("../src/services/http");
  auth.setToken("account-a");
  let finish!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
  const expired = vi.fn();
  window.addEventListener("jiafeng:session-expired", expired);
  const pending = api("/admin/bootstrap");
  auth.removeToken();
  auth.setToken("account-b");
  finish(json({ privateBody: "account-a-only" }, status));
  await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  expect(auth.getToken()).toBe("account-b");
  expect(expired).not.toHaveBeenCalled();
});

it("still accepts an unchanged session response", async () => {
  const auth = await import("../src/utils/auth");
  const { api } = await import("../src/services/http");
  auth.setToken("account-a");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ id: "permitted" })));
  expect(await api("/auth/me")).toEqual({ id: "permitted" });
});

it("clears the local identity even when server logout fails", async () => {
  const auth = await import("../src/utils/auth");
  const { logout, session } = await import("../src/services/session");
  auth.setToken("account-a");
  session.user = { id: "a", name: "甲", roles: ["regional_admin"], regionIds: ["zhejiang"] };
  session.permissions = ["content:read"];
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(logout()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  expect(auth.getToken()).toBeNull();
  expect(session.user).toBeNull();
  expect(session.permissions).toEqual([]);
});

it.each([200, 401])("does not let an old logout (%s) clear a newer account", async (status) => {
  const auth = await import("../src/utils/auth");
  const { logout, session } = await import("../src/services/session");
  auth.setToken("account-a");
  session.user = { id: "a", name: "甲", roles: [], regionIds: [] };
  let finish!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
  const pending = logout();
  auth.setToken("account-b");
  session.user = { id: "b", name: "乙", roles: [], regionIds: ["beijing"] };
  session.permissions = ["content:read"];
  finish(json({}, status));
  await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  expect(auth.getToken()).toBe("account-b");
  expect(session.user?.id).toBe("b");
  expect(session.permissions).toEqual(["content:read"]);
});
