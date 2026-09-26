const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("fs");
const base = process.env.ADMIN_TEST_URL || "http://127.0.0.1:5175/admin/";
const output = process.env.ADMIN_TEST_OUTPUT || "/tmp/jiafeng-admin-http";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/opt/google/chrome/chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const keys = [
    "submissions",
    "experts",
    "tasks",
    "contents",
    "collections",
    "activities",
    "users",
    "products",
    "welfareClaims",
    "courses",
    "learningGroups",
    "knowledgeBases",
    "aiRecords",
    "dictionaryWords",
    "notificationDrafts",
    "activityLog",
  ];
  const workspace = {
    ...Object.fromEntries(keys.map((k) => [k, []])),
    reviewFlow: {
      name: "试点评审",
      blind: true,
      deadlineDays: 7,
      stages: [
        "区县初审",
        "市级行业复审",
        "文史专家评审",
        "专项终审",
        "国家级复核",
        "全国标准审定",
      ].map((name) => ({ name, owner: "管理", enabled: true })),
      lockVersion: 1,
    },
    scoringDimensions: [
      { label: "思想与价值", max: 30, description: "" },
      { label: "内容与表达", max: 30, description: "" },
      { label: "文化与传承", max: 25, description: "" },
      { label: "原创与特色", max: 15, description: "" },
    ],
    platformConfig: {
      name: "家风中华行",
      subtitle: "文化平台",
      contact: "运营组",
      language: "简体中文",
      regionLabel: "全国运营",
      reviewReminder: true,
      draftNotice: true,
      notice: "传承家风",
      lockVersion: 1,
    },
    roles: ["national_admin"],
    permissions: ["*:*:*"],
  };
  let offline = false;
  const commands = [];
  const user = {
    id: "admin1",
    name: "测试管理员",
    roles: ["national_admin"],
    regionIds: ["000000"],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/login"))
      return route.fulfill({ json: { token: "fixture-token", user } });
    if (path.endsWith("/auth/me")) return route.fulfill({ json: user });
    if (path.endsWith("/auth/logout"))
      return route.fulfill({ json: { ok: true } });
    if (path.endsWith("/admin/workspace"))
      return route.fulfill({ json: workspace });
    if (path.endsWith("/admin/commands")) {
      const req = route.request().postDataJSON();
      commands.push(req);
      if (offline)
        return route.fulfill({
          status: 409,
          json: {
            code: "VERSION_CONFLICT",
            message: "资料已被其他人更新",
            requestId: "ui-test-409",
          },
        });
      if (req.command === "saveContent") {
        const item = {
          id: "C1",
          ...req.data,
          status: "草稿",
          author: "管理员",
          updatedAt: new Date().toISOString(),
          views: 0,
          lockVersion: 1,
        };
        workspace.contents = [item];
        return route.fulfill({ json: { result: item, workspace } });
      }
      if (req.command === "setContentStatus") {
        workspace.contents[0].status = req.data.status;
        workspace.contents[0].lockVersion++;
      }
      if (req.command === "saveProduct") {
        workspace.products.push({
          id: "P1",
          title: req.data.title,
          subtitle: req.data.description,
          category: req.data.type,
          stock: req.data.stock,
          quota: req.data.quota,
          status: "已下架",
          color: "#a44136",
          glyph: "家",
          lockVersion: 1,
        });
      }
      return route.fulfill({
        json: { result: { ok: true, message: "已保存" }, workspace },
      });
    }
    return route.fulfill({
      status: 404,
      json: { code: "NOT_FOUND", message: path },
    });
  });
  await page.goto(base + "#/overview");
  await page.getByPlaceholder("运营账号").fill("admin");
  await page.getByPlaceholder("账号密码").fill("test");
  await page.getByRole("button", { name: "登录工作空间" }).click();
  await page
    .getByText("已连接业务服务，数据按当前账号授权范围显示。")
    .waitFor();
  const titles = {
    overview: "运营工作台",
    submissions: "投稿作品",
    reviews: "评审管理",
    experts: "专家库",
    content: "内容与资讯",
    collections: "典籍编纂",
    activities: "活动与传习",
    education: "清廉教育",
    welfare: "文创与公益",
    users: "用户与权限",
    ai: "AI 运营中心",
    analytics: "数据智库",
    settings: "系统设置",
  };
  const pages = [
    "overview",
    "submissions",
    "reviews",
    "experts",
    "content",
    "collections",
    "activities",
    "education",
    "welfare",
    "users",
    "ai",
    "analytics",
    "settings",
  ];
  const checks = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of pages) {
      await page.goto(base + "#/" + path);
      await page.locator("#main-content h1").first().waitFor();
      await page.waitForTimeout(500);
      const heading = await page
        .locator("#main-content h1")
        .first()
        .innerText();
      if (heading !== titles[path])
        throw new Error("unexpected heading " + path + ":" + heading);
      const body = await page.locator("body").innerText();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      checks.push({
        path,
        width,
        heading,
        overflow,
        hasEmpty:
          body.includes("暂无") ||
          body.includes("No Data") ||
          body.includes("没有"),
      });
      if (overflow) throw new Error("overflow " + path + " " + width);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "#/reviews");
  await page.getByRole("button", { name: "评审流程配置", exact: true }).click();
  const anonymousSwitch = page.getByRole("switch", { name: "匿名展示", exact: true });
  if (!(await anonymousSwitch.isDisabled()) || !(await anonymousSwitch.isChecked()))
    throw new Error("HTTP review must remain anonymous");
  await page.getByText("本期采用匿名评审", { exact: true }).waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
  await page.goto(base + "#/content");
  await page.getByRole("button", { name: "新建内容", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.locator("input").nth(0).fill("测试保存内容");
  await form.locator("textarea").nth(0).fill("这是测试内容的摘要文字");
  await form
    .locator("textarea")
    .nth(1)
    .fill("这是测试内容的正文文字，检查真实模式的保存边界。");
  offline = true;
  await form.getByRole("button", { name: /保存/ }).click();
  await page.getByText("资料已被其他人更新", { exact: true }).first().waitFor();
  if (!(await form.isVisible())) throw new Error("failed-save closed dialog");
  if (workspace.contents.length) throw new Error("failed-save changed fixture");
  offline = false;
  await form.getByRole("button", { name: /保存/ }).click();
  await form.waitFor({ state: "hidden" });
  await page.getByText("测试保存内容", { exact: true }).first().waitFor();
  await page.waitForTimeout(3500);
  await page.screenshot({
    path: output + "/content-desktop.png",
    fullPage: true,
  });
  await page.goto(base + "#/welfare");
  await page.getByRole("button", { name: "新建文创资源" }).click();
  await page.getByRole("dialog").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: output + "/product-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "取消", exact: true }).click();
  workspace.permissions = ["reviews:read", "reviews:write"];
  workspace.roles = ["expert"];
  await page.reload();
  await page.getByText("当前账号没有此功能的访问权限").waitFor();
  if (await page.locator(".sidebar-nav").getByText("内容与资讯").count())
    throw new Error("unauthorized nav visible");
  await page.goto(base + "#/reviews");
  if (await page.getByRole("button", { name: "评审流程配置" }).isVisible())
    throw new Error("expert may configure flow");
  await browser.close();
  const report = {
    mode: "HTTP UI against intercepted contract fixtures, not live backend",
    checks,
    anonymousReviewLocked: true,
    commands: commands.map((c) => ({ command: c.command, version: c.version })),
    errors,
  };
  fs.writeFileSync(output + "/checks.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
