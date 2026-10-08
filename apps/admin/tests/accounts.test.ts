import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountFieldErrors, emptyAccountFields } from "../src/domain/accounts";

describe("account administration fields", () => {
  it("does not grant a new expert account before a material review", () => {
    const fields = { ...emptyAccountFields(), username: "expert_new", name: "审核样例", organization: "测试机构",
      roles: ["expert"], regionIds: ["zhejiang"], password: "Example-only-pass-2026" };
    expect(accountFieldErrors("create", fields)).toHaveProperty("roles");
    expect(accountFieldErrors("roles", fields)).toEqual({});
  });
  it("keeps scope and password validation independent from a national role", () => {
    const fields = { ...emptyAccountFields(), roles: ["content_operator"] };
    expect(accountFieldErrors("roles", fields)).toHaveProperty("regionIds");
    fields.roles = ["national_admin"];
    expect(accountFieldErrors("roles", fields)).toEqual({});
    fields.password = "汉".repeat(25) + "1";
    expect(accountFieldErrors("resetPassword", fields)).toHaveProperty("password");
  });
  it("requires a source for submitted material and a reason for a review", () => {
    const fields = { ...emptyAccountFields(), summary: "已收到盖章材料副本" };
    expect(accountFieldErrors("materials", fields)).toHaveProperty("materialReference");
    fields.materialReference = "内部档案编号 TEST-001";
    expect(accountFieldErrors("materials", fields)).toEqual({});
    fields.summary = "通过";
    expect(accountFieldErrors("review", fields)).toHaveProperty("summary");
  });
});

describe("account requests", () => {
  beforeEach(() => {
    vi.resetModules(); vi.stubEnv("VITE_DATA_MODE", "http"); vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    vi.stubGlobal("window", new EventTarget());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("uses server filters and retains a snapshot plus idempotency key when retrying", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetcher);
    const { prepareAccountChange, listAccounts } = await import("../src/services/accounts");
    await listAccounts({ query: "名&字", role: "review_manager", region: "zhejiang", status: "pending", page: 2, pageSize: 20 });
    const url = new URL(fetcher.mock.calls[0]![0], "http://test.local");
    expect(url.searchParams.get("query")).toBe("名&字");
    expect(url.searchParams.get("page")).toBe("2");
    const data = { version: 3, roles: ["review_manager"], regionIds: ["zhejiang"] };
    const retry = prepareAccountChange("roles", "10001", data);
    await retry(); data.roles = ["national_admin"]; await retry();
    const first = fetcher.mock.calls[1]![1], second = fetcher.mock.calls[2]![1];
    expect(first.headers.get("Idempotency-Key")).toBe(second.headers.get("Idempotency-Key"));
    expect(JSON.parse(second.body)).toMatchObject({ version: 3, roles: ["review_manager"] });
  });
});
