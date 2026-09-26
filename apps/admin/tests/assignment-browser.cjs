const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const base = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:18080/admin/';
const output = process.env.ADMIN_TEST_OUTPUT || '/tmp/jiafeng-admin-assignment';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const now = Date.now();
  const keys = ['submissions', 'experts', 'tasks', 'contents', 'collections', 'activities', 'users', 'products', 'welfareClaims', 'courses', 'learningGroups', 'knowledgeBases', 'aiRecords', 'dictionaryWords', 'notificationDrafts', 'activityLog'];
  const workspace = { ...Object.fromEntries(keys.map(key => [key, []])), permissions: ['*'], roles: ['national_admin'] };
  const user = { id: 'admin-fixture', name: '任务边界测试', roles: ['national_admin'], regionIds: [] };
  const cases = [
    ['completed', '已完成可重分配', '已完成', now + 3600000, 'expert-1'],
    ['cancelled', '已取消可重分配', '已取消', now + 3600000, 'expert-1'],
    ['expired', '已过期可重分配', '待评分', now - 1000, 'expert-1'],
    ['active', '当前专家仍在处理', '待评分', now + 3600000, 'expert-1'],
    ['other-active', '另一专家仍在处理', '待评分', now + 3600000, 'expert-2'],
  ];
  workspace.experts = [{ id: 'expert-1', name: '任务边界专家', region: '浙江省', group: '文史研究', specialties: ['家风'], organization: '测试机构', title: '测试专家', availability: '可分配' }];
  workspace.submissions = cases.map(([id, title]) => ({ id, title, region: '浙江省', status: '评审中', history: [], submittedAt: new Date(now).toISOString() }));
  workspace.tasks = cases.map(([id, , status, dueAt, expertId]) => ({ id: 'task-' + id, submissionId: id, expertId, region: '浙江省', stage: '文史专家评审', status, dueAt: new Date(dueAt).toISOString() }));
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/login')) return route.fulfill({ json: { token: 'fixture-token', user } });
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user });
    if (path.endsWith('/admin/workspace')) return route.fulfill({ json: workspace });
    return route.fulfill({ status: 403, json: { code: 'READ_ONLY_FIXTURE', message: '检查不允许写入' } });
  });
  await page.goto(base + '#/experts');
  await page.getByPlaceholder('运营账号').fill('fixture');
  await page.getByPlaceholder('账号密码').fill('fixture-only');
  await page.getByRole('button', { name: '登录工作空间' }).click();
  await page.getByRole('heading', { name: '专家库', exact: true }).waitFor();
  await page.getByRole('button', { name: '分配任务', exact: true }).click();
  await page.getByRole('dialog').locator('.el-select').first().click();
  await page.waitForTimeout(500);
  const options = await page.getByRole('option').allTextContents();
  for (const expected of ['已完成可重分配', '已取消可重分配', '已过期可重分配']) {
    if (!options.some(text => text.includes(expected))) throw new Error('Missing assignable submission: ' + expected);
  }
  for (const excluded of ['当前专家仍在处理', '另一专家仍在处理']) {
    if (options.some(text => text.includes(excluded))) throw new Error('Active task still selectable: ' + excluded);
  }
  await page.screenshot({ path: output + '/assignment-desktop.png', fullPage: true });
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await page.goto(base + '#/analytics');
  await page.getByRole('heading', { name: '数据智库', exact: true }).waitFor();
  const nationalRows = await page.locator('.el-table__body-wrapper .el-table__row').count();
  if (nationalRows !== 35) throw new Error('National region count: ' + nationalRows);
  user.roles = ['regional_admin'];
  user.regionIds = ['zhejiang'];
  workspace.roles = ['regional_admin'];
  await page.reload();
  await page.getByRole('heading', { name: '数据智库', exact: true }).waitFor();
  const regionalRows = await page.locator('.el-table__body-wrapper .el-table__row').allTextContents();
  if (regionalRows.length !== 1 || !regionalRows[0].includes('浙江省')) throw new Error('Regional statistics leaked unauthorized zero rows');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(650);
  await page.screenshot({ path: output + '/regional-mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.goto(base + '#/content');
  await page.getByRole('heading', { name: '内容与资讯', exact: true }).waitFor();
  await page.getByRole('button', { name: '新建内容', exact: true }).click();
  const contentRegion = await page.getByRole('dialog').locator('.el-form-item').filter({ hasText: '发布范围' }).innerText();
  if (!contentRegion.includes('浙江省')) throw new Error('Regional content default not authorized region');
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await page.goto(base + '#/activities');
  await page.getByRole('heading', { name: '活动与传习', exact: true }).waitFor();
  await page.getByRole('button', { name: '创建活动', exact: true }).click();
  const activityRegion = await page.getByRole('dialog').locator('.el-form-item').filter({ hasText: '所属地区' }).innerText();
  if (!activityRegion.includes('浙江省')) throw new Error('Regional activity default not authorized region');
  const report = { mode: 'Final Nginx bundle, intercepted HTTP fixtures; no live writes', base, assignableOptions: options, nationalRegionRows: nationalRows, regionalRows, regionalDraftDefaults: { content: contentRegion, activity: activityRegion }, mobileOverflow: overflow, errors };
  fs.writeFileSync(output + '/checks.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (overflow || errors.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
