// Live integration check: creates clearly labelled development records and uploads a tiny PNG.
// Run from repository root with a running HTTP admin and local deploy/.env. Never use a production account.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const env = fs.readFileSync(process.env.DEPLOY_ENV_FILE || 'deploy/.env', 'utf8');
const password = env.split('\n').find(x => x.startsWith('JIAFENG_DEV_PASSWORD=')).split('=').slice(1).join('=');
const base = process.env.ADMIN_LIVE_URL || 'http://127.0.0.1:5175/admin/';
const stamp = Date.now();
const output = process.env.ADMIN_TEST_OUTPUT || '/tmp/jiafeng-admin-live';
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const errors = [], calls = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', async (r) => { if (r.url().includes('/api/v1/admin/commands')) {
        const b = await r.json();
        calls.push({ command: r.request().postDataJSON().command, status: r.status(), error: b.code || null });
        console.log(JSON.stringify(calls.at(-1)));
    } });
    async function go(route, title) { await page.goto(base + '#/' + route); await page.getByRole('heading', { name: title, exact: true }).waitFor(); }
    async function login(name) { await page.goto(base + '#/overview'); await page.getByPlaceholder('运营账号').fill(name); await page.getByPlaceholder('账号密码').fill(password); await page.getByRole('button', { name: '登录工作空间' }).click(); await page.getByRole('heading', { name: '运营工作台', exact: true }).waitFor(); }
    await login('devadmin');
    await go('content', '内容与资讯');
    const contentTitle = '联调验证-资讯-' + stamp;
    await page.getByRole('button', { name: '新建内容', exact: true }).click();
    let dialog = page.locator('.el-dialog').last();
    await dialog.getByPlaceholder('填写清晰、有辨识度的内容标题').fill(contentTitle);
    await dialog.locator('textarea').nth(0).fill('此记录用于前后端联调验证，不作为正式发布材料。');
    await dialog.locator('textarea').nth(1).fill('联调验证：从后台创建内容并发布，确认用户端可读取服务端保存的正文，刷新后仍然保留。');
    await dialog.getByRole('button', { name: /保存/ }).click();
    await dialog.waitFor({ state: 'hidden' });
    let row = page.locator('.el-table__row').filter({ hasText: contentTitle });
    await row.getByRole('button', { name: '发布', exact: true }).click();
    await page.getByRole('button', { name: '确认发布', exact: true }).click();
    await row.getByText('已发布', { exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: '内容与资讯', exact: true }).waitFor();
    await page.getByText(contentTitle, { exact: true }).first().waitFor();
    await go('activities', '活动与传习');
    const activityTitle = '联调验证-活动-' + stamp;
    await page.getByRole('button', { name: '创建活动', exact: true }).click();
    dialog = page.locator('.el-dialog').last();
    await dialog.getByPlaceholder('让一个好主题，连接更多参与者').fill(activityTitle);
    await dialog.getByPlaceholder('选择开始时间').fill('2026-10-01 10:00');
    await dialog.getByPlaceholder('选择开始时间').press('Tab');
    await dialog.getByPlaceholder('选择结束时间').fill('2026-10-02 10:00');
    await dialog.getByPlaceholder('选择结束时间').press('Tab');
    await dialog.getByPlaceholder('填写示例场地，或线上活动的参与方式').fill('联调验证线上活动');
    await dialog.locator('textarea').fill('此活动仅用于联调验证报名与发布接口，无实际线下安排。');
    await dialog.getByRole('button', { name: /保存/ }).click();
    await dialog.waitFor({ state: 'hidden' });
    let card = page.locator('.activity-card').filter({ hasText: activityTitle });
    await card.getByRole('button', { name: '发布', exact: true }).click();
    await page.getByRole('button', { name: '确认发布', exact: true }).click();
    await card.getByText('报名中', { exact: true }).waitFor();
    await go('welfare', '文创与公益');
    const productTitle = '联调验证-文创-' + stamp;
    await page.getByRole('button', { name: '新建文创资源', exact: true }).click();
    dialog = page.locator('.el-dialog').last();
    await dialog.locator('input').first().fill(productTitle);
    await dialog.locator('textarea').fill('仅用于验证文创资源保存与库存切换。');
    await dialog.getByRole('spinbutton').nth(0).fill('30');
    await dialog.getByRole('spinbutton').nth(1).fill('5');
    await dialog.getByRole('button', { name: '保存文创资源', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    card = page.locator('.product-card').filter({ hasText: productTitle });
    await card.getByRole('button', { name: '下架', exact: true }).click();
    await card.getByText('已下架', { exact: true }).waitFor();
    await card.getByRole('button', { name: '上架', exact: true }).click();
    await card.getByText(/已上架|上架中/).waitFor();
    await go('ai', 'AI 运营中心');
    await page.getByRole('button', { name: '添加资料', exact: true }).click();
    dialog = page.locator('.el-dialog').last();
    await dialog.locator('input').first().fill('联调验证-资料-' + stamp);
    await dialog.locator('input[type=file]').setInputFiles({ name: '联调验证资料.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSCEAAAAASUVORK5CYII=', 'base64') });
    await dialog.getByRole('button', { name: '保存资料', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByText('联调验证-资料-' + stamp, { exact: true }).waitFor();
    await page.locator('.el-message').last().waitFor({ state: 'hidden' });
    const publicData = await page.request.get((process.env.ADMIN_API_URL || 'http://127.0.0.1:18080/api/v1') + '/workspace');
    const publicJson = await publicData.json();
    if (!publicJson.news.some(x => x.title === contentTitle))
        throw new Error('published content not visible publicly');
    if (!publicJson.activities.some(x => x.title === activityTitle))
        throw new Error('published activity not public');
    if (!publicJson.products.some(x => x.title === productTitle))
        throw new Error('published product not public');
    await page.screenshot({ path: output + '/ai-desktop.png', fullPage: true });
    await page.getByRole('button', { name: '管理员菜单' }).click();
    await page.getByText('退出登录', { exact: true }).click();
    await page.getByPlaceholder('运营账号').waitFor();
    await login('expert_zj');
    await go('reviews', '评审管理');
    if (await page.locator('.sidebar-nav').getByText('内容资讯', { exact: true }).count())
        throw new Error('expert content menu');
    if (await page.getByRole('button', { name: '评审流程配置' }).count())
        throw new Error('expert configure shown');
    await page.goto(base + '#/content');
    await page.getByText('当前账号没有此功能的访问权限').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await go('reviews', '评审管理');
    await page.screenshot({ path: output + '/expert-mobile.png', fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const report = { base, stamp, titles: { contentTitle, activityTitle, productTitle }, calls, publicVisibility: true, expertAuthorization: true, mobileOverflow: overflow, errors };
    fs.writeFileSync(output + '/checks.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (errors.length || overflow)
        process.exitCode = 1;
})().catch(e => { console.error(String(e).replaceAll(password, '[redacted]')); process.exit(1); });
