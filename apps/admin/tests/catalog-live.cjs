const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const root = path.resolve(__dirname, "../../..");
const base = process.env.ADMIN_TEST_URL || "http://127.0.0.1:18080/admin/";
const output = process.env.ADMIN_TEST_OUTPUT || "/tmp/jiafeng-admin-catalog-live";
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, "deploy/.env"), "utf8")
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, "")];
    }),
);
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: "/opt/google/chrome/chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [],
    checks = [],
    responses = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/v1/admin/commands")
      responses.push(response.status());
  });
  await page.goto(base + "#/content");
  await page.getByPlaceholder("运营账号").fill("devadmin");
  await page.getByPlaceholder("账号密码").fill(env.JIAFENG_DEV_PASSWORD);
  await page.getByRole("button", { name: "登录工作空间", exact: true }).click();
  await page.getByRole("tab", { name: "首页轮播", exact: true }).click();
  const token = await page.evaluate(() =>
    sessionStorage.getItem("Jiafeng-Admin-Token"),
  );
  const apiBase = new URL("/api/v1", base).href;
  const read = async () => {
    const response = await page.request.get(apiBase + "/admin/workspace", {
      headers: { Authorization: "Bearer " + token },
    });
    assert.equal(response.status(), 200);
    return response.json();
  };
  const before = await read();
  assert(
    before.banners.length >= 6 &&
      before.mediaItems.length >= 4 &&
      before.venues.length >= 3 &&
      before.hallPeople.length >= 1 &&
      before.supportTickets.length >= 1,
  );
  checks.push(
    "Real national session loaded banners, media, venues, hall archives and support tickets",
  );

  // Only create a uniquely named temporary record; never edit the showcase seed.
  const temporaryTitle = `联动验收·后台轮播·${Date.now()}`;
  await page.getByRole("button", { name: "新建轮播", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator(".el-form-item")
    .filter({ has: page.locator(".el-form-item__label").filter({ hasText: /^标题$/ }) })
    .locator("input")
    .fill(temporaryTitle);
  await dialog.locator(".el-switch__core").click();
  let pendingResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/admin/commands",
  );
  await dialog.getByRole("button", { name: "保存草稿", exact: true }).click();
  let response = await pendingResponse;
  assert.equal(response.status(), 200);
  const created = (await response.json()).result;
  const createdIds = fs.existsSync(output + "/created-ids.json")
    ? JSON.parse(fs.readFileSync(output + "/created-ids.json", "utf8"))
    : [];
  createdIds.push({ kind: "banner", id: created.id, title: temporaryTitle });
  fs.writeFileSync(output + "/created-ids.json", JSON.stringify(createdIds, null, 2));
  await dialog.waitFor({ state: "hidden" });
  const row = page
    .locator(".catalog-manager .el-table__body tr")
    .filter({ hasText: temporaryTitle });
  await row.getByRole("button", { name: "发布", exact: true }).click();
  pendingResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/admin/commands",
  );
  await page.getByRole("button", { name: "确认", exact: true }).click();
  response = await pendingResponse;
  assert.equal(response.status(), 200);
  assert.equal(
    (await read()).banners.find((item) => item.id === created.id).status,
    "已发布",
  );
  await row.getByRole("button", { name: "下架", exact: true }).click();
  pendingResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/admin/commands",
  );
  await page.getByRole("button", { name: "确认", exact: true }).click();
  response = await pendingResponse;
  assert.equal(response.status(), 200);
  assert.equal(
    (await read()).banners.find((item) => item.id === created.id).status,
    "已下架",
  );
  checks.push(
    "Temporary banner saved, published and withdrawn through real UI; original showcase records untouched",
  );

  await page.getByRole("tab", { name: "媒体素材", exact: true }).click();
  const media = before.mediaItems.find((item) => item.sourceFileId);
  await page.getByRole("button", { name: media.title, exact: true }).click();
  await page.waitForFunction(() => {
    const element = document.querySelector(
      ".catalog-preview video, .catalog-preview audio",
    );
    return element && element.readyState >= 1;
  });
  const warnings = await page
    .locator(".catalog-preview .el-alert--warning .el-alert__title")
    .allTextContents();
  assert(
    warnings.every((text) => text.startsWith("处理意见：")),
    "Unexpected private-file preview error",
  );
  await page.screenshot({
    path: output + "/media-preview.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  checks.push(
    "Private source preview obtained an authorized S3 URL and loaded media metadata",
  );

  const tabs = [
    "文章资讯",
    "首页轮播",
    "首页布局",
    "媒体素材",
    "传习阵地",
    "名人馆档案",
    "人工咨询",
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    for (const [index, tab] of tabs.entries()) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await page.screenshot({
        path: output + `/${width}-${index}.png`,
        fullPage: true,
        animations: "disabled",
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        tab + " overflow",
      );
    }
  }
  checks.push(
    "Final Nginx build: seven tabs at desktop and mobile widths without page overflow",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    output + "/checks.json",
    JSON.stringify({ checks, commandStatuses: responses, createdIds, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, commandStatuses: responses, errors }));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
