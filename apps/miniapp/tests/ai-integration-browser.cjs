// Controlled API fixtures: validates the merged UI, never a model or live backend.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const base = process.env.MINI_TEST_URL || 'http://127.0.0.1:5182'
const output = process.env.MINI_TEST_OUTPUT || '/tmp/jiafeng-integrated-mini-ai-20261013'
const checks = [], errors = [], requests = []
const person = {
  id: 'hall-fixture', title: '诚信家书馆', language: 'zh', regionId: 'all',
  era: '原创演示', theme: '以诚待人', book: '家书摘记', quote: '守信从日常开始',
  introduction: '用于验证全景与知识提问并存的受控人物资料。', notes: ['认真倾听'],
  sourceTitle: '原创受控测试资料', panoramaUrl: base + '/fixture-panorama.svg', sample: true,
}
const user = { id: 'member-fixture', name: '测试会员', roles: ['member'], regionIds: ['all'] }
const archive = (id, source) => ({ id, source, mode: 'letter', prompt: source === 'model' ? '已存 AI 家书' : '已存预设家书', result: '存档内容仅用于界面契约验证。', createdAt: '2026-10-13T08:00:00Z' })
const workspace = {
  hallPeople: [person], aiArchives: [archive('archive-model', 'model'), archive('archive-preset', 'preset')],
  familyPromises: [], recitations: [], news: [],
}
const certificate = {
  id: 'cert-fixture', certificateNo: 'JF-FIXTURE-1', title: '人工签发结业证书',
  issuer: '受控测试机构', holderName: user.name, sourceTitle: '家风传习课程',
  status: 'issued', issuedAt: '2026-10-13T08:00:00Z', verifyToken: 'a'.repeat(32),
}
let browser, page
;(async () => {
  fs.mkdirSync(output, { recursive: true })
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route('**/fixture-panorama.svg', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256"><rect width="512" height="256" fill="#d6bd89"/><path d="M0 128H512M128 0V256M384 0V256" stroke="#714d30" stroke-width="10"/></svg>',
  }))
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname
    requests.push({ method: request.method(), path: endpoint, query: url.search })
    const reply = (json, status = 200) => route.fulfill({ json, status })
    if (endpoint.endsWith('/auth/login')) return reply({ token: 'fixture-token', user })
    if (endpoint.endsWith('/auth/me')) return reply(user)
    if (endpoint.endsWith('/workspace')) return reply(workspace)
    if (endpoint.endsWith('/draft')) return reply(null)
    if (endpoint.endsWith('/ai/status')) return reply({ enabled: true, provider: 'fixture', model: 'contract-fixture', external: false, ocrEnabled: false, knowledgeCount: 1 })
    if (endpoint.endsWith('/ai/tasks')) return reply({ items: [] })
    if (endpoint.endsWith('/me/certificates')) {
      const second = url.searchParams.get('page') === '2'
      return reply({ items: [{ ...certificate, id: second ? 'cert-fixture-2' : certificate.id, title: second ? '第二页人工签发证书' : certificate.title }], total: 11, page: second ? 2 : 1, pageSize: 10 })
    }
    if (endpoint.endsWith('/me/copyright-confirmations')) return reply({ items: [{ id: 'rights-fixture', submissionId: 'work-fixture', revisionId: 'revision-1', agreementVersion: 'v2', agreementText: '已明确确认的投稿须知受控全文。', acceptedAt: '2026-10-13T08:00:00Z' }] })
    return reply({ code: 'FIXTURE_ROUTE_MISSING', message: endpoint }, 404)
  })
  page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  async function open(screen, params = {}) {
    const entry = screen === 'hall' ? 'pkg-content/pages/index' : 'pages/explore/index'
    await page.goto('about:blank')
    await page.goto(base + '/#/' + entry + '?' + new URLSearchParams({ screen, ...params }))
    await page.locator('.app-shell').waitFor()
  }
  async function record(name) {
    await page.evaluate(() => document.fonts.ready)
    const fonts = await page.evaluate(() => [...document.fonts]
      .filter(font => font.family.includes('Jiafeng'))
      .map(font => ({ family: font.family, status: font.status })))
    assert(fonts.some(font => font.family.includes('JiafengSans') && font.status === 'loaded'))
    assert(fonts.some(font => font.family.includes('JiafengSerif') && font.status === 'loaded'))
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Horizontal overflow: ' + name)
    await page.screenshot({ path: path.join(output, name + '-' + page.viewportSize().width + '.png'), fullPage: true, animations: 'disabled' })
    checks.push({ name, width: page.viewportSize().width, fonts, passed: true })
  }
  await open('profile')
  await page.getByText('登录账户', { exact: true }).click()
  await page.locator('.account-form input').nth(0).fill('fixture')
  await page.locator('.account-form input').nth(1).fill('fixture-password')
  await page.getByText('登录', { exact: true }).click()
  await page.getByText('退出登录', { exact: true }).waitFor()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    await open('hall', { id: person.id })
    await page.getByText('展馆全景', { exact: true }).waitFor()
    await page.getByText('重置视角', { exact: true }).waitFor()
    await page.getByText('向左', { exact: true }).click()
    await page.getByText('重置视角', { exact: true }).click()
    await page.getByText('人物知识问答（附出处）', { exact: true }).waitFor()
    await record('hall-panorama-and-ai')
    await page.getByText('人物知识问答（附出处）', { exact: true }).click()
    await page.locator('.conversation-input textarea').waitFor()
    assert((await page.locator('.conversation-input textarea').inputValue()).includes(person.title))
    assert((await page.locator('.assistant-mode-button.active').innerText()).includes('知识'))
    await record('hall-prefilled-knowledge-question')
    await open('profile', { tab: 'archive' })
    await page.getByText('AI 创作记录', { exact: true }).waitFor()
    await page.getByText('预设创作示例', { exact: true }).waitFor()
    await page.getByText('证书夹', { exact: false }).first().waitFor()
    await record('profile-ai-and-preset-archives')
    await open('profile', { tab: 'certificates' })
    await page.getByText(certificate.title, { exact: true }).waitFor()
    await page.getByText('查看确认全文', { exact: true }).click()
    await page.getByText('已明确确认的投稿须知受控全文。', { exact: true }).waitFor()
    await record('profile-certificates-and-rights')
    await page.locator('.credential-list').getByText('下一页', { exact: true }).click()
    await page.getByText('第二页人工签发证书', { exact: true }).waitFor()
    await record('profile-certificate-pagination')
  }
  person.panoramaUrl = ''
  await open('hall', { id: person.id })
  await page.getByText('当前展馆尚未提供全景照片，可阅读图文导览。', { exact: true }).waitFor()
  await page.getByText('人物知识问答（附出处）', { exact: true }).waitFor()
  await record('hall-without-panorama-retains-ai')
  assert.deepEqual(errors, [])
  assert(!requests.some(request => request.path.endsWith('/ai/tasks') && request.method === 'POST'), 'No model task should be requested')
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ evidence: 'Controlled API browser fixtures; no live model, backend or physical WeChat validation', checks, requests, pageErrors: errors, passed: true }, null, 2))
  console.log(JSON.stringify({ passed: true, checks: checks.length, output, errors }, null, 2))
  await browser.close()
})().catch(async error => {
  if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), checks, requests, pageErrors: errors }, null, 2))
  console.error(error)
  if (browser) await browser.close()
  process.exitCode = 1
})
