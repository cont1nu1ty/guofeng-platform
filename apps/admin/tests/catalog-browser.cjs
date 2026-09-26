const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("fs");
const assert = require("assert/strict");
const base = process.env.ADMIN_TEST_URL || "http://127.0.0.1:5178/admin/";
const output = process.env.ADMIN_TEST_OUTPUT || "/tmp/jiafeng-admin-catalog";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/opt/google/chrome/chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [],
    commands = [],
    checks = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const user = {
    id: "catalog-admin",
    name: "目录编辑",
    roles: ["national_admin"],
    regionIds: ["all"],
  };
  const workspace = Object.fromEntries(
    [
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
      "banners",
      "mediaItems",
      "venues",
      "hallPeople",
      "supportTickets",
    ].map((k) => [k, []]),
  );
  Object.assign(workspace, {
    roles: user.roles,
    permissions: ["*:*:*"],
    homepageConfig: {
      lockVersion: 3,
      sections: ["entries", "topics", "news", "works", "venues", "stats"].map(
        (id, order) => ({ id, enabled: true, order }),
      ),
    },
    platformConfig: {
      name: "家风中华行",
      subtitle: "目录验证",
      contact: "编辑组",
      language: "中文",
      regionLabel: "全国",
      reviewReminder: true,
      draftNotice: true,
      notice: "",
    },
  });
  const common = {
    region: "全国",
    language: "zh",
    sample: true,
    sortOrder: 1,
    lockVersion: 2,
    status: "草稿",
  };
  workspace.mediaItems = [
    {
      ...common,
      id: "media-review",
      title: "归来时的灯",
      status: "待审核",
      category: "letter",
      type: "audio",
      sourceFileId: "private-file",
      authorName: "林晚晴",
      transcript: "一盏灯的家书故事。",
    },
  ];
  workspace.supportTickets = [
    {
      id: "ticket-one",
      subject: "退修后怎样继续投稿",
      body: "我已经补充口述来源，希望保留原来编号继续提交。",
      category: "submission",
      authorName: "赵云舒",
      region: "全国",
      status: "待处理",
      reply: "",
      lockVersion: 4,
    },
  ];
  const mapping = {
    Banner: "banners",
    Media: "mediaItems",
    Venue: "venues",
    HallPerson: "hallPeople",
  };
  let conflict = false;
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname.endsWith("/auth/login"))
      return route.fulfill({ json: { token: "fixture-only", user } });
    if (url.pathname.endsWith("/auth/me")) return route.fulfill({ json: user });
    if (url.pathname.endsWith("/admin/workspace"))
      return route.fulfill({ json: workspace });
    if (url.pathname.endsWith("/files")) {
      commands.push({ uploadPurpose: url.searchParams.get("purpose") });
      return route.fulfill({ json: { fileId: "uploaded-file", name: "演示文件" } });
    }
    if (url.pathname.endsWith("/admin/commands")) {
      const body = req.postDataJSON();
      commands.push(body);
      if (conflict) {
        conflict = false;
        return route.fulfill({
          status: 412,
          json: {
            code: "VERSION_CONFLICT",
            message: "记录已更新，请重新读取后修改",
            requestId: "fixture-conflict",
          },
        });
      }
      let result = { ok: true };
      if (body.command === "saveHomepageConfig") {
        workspace.homepageConfig = { ...body.data, lockVersion: 4 };
      } else if (body.command === "replySupportTicket") {
        Object.assign(workspace.supportTickets[0], body.data, { lockVersion: 5 });
      } else {
        const kind = Object.entries(mapping).find(([part]) =>
          body.command.includes(part),
        );
        if (kind) {
          const key = kind[1];
          let row = workspace[key].find((x) => x.id === body.entityId);
          if (body.command.startsWith("save")) {
            if (!row) {
              row = { ...common, id: key + "-" + workspace[key].length };
              workspace[key].push(row);
            }
            Object.assign(row, body.data, {
              status: "草稿",
              lockVersion: row.lockVersion + 1,
            });
          } else Object.assign(row, body.data, { lockVersion: row.lockVersion + 1 });
          result = row;
        }
      }
      return route.fulfill({ json: { result, workspace } });
    }
    return route.fulfill({ status: 404, json: { message: "fixture route missing" } });
  });
  await page.goto(base + "#/content");
  await page.getByPlaceholder("运营账号").fill("fixture");
  await page.getByPlaceholder("账号密码").fill("fixture-password");
  await page.getByRole("button", { name: "登录工作空间", exact: true }).click();
  await page.getByRole("tab", { name: "首页轮播", exact: true }).click();
  await page.getByRole("button", { name: "新建轮播", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .locator(".el-form-item")
    .filter({ has: page.locator(".el-form-item__label").filter({ hasText: /^标题$/ }) })
    .locator("input")
    .fill("秋日家书英文轮播");
  const language = dialog
    .locator(".el-form-item")
    .filter({
      has: page.locator(".el-form-item__label").filter({ hasText: /^内容语言$/ }),
    });
  await language.locator(".el-select").click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await dialog
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "封面.png",
      mimeType: "image/png",
      buffer: Buffer.from("89504e470d0a1a0a", "hex"),
    });
  await dialog.getByText("演示文件", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "保存草稿", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(commands.find((x) => x.command === "saveBanner").data.language, "en");
  assert.equal(
    commands.find((x) => x.command === "saveBanner").data.coverFileId,
    "uploaded-file",
  );
  checks.push("Banner independent English and uploaded cover saved as draft");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await page.getByText("已发布", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  conflict = true;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存草稿", exact: true })
    .click();
  await page.getByRole("dialog").getByText("记录已更新，请重新读取后修改").waitFor();
  assert(await page.getByRole("dialog").isVisible());
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  checks.push("Publish is separate; stale edit retains dialog and error");
  await page.getByRole("tab", { name: "首页布局", exact: true }).click();
  await page.getByRole("button", { name: "下移", exact: true }).first().click();
  await page.getByRole("button", { name: "保存首页布局", exact: true }).click();
  await page.getByText("首页栏目设置已保存").waitFor();
  const home = commands.find((x) => x.command === "saveHomepageConfig");
  assert.equal(home.version, 3);
  assert.equal(home.data.sections[0].id, "topics");
  checks.push("Homepage ordering uses setting version and all six sections");
  await page.getByRole("tab", { name: "媒体素材", exact: true }).click();
  await page.getByRole("button", { name: "退回", exact: true }).click();
  await page
    .locator(".el-message-box textarea")
    .fill("请补充原稿朗读授权说明后重新提交。");
  await page.getByRole("button", { name: "确认退回", exact: true }).click();
  await page.getByText("已退回", { exact: true }).first().waitFor();
  assert.equal(commands.find((x) => x.command === "setMediaStatus").version, 2);
  checks.push("Member media review return stores reason and version");
  await page.getByRole("button", { name: "新建媒体", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .locator(".el-form-item")
    .filter({ has: page.locator(".el-form-item__label").filter({ hasText: /^标题$/ }) })
    .locator("input")
    .fill("家庭朗读短片");
  await dialog
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "朗读.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("ID3fake-media"),
    });
  await dialog.getByText("演示文件", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "保存草稿", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert(commands.some((x) => x.uploadPurpose === "media"));
  checks.push("Media source upload uses media purpose and draft-only save");
  for (const [tab, button, fields, command] of [
    [
      "传习阵地",
      "新建阵地",
      {
        标题: "青禾共读空间",
        所在城市: "杭州",
        地址: "原创展示地址",
        阵地介绍: "大家可以在这里共同阅读与讨论家庭故事。",
      },
      "saveVenue",
    ],
    [
      "名人馆档案",
      "新建人物档案",
      {
        标题: "陆望川",
        家风主题: "守信",
        人物介绍: "原创虚构人物，记录认真修补旧物的日常。",
        资料来源说明: "项目原创虚构展示资料",
      },
      "saveHallPerson",
    ],
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.getByRole("button", { name: button, exact: true }).click();
    dialog = page.getByRole("dialog");
    for (const [label, value] of Object.entries(fields)) {
      await dialog
        .locator(".el-form-item")
        .filter({
          has: page
            .locator(".el-form-item__label")
            .filter({ hasText: new RegExp("^" + label + "$") }),
        })
        .locator("input,textarea")
        .first()
        .fill(value);
    }
    await dialog.getByRole("button", { name: "保存草稿", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert(commands.some((x) => x.command === command));
  }
  checks.push("Venue and hall archives created through directory commands");
  await page.getByRole("tab", { name: "人工咨询", exact: true }).click();
  await page.getByRole("button", { name: "查看 / 回复", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .locator("textarea")
    .fill("请进入原作品，查看退修意见后选择修改重投，编号会保留。");
  await dialog.getByText("关闭咨询", { exact: true }).click();
  await dialog.getByRole("button", { name: "保存回复", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    commands.find((x) => x.command === "replySupportTicket").data.status,
    "已关闭",
  );
  checks.push("Support reply closes ticket with captured version");
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
    for (const [i, tab] of tabs.entries()) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await page.screenshot({ path: output + `/${width}-${i}.png`, fullPage: true });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(overflow, false, `${width} ${tab} document overflow`);
    }
  }
  assert.deepEqual(errors, []);
  checks.push(
    "All seven tabs at 1440px and 390px: no document overflow or page errors",
  );
  fs.writeFileSync(
    output + "/checks.json",
    JSON.stringify(
      {
        checks,
        commands: commands
          .filter((x) => x.command)
          .map(({ command, version }) => ({ command, version })),
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, errors }));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
