// Read-only live browser verification after deploy/tests/ai_probe.py has completed.
// Never creates tasks, indexes knowledge, changes records, or logs credentials.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("fs");
const assert = require("assert/strict");
const probePath = process.env.AI_PROBE_REPORT || "/tmp/jiafeng-ai-http-report.json";
assert(fs.existsSync(probePath), "Wait for the HTTP probe to complete first");
const probe = JSON.parse(fs.readFileSync(probePath, "utf8"));
const env = fs.readFileSync(process.env.DEPLOY_ENV_FILE || "deploy/.env", "utf8");
const password = env.split("\n").find((line) => line.startsWith("JIAFENG_DEV_PASSWORD=")).slice("JIAFENG_DEV_PASSWORD=".length).trim();
const base = process.env.ADMIN_TEST_URL || "http://127.0.0.1:18080/admin/";
const output = process.env.ADMIN_TEST_OUTPUT || "/tmp/jiafeng-ai-admin-live";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [], writes = [], checks = [];
  let workspace;
  let tasks;
  let status;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/v1/") && request.method() !== "GET" && !path.endsWith("/auth/login")) writes.push({ method: request.method(), path });
  });
  page.on("response", async (response) => {
    const path = new URL(response.url()).pathname;
    if (!response.ok()) return;
    if (path.endsWith("/admin/workspace")) workspace = await response.json();
    if (path.endsWith("/admin/ai/tasks")) tasks = (await response.json()).items;
    if (path.endsWith("/ai/status")) status = await response.json();
  });
  const screenshot = (name, fullPage = false) => page.screenshot({ path: `${output}/${name}.png`, fullPage, animations: "disabled" });
  const noOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Page has horizontal overflow");
  const stableDrawer = () => page.waitForFunction(() => {
    const rect = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
    return rect && rect.left >= -1 && rect.right <= innerWidth + 1;
  });
  try {
    await page.goto(base + "#/ai");
    await page.getByPlaceholder("运营账号").fill("devadmin");
    await page.getByPlaceholder("账号密码").fill(password);
    await page.getByRole("button", { name: "登录工作空间" }).click();
    await page.getByRole("heading", { name: "AI 运营中心", exact: true }).waitFor();
    await page.getByText("服务状态 · 模型已配置", { exact: true }).waitFor();
    assert(status?.enabled && status?.external);
    await noOverflow(); await screenshot("ai-desktop", true);
    checks.push("Live API model/provider/ocr state is visible with external API notice");
    await page.getByRole("tab", { name: "调用记录", exact: true }).click();
    await page.locator(".el-table__row").first().waitFor();
    const privateTasks = tasks.filter((task) => task.redacted);
    assert(privateTasks.length > 0, "Expected private task metadata from completed probe");
    for (const task of privateTasks) for (const field of ["prompt", "text", "fileId", "result", "citations", "issues", "similarities"])
      assert(!(field in task), `Private log exposes ${field}`);
    await screenshot("logs-desktop", true);
    checks.push("Real private task logs omit input, output, file identity, references and issues");
    await page.getByRole("tab", { name: "知识库", exact: true }).click();
    const knowledge = workspace.knowledgeBases.find((item) => item.id === probe.knowledgeId);
    assert(knowledge && knowledge.status === "已撤回", "Expected withdrawn probe knowledge document");
    await page.getByPlaceholder("搜索知识库名称").fill(knowledge.title);
    await page.locator(".knowledge-card").filter({ hasText: knowledge.title }).getByRole("button", { name: "管理索引" }).click();
    const knowledgeDrawer = page.getByRole("dialog", { name: "知识资料结构" });
    await knowledgeDrawer.getByText("已撤回", { exact: true }).waitFor();
    await knowledgeDrawer.getByRole("radio", { name: "English", exact: true }).waitFor();
    await knowledgeDrawer.getByRole("radio", { name: "简体中文", exact: true }).waitFor();
    await stableDrawer(); await screenshot("knowledge-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await stableDrawer(); await noOverflow(); await screenshot("knowledge-mobile");
    checks.push("Withdrawn real knowledge document and zh/en controls remain readable on desktop and 390px mobile");
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto(base + "#/submissions");
    await page.getByRole("heading", { name: "投稿作品", exact: true }).waitFor();
    const submission = workspace.submissions.find((item) => item.id === probe.submissionId);
    assert(submission, "Expected the probe manuscript in authorized workspace");
    await page.getByPlaceholder("搜索作品标题、编号或作者").fill(submission.id);
    await page.getByRole("button", { name: submission.title, exact: true }).click();
    await page.getByRole("tab", { name: "AI 辅助", exact: true }).click();
    const manuscript = page.getByRole("dialog", { name: "稿件详情" });
    await manuscript.locator(".ai-task-result").waitFor();
    await manuscript.getByText("分析结果", { exact: true }).waitFor();
    assert((await manuscript.locator(".result-text").innerText()).length > 10);
    await stableDrawer(); await screenshot("review-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await stableDrawer(); await noOverflow(); await screenshot("review-mobile");
    await manuscript.locator(".result-text").scrollIntoViewIfNeeded();
    assert(await manuscript.locator(".el-drawer__body").evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
    await screenshot("review-mobile-result");
    checks.push("Existing real manuscript analysis restores with GET only and displays on desktop/mobile");
    await page.keyboard.press("Escape"); await page.goto(base + "#/ai");
    await page.getByRole("heading", { name: "AI 运营中心", exact: true }).waitFor();
    await page.getByText("服务状态 · 模型已配置", { exact: true }).waitFor();
    await noOverflow(); await screenshot("ai-mobile", true);
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    checks.push("No page errors, no business/model writes, no horizontal overflow");
    const report = { evidence: "live deployed UI with real API; read-only after HTTP probe", checks, privateTaskCount: privateTasks.length,
      model: status.model, provider: status.provider, external: status.external, errors, writes };
    fs.writeFileSync(output + "/report.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ output, ...report }, null, 2));
  } catch (error) {
    await screenshot("failure").catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(String(error).replaceAll(password, "[redacted]")); process.exit(1); });
