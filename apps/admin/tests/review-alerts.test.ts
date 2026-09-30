import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_DATA_MODE", "http");
  vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const payload = {
  items: [],
  total: 0,
  page: 2,
  pageSize: 10,
  serverNow: "2026-09-30T00:00:00Z",
  unreadCount: 7,
  notifications: [
    {
      id: "notice-1",
      targetId: "task-1",
      sourceType: "review-task",
      title: "即将截止",
      content: "请完成评分",
      createdAt: "2026-09-30T00:00:00Z",
      read: false,
    },
  ],
};
const json = () =>
  new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
describe("本人提醒读取边界", () => {
  it("通过服务端分页和权限范围查询，并使用独立完整未读计数", async () => {
    const { fetchReviewAlerts, reviewNotices } = await import(
      "../src/services/reviewAlerts"
    );
    const fetch = vi.fn().mockResolvedValue(json());
    vi.stubGlobal("fetch", fetch);
    await fetchReviewAlerts({
      page: 2,
      pageSize: 10,
      phase: "overdue",
      scope: "mine",
      unreadOnly: true,
    });
    expect(fetch.mock.calls[0]![0]).toBe(
      "/api/v1/admin/review-alerts?page=2&pageSize=10&phase=overdue&scope=mine&unreadOnly=true",
    );
    expect(reviewNotices.unreadCount).toBe(7);
    expect(reviewNotices.items[0]?.targetId).toBe("task-1");
  });
  it("退出账号后，较早发出的网络响应不能重新填入前一个账号的提醒", async () => {
    const { fetchReviewAlerts, clearReviewNotices, reviewNotices } =
      await import("../src/services/reviewAlerts");
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const pending = fetchReviewAlerts();
    clearReviewNotices();
    resolve(json());
    await pending;
    expect(reviewNotices.items).toHaveLength(0);
    expect(reviewNotices.unreadCount).toBe(0);
  });
});
