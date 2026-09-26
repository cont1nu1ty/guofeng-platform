import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_DATA_MODE", "http");
  vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
  storage = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function fixture() {
  const data = await import("../src/services/workspaceData");
  const review = await import("../src/domain/review");
  const editorial = await import("../src/domain/editorial");
  const ops = await import("../src/domain/operations");
  const workspace = {
    ...Object.fromEntries(Object.keys(data.arrayTargets).map((key) => [key, []])),
    reviewFlow: review.reviewFlow,
    scoringDimensions: review.scoringDimensions,
    platformConfig: ops.platformConfig,
    permissions: ["content:read", "content:write"],
    roles: ["regional_admin"],
  } as unknown as import("../src/services/workspaceData").WorkspaceData;
  return { data, review, editorial, workspace };
}
describe("real admin boundary", () => {
  it("uses catalog entity versions, retains the editor's version, and reconciles homepage configuration", async () => {
    const { data, workspace } = await fixture();
    const catalog = await import("../src/domain/catalog");
    workspace.banners = [
      {
        id: "B1",
        title: "家书季",
        region: "浙江省",
        language: "zh",
        status: "草稿",
        sortOrder: 1,
        sample: true,
        lockVersion: 7,
      },
    ];
    workspace.homepageConfig = {
      sections: [{ id: "news", enabled: true, order: 0 }],
      lockVersion: 4,
    };
    data.applyWorkspace(workspace);
    expect(data.versionOf("B1", "banners")).toBe(7);
    expect(catalog.homepageConfig.lockVersion).toBe(4);
    const request = vi
      .fn()
      .mockResolvedValue(json({ result: { ok: true }, workspace }));
    vi.stubGlobal("fetch", request);
    await data.command("saveBanner", { title: "修改内容" }, "B1", 6);
    expect(JSON.parse(request.mock.calls[0]![1].body)).toMatchObject({
      command: "saveBanner",
      entityId: "B1",
      version: 6,
    });
    data.clearWorkspace();
    expect(catalog.catalogState.banners).toHaveLength(0);
    expect(catalog.homepageConfig.sections).toHaveLength(0);
    expect(catalog.homepageConfig.lockVersion).toBeUndefined();
  });
  it("uses the dedicated media upload purpose without changing submission-file uploads", async () => {
    const { uploadFile } = await import("../src/services/files");
    const request = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(json({ fileId: "F1", name: "朗读.mp3" })),
      );
    vi.stubGlobal("fetch", request);
    await uploadFile(new File(["audio"], "朗读.mp3"), "media");
    expect(request.mock.calls[0]![0]).toBe("/api/v1/files?purpose=media");
    expect(request.mock.calls[0]![1].body).toBeInstanceOf(FormData);
    await uploadFile(new File(["picture"], "封面.png"));
    expect(request.mock.calls[1]![0]).toBe("/api/v1/files");
  });
  it("opens a regional session in its first authorized region and preserves manual filters after writes", async () => {
    const { data, workspace: response } = await fixture();
    const { session } = await import("../src/services/session");
    const { workspace } = await import("../src/domain/workspace");
    session.user = {
      id: "regional-admin",
      name: "区域运营",
      roles: ["regional_admin"],
      regionIds: ["unknown", "sichuan", "zhejiang"],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(response)));
    await data.loadWorkspace();
    expect(workspace.region).toBe("四川省");
    workspace.region = "浙江省";
    data.applyWorkspace(response);
    expect(workspace.region).toBe("浙江省");
    response.roles = ["national_admin"];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(response)));
    await data.loadWorkspace();
    expect(workspace.region).toBe("全国");
  });
  it("allows reassignment after completed, cancelled, or expired tasks but blocks an active pending task", async () => {
    const { hasBlockingReviewTask } = await import("../src/domain/assignment");
    const now = Date.parse("2026-09-26T12:00:00+08:00");
    const task = {
      submissionId: "work-1",
      expertId: "expert-1",
      dueAt: "2026-09-26T04:00:00.001Z",
      status: "待评分" as const,
    };
    const blocks = (tasks: Parameters<typeof hasBlockingReviewTask>[0], http = true) =>
      hasBlockingReviewTask(tasks, "work-1", "expert-1", http, now);
    expect(blocks([task])).toBe(true);
    expect(blocks([{ ...task, status: "已完成" }])).toBe(false);
    expect(blocks([{ ...task, status: "已取消" }])).toBe(false);
    expect(blocks([{ ...task, dueAt: "2026-09-26T03:59:59.999Z" }])).toBe(false);
    // The backend allows reassignment at the exact deadline, across timezone offsets.
    expect(blocks([{ ...task, dueAt: "2026-09-26T04:00:00Z" }])).toBe(false);
    expect(blocks([{ ...task, expertId: "expert-2" }])).toBe(true);
    expect(blocks([{ ...task, submissionId: "work-2" }])).toBe(false);
    expect(blocks([{ ...task, status: "已完成" }], false)).toBe(true);
    expect(blocks([{ ...task, dueAt: "2026-09-26T03:59:59.999Z" }], false)).toBe(true);
    expect(blocks([{ ...task, expertId: "expert-2" }], false)).toBe(false);
  });
  it("starts with empty business state and never shows seed data after a failed load", async () => {
    const { data, review, editorial } = await fixture();
    expect(review.reviewState.submissions).toHaveLength(0);
    expect(editorial.editorialState.contents).toHaveLength(0);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(data.loadWorkspace()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(review.reviewState.submissions).toHaveLength(0);
    expect((await import("../src/services/http")).connection.loading).toBe(false);
  });
  it("sends lockVersion and idempotency key and hydrates the authoritative saved item in place", async () => {
    const { data, editorial, workspace } = await fixture();
    const record = {
      id: "C1",
      title: "原内容",
      category: "资讯" as const,
      region: "浙江省",
      language: "简体中文",
      summary: "原有摘要文字",
      body: "原有正文内容足够十个字",
      status: "草稿" as const,
      author: "编辑",
      updatedAt: "2026-09-26T08:00:00+08:00",
      views: 0,
      lockVersion: 4,
    };
    workspace.contents = [record] as typeof workspace.contents;
    data.applyWorkspace(workspace);
    const before = editorial.editorialState.contents[0]!;
    const next = { ...record, title: "服务端保存结果", lockVersion: 5 };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({ result: next, workspace: { ...workspace, contents: [next] } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    storage.set("Jiafeng-Admin-Token", "test-token");
    await (
      await import("../src/services/actions")
    ).saveContent({ ...record, title: "本地编辑内容" }, record.id);
    const [, options] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(options.body)).toMatchObject({
      command: "saveContent",
      entityId: "C1",
      version: 4,
    });
    expect(options.headers.get("Authorization")).toBe("Bearer test-token");
    expect(options.headers.get("Idempotency-Key")).toBeTruthy();
    expect(editorial.editorialState.contents[0]).toBe(before);
    expect(before.title).toBe("服务端保存结果");
  });
  it("does not mutate or report success when a write is denied", async () => {
    const { data, workspace } = await fixture();
    workspace.permissions = [];
    data.applyWorkspace(workspace);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          json({ code: "FORBIDDEN", message: "超出地区权限", requestId: "R17" }, 403),
        ),
    );
    await expect(
      (await import("../src/services/actions")).saveNotificationDraft({
        title: "通知标题",
        content: "足够长度的通知内容用于测试",
        audience: "区域运营",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", requestId: "R17" });
    expect((await import("../src/domain/operations")).notificationDrafts).toHaveLength(
      0,
    );
    expect((await import("../src/services/http")).connection).toMatchObject({
      pending: 0,
      error: "超出地区权限",
      requestId: "R17",
    });
  });
  it("clears the token on expired sessions and permission matching fails closed", async () => {
    const { api } = await import("../src/services/http");
    const { can, session } = await import("../src/services/session");
    storage.set("Jiafeng-Admin-Token", "expired");
    const expired = vi.fn();
    window.addEventListener("jiafeng:session-expired", expired);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          json({ code: "UNAUTHENTICATED", message: "登录已失效" }, 401),
        ),
    );
    await expect(api("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(storage.size).toBe(0);
    expect(expired).toHaveBeenCalledOnce();
    expect(can("content:read")).toBe(false);
    session.permissions = ["reviews:read"];
    expect(can("content:read")).toBe(false);
    expect(can("reviews:read")).toBe(true);
  });
  it("rejects HTML successful responses instead of treating the frontend fallback as API data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>fallback</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );
    await expect(
      (await import("../src/services/http")).api("/admin/workspace"),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("reuses the logical idempotency key after an uncertain network outcome", async () => {
    const { data, workspace } = await fixture();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection lost"))
      .mockResolvedValueOnce(
        json({ result: { ok: true, message: "已保存" }, workspace }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      data.command("saveNotificationDraft", {
        title: "测试",
        content: "测试请求",
      }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await data.command("saveNotificationDraft", {
      title: "测试",
      content: "测试请求",
    });
    expect(fetchMock.mock.calls[0]![1].headers.get("Idempotency-Key")).toBe(
      fetchMock.mock.calls[1]![1].headers.get("Idempotency-Key"),
    );
  });
  it("blocks duplicate clicks while a command is still pending", async () => {
    const { data, workspace } = await fixture();
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const first = data.command("saveContent", { title: "测试内容" });
    await expect(
      data.command("saveContent", { title: "测试内容" }),
    ).rejects.toMatchObject({ code: "OPERATION_IN_PROGRESS" });
    expect(fetchMock).toHaveBeenCalledOnce();
    finish(json({ result: { id: "c1" }, workspace }));
    await first;
  });
});
