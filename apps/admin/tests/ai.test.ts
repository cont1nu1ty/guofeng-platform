import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_DATA_MODE", "http");
  vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
  vi.stubGlobal("sessionStorage", { getItem: () => "test-token", setItem: vi.fn(), removeItem: vi.fn() });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const task = { id: "task-1", mode: "review" as const, status: "queued" as const, createdAt: "2026-10-13T08:00:00Z", submissionId: "work-1", sourceVersion: 7 };

describe("AI admin service boundary", () => {
  it("recovers the newest authorized manuscript task with reads only", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ items: [{ ...task, id: "other", submissionId: "work-2" }, { ...task, id: "newest" }, { ...task, id: "older" }] }))
      .mockResolvedValueOnce(json({ ...task, id: "newest", status: "succeeded", result: "已有摘要" }));
    vi.stubGlobal("fetch", fetcher);
    const { session } = await import("../src/services/session");
    session.permissions = ["ai:read"];
    const { readLatestSubmissionTask } = await import("../src/services/ai");
    expect(await readLatestSubmissionTask("work-1")).toMatchObject({ id: "newest", result: "已有摘要" });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/api/v1/admin/ai/tasks", "/api/v1/ai/tasks/newest"]);
    expect(fetcher.mock.calls.every(([, options]) => !options.method || options.method === "GET")).toBe(true);
  });
  it("restores the operator's own manuscript task without requiring AI operations permission", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ items: [{ ...task, id: "own-task" }] }))
      .mockResolvedValueOnce(json({ ...task, id: "own-task", status: "succeeded", result: "本人已生成摘要" }));
    vi.stubGlobal("fetch", fetcher);
    const { session } = await import("../src/services/session");
    session.permissions = ["submissions:read", "submissions:write"];
    const { readLatestSubmissionTask } = await import("../src/services/ai");
    expect(await readLatestSubmissionTask("work-1")).toMatchObject({ id: "own-task", result: "本人已生成摘要" });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/api/v1/ai/tasks", "/api/v1/ai/tasks/own-task"]);
  });
  it("sends manuscript identity and lock version without browser manuscript text", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(task)); vi.stubGlobal("fetch", fetcher);
    const { analyseSubmission } = await import("../src/services/ai");
    await analyseSubmission("work-1", 7, "review");
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("/api/v1/ai/tasks");
    expect(JSON.parse(options.body)).toMatchObject({ mode: "review", submissionId: "work-1", version: 7 });
    expect(JSON.parse(options.body)).not.toHaveProperty("text");
    expect(options.headers.get("Idempotency-Key")).toBeTruthy();
    expect(options.headers.get("Authorization")).toBe("Bearer test-token");
  });
  it("reuses an uncertain creation key and scopes it to the current account", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(() => Promise.resolve(json(task))); vi.stubGlobal("fetch", fetcher);
    const { analyseSubmission } = await import("../src/services/ai");
    const { session } = await import("../src/services/session");
    session.user = { id: "one", name: "one", roles: [], regionIds: [] };
    await expect(analyseSubmission("work-1", 7, "review")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await analyseSubmission("work-1", 7, "review");
    const firstKey = fetcher.mock.calls[0]![1].headers.get("Idempotency-Key");
    expect(fetcher.mock.calls[1]![1].headers.get("Idempotency-Key")).toBe(firstKey);
    session.user.id = "two";
    await analyseSubmission("work-1", 7, "review");
    expect(fetcher.mock.calls[2]![1].headers.get("Idempotency-Key")).not.toBe(firstKey);
  });
  it("keeps private inputs and outputs out of administrative metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ items: [{ ...task, result: "私人家书正文", input: "私人请求", citations: [{ excerpt: "私有片段" }], issues: [{ quote: "私人正文" }], error: { code: "AI_PROVIDER_ERROR", message: "供应商回显私人文字" } }] })));
    const { readAiTasks } = await import("../src/services/ai");
    const result = await readAiTasks();
    expect(result.items[0]).toMatchObject({ id: task.id, sourceVersion: 7, error: { code: "AI_PROVIDER_ERROR", message: "" } });
    expect(JSON.stringify(result)).not.toMatch(/私人|私有/);
    expect(result.items[0]).not.toHaveProperty("result");
    expect(result.items[0]).not.toHaveProperty("citations");
  });
  it("reports terminal failure without fabricating a result and stops polling after cancellation", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ ...task, status: "failed", error: { code: "AI_UNAVAILABLE", message: "模型不可用" } })); vi.stubGlobal("fetch", fetcher);
    const { waitForAiTask } = await import("../src/services/ai");
    const finished = await waitForAiTask(task, { interval: 0 });
    expect(finished.status).toBe("failed"); expect(finished.result).toBeUndefined();
    const controller = new AbortController(); controller.abort();
    await expect(waitForAiTask(task, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("sends explicit knowledge audience/version and prevents using analysis from a different revision", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(json({ ...task, mode: "index" }))); vi.stubGlobal("fetch", fetcher);
    const { indexKnowledge, withdrawKnowledge, isTaskStale } = await import("../src/services/ai");
    await indexKnowledge("kb/1", 4, "staff", "en");
    expect(fetcher.mock.calls[0]![0]).toBe("/api/v1/admin/ai/knowledge/kb%2F1/index");
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ version: 4, audience: "staff", language: "en" });
    await withdrawKnowledge("kb/1", 5);
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual({ version: 5 });
    expect(isTaskStale(task, "work-1", 7)).toBe(false);
    expect(isTaskStale(task, "work-1", 8)).toBe(true);
    expect(isTaskStale(task, "work-2", 7)).toBe(true);
    expect(isTaskStale({ ...task, sourceVersion: undefined }, "work-1", 7)).toBe(true);
  });
});
