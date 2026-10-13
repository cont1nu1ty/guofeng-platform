// Contract simulation only: does not claim model or backend integration evidence.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("fs");
const assert = require("assert/strict");
const base = process.env.ADMIN_TEST_URL || "http://127.0.0.1:5181/admin/";
const output = process.env.ADMIN_TEST_OUTPUT || "/tmp/jiafeng-admin-ai-20261013";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], commands = [], checks = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const user = { id: "admin-one", name: "测试运营", roles: ["national_admin"], regionIds: ["all"] };
  const workspace = Object.fromEntries(["submissions", "experts", "tasks", "contents", "collections", "activities", "users", "products", "welfareClaims", "courses", "learningGroups", "knowledgeBases", "aiRecords", "dictionaryWords", "notificationDrafts", "activityLog", "banners", "mediaItems", "venues", "hallPeople", "supportTickets"].map((key) => [key, []]));
  Object.assign(workspace, { roles: user.roles, permissions: ["*:*:*"], platformConfig: { name: "家风中华行", subtitle: "AI 测试", contact: "运营", language: "中文", regionLabel: "全国", reviewReminder: true, draftNotice: true, notice: "" } });
  workspace.knowledgeBases = [{ id: "kb-one", title: "家书写作与引用指引", category: "平台知识", documents: 1, version: "v1", updated: "2026-10-13", status: "未索引", description: "原创测试资料，用于验证索引操作与范围。", lockVersion: 3, audience: "staff", fileId: "file-one" }];
  workspace.submissions = [{ id: "work-one", title: "留给远行孩子的一封信", author: "测试投稿人", region: "全国", genre: "家书", theme: "诚实守信", channel: "普通家庭", source: "用户投稿", submittedAt: "2026-10-13T08:00:00Z", status: "待初审", content: "孩子，远行前记得祖父教诲，答应的事要认真做到。", version: 1, lockVersion: 7, attachments: [], files: [], history: [] }];
  const taskBase = { id: "task-review", mode: "review", status: "queued", model: "contract-fixture", createdAt: "2026-10-13T08:00:00Z", submissionId: "work-one", sourceVersion: 7 };
  let statusFailure = false;
  let taskFailure = false;
  let taskVersion = 7;
  let taskMode = "review";
  let ownHistoryReads = 0, adminHistoryReads = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/login")) return route.fulfill({ json: { token: "fixture-token", user } });
    if (path.endsWith("/auth/me")) return route.fulfill({ json: user });
    if (path.endsWith("/admin/bootstrap")) {
      const { submissions, ...bootstrap } = workspace;
      return route.fulfill({ json: bootstrap });
    }
    if (path.endsWith("/admin/records/submissions")) return route.fulfill({ json: { items: workspace.submissions, total: workspace.submissions.length } });
    if (path.endsWith("/ai/status")) return route.fulfill(statusFailure ? { status: 503, json: { code: "AI_UNAVAILABLE", message: "模型服务暂不可用" } } : { json: { enabled: true, provider: "development-api", model: "contract-fixture", external: true, ocrEnabled: true, knowledgeCount: workspace.knowledgeBases[0].status === "已索引" ? 1 : 0 } });
    if (path.endsWith("/admin/ai/tasks")) {
      adminHistoryReads++;
      if (!workspace.permissions.some(permission => ["*:*:*", "ai:read"].includes(permission))) return route.fulfill({ status: 403, json: { code: "FORBIDDEN", message: "没有AI运营汇总权限" } });
      return route.fulfill({ json: { items: [{ ...taskBase, status: "succeeded", result: "禁止显示的私人输出", input: "禁止显示的私人输入", error: { code: "FIXTURE", message: "禁止显示的供应商回显" } }] } });
    }
    if (path.endsWith("/ai/tasks") && route.request().method() === "GET") {
      ownHistoryReads++;
      return route.fulfill({ json: { items: [{ ...taskBase, mode: taskMode, sourceVersion: taskVersion, status: "succeeded" }] } });
    }
    if (path.endsWith("/knowledge/kb-one/index")) {
      const request = route.request().postDataJSON(); commands.push({ action: "index", ...request });
      workspace.knowledgeBases[0].audience = request.audience; workspace.knowledgeBases[0].language = request.language; workspace.knowledgeBases[0].status = "已索引"; workspace.knowledgeBases[0].lockVersion++;
      return route.fulfill({ json: { ...taskBase, id: "task-index", mode: "index", submissionId: undefined, sourceVersion: undefined } });
    }
    if (path.endsWith("/knowledge/kb-one/withdraw")) {
      commands.push({ action: "withdraw", ...route.request().postDataJSON() });
      workspace.knowledgeBases[0].status = "已撤回"; workspace.knowledgeBases[0].lockVersion++;
      return route.fulfill({ json: { status: "withdrawn" } });
    }
    if (path.endsWith("/ai/tasks/task-index")) return route.fulfill({ json: { ...taskBase, id: "task-index", mode: "index", status: "succeeded", submissionId: undefined, sourceVersion: undefined, result: "资料已建立索引。" } });
    if (path.endsWith("/ai/tasks") && route.request().method() === "POST") {
      const request = route.request().postDataJSON(); commands.push({ action: "analyse", ...request }); taskVersion = request.version; taskMode = request.mode;
      return route.fulfill({ json: { ...taskBase, mode: taskMode, sourceVersion: taskVersion } });
    }
    if (path.endsWith("/ai/tasks/task-review")) return route.fulfill({ json: { ...taskBase, mode: taskMode, sourceVersion: taskVersion, status: taskFailure ? "failed" : "succeeded", ...(taskFailure ? { error: { code: "AI_UNAVAILABLE", message: "模型处理失败，请稍后重试" } } : { result: "摘要：父亲提醒远行的孩子践行诚实守信。主题：家风传承。", issues: [{ severity: "low", quote: "祖父教诲", reason: "建议核实家训出处与引用范围。" }], similarities: [{ id: "ref-one", title: "诚信家训参考", excerpt: "言必信，行必果。", score: 2.1 }] }) } });
    return route.fulfill({ status: 404, json: { code: "NOT_FOUND", message: path } });
  });
  try {
    await page.goto(base + "#/ai");
    await page.getByPlaceholder("运营账号").fill("admin"); await page.getByPlaceholder("账号密码").fill("fixture"); await page.getByRole("button", { name: "登录工作空间" }).click();
    await page.getByRole("heading", { name: "AI 运营中心" }).waitFor();
    await page.getByText("contract-fixture", { exact: true }).waitFor();
    await page.screenshot({ path: output + "/ai-desktop.png", fullPage: true, animations: "disabled" });
    await page.getByRole("tab", { name: "调用记录" }).click();
    assert(!((await page.locator("body").innerText()).includes("禁止显示的")));
    checks.push("administrative logs display metadata only");
    await page.getByRole("tab", { name: "知识库", exact: true }).click();
    await page.getByRole("button", { name: "管理索引" }).click();
    const knowledge = page.getByRole("dialog", { name: "知识资料结构" });
    await knowledge.getByText("用户端可检索", { exact: true }).click();
    await knowledge.getByText("English", { exact: true }).click();
    await page.screenshot({ path: output + "/knowledge-language-desktop.png", fullPage: true, animations: "disabled" });
    await knowledge.getByRole("button", { name: "建立 / 更新索引" }).click();
    await page.getByRole("button", { name: "确认并建立索引" }).click();
    await knowledge.getByText("资料已建立索引。", { exact: true }).waitFor();
    await knowledge.getByRole("button", { name: "撤回检索", exact: true }).click();
    await page.getByRole("button", { name: "撤回索引", exact: true }).click();
    await knowledge.getByText("已撤回", { exact: true }).waitFor();
    assert.deepEqual(commands.slice(0, 2), [{ action: "index", version: 3, audience: "public", language: "en" }, { action: "withdraw", version: 4 }]);
    checks.push("public knowledge confirmation with English language, asynchronous index, withdrawal use authoritative versions");
    await page.keyboard.press("Escape");
    statusFailure = true; await page.getByRole("button", { name: "刷新服务与任务" }).click(); await page.getByText("模型服务暂不可用", { exact: true }).waitFor();
    statusFailure = false; await page.getByRole("button", { name: "刷新服务与任务" }).click(); await page.getByText("contract-fixture", { exact: true }).waitFor();
    checks.push("status failure is shown and refresh recovers");
    await page.goto(base + "#/submissions");
    await page.getByRole("button", { name: "留给远行孩子的一封信", exact: true }).click();
    await page.getByRole("tab", { name: "AI 辅助", exact: true }).click();
    const manuscript = page.getByRole("dialog", { name: "稿件详情" });
    await manuscript.getByRole("button", { name: "审核辅助", exact: true }).click();
    await manuscript.getByText("需要人工核对", { exact: true }).waitFor();
    await manuscript.getByText("相似内容证据", { exact: true }).waitFor();
    assert(!("text" in commands.find((command) => command.action === "analyse")));
    assert.equal(workspace.submissions[0].status, "待初审");
    await page.screenshot({ path: output + "/review-desktop.png", fullPage: true, animations: "disabled" });
    checks.push("review renders evidence without updating decisions or sending browser manuscript");
    workspace.submissions[0].lockVersion = 8;
    await manuscript.getByRole("button", { name: "刷新稿件与服务状态" }).click();
    await manuscript.getByText("稿件版本已变化，此结果已过期。请刷新稿件并重新分析。", { exact: true }).waitFor();
    assert.equal(await manuscript.getByText("需要人工核对", { exact: true }).count(), 0);
    taskFailure = true; await manuscript.getByRole("button", { name: "生成摘要", exact: true }).click();
    await manuscript.getByText("模型处理失败，请稍后重试", { exact: true }).waitFor();
    taskFailure = false; await manuscript.getByRole("button", { name: "生成摘要", exact: true }).click();
    await manuscript.getByText("需要人工核对", { exact: true }).waitFor();
    checks.push("outdated result hidden; failed task has actionable error and retry succeeds");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const rect = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
      return rect && rect.left >= -1 && rect.right <= innerWidth + 1;
    });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: output + "/review-mobile.png", fullPage: true, animations: "disabled" });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.keyboard.press("Escape"); await page.goto(base + "#/ai");
    await page.getByRole("heading", { name: "AI 运营中心" }).waitFor();
    await page.screenshot({ path: output + "/ai-mobile.png", fullPage: true, animations: "disabled" });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    checks.push("390px mobile pages and drawer avoid horizontal document overflow");
    const previousAdminReads = adminHistoryReads;
    workspace.permissions = ["submissions:read", "submissions:write"];
    await page.goto(base + "#/submissions");
    await page.reload();
    await page.getByRole("button", { name: "留给远行孩子的一封信", exact: true }).click();
    await page.getByRole("tab", { name: "AI 辅助", exact: true }).click();
    await page.getByRole("dialog", { name: "稿件详情" }).getByText("需要人工核对", { exact: true }).waitFor();
    assert.equal(ownHistoryReads, 1);
    assert.equal(adminHistoryReads, previousAdminReads);
    assert.equal(await page.getByText("没有AI运营汇总权限", { exact: true }).count(), 0);
    await page.screenshot({ path: output + "/submission-only-permissions-mobile.png", fullPage: true, animations: "disabled" });
    checks.push("submission-only permissions restore own analysis without querying AI operations metadata");
    assert.deepEqual(errors, []);
    fs.writeFileSync(output + "/report.json", JSON.stringify({ evidence: "mocked API browser contract", checks, commands, errors }, null, 2));
    console.log(JSON.stringify({ output, checks, errors }, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
