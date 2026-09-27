// Controlled HTTP UI checks. These fixtures never contact or modify the real API.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/home/steven/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.MINI_FIXTURE_URL || 'http://127.0.0.1:18085'
const output = process.env.MINI_FIXTURE_OUT || '/tmp/jiafeng-cloud-records-ui'
if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(base))
  throw Error('Only a local frontend is supported.')
const assert = (value, message) => {
  if (!value) throw Error(message)
}
const checks = [],
  errors = [],
  commands = []
const person = {
  id: 'hall-fixture',
  title: '云端人物',
  language: 'zh',
  regionId: 'all',
  era: '近代',
  theme: '以诚待人',
  book: '家书摘记',
  quote: '守信从日常开始',
  introduction: '受控界面验证人物',
  notes: ['认真倾听'],
  sourceTitle: '原创受控测试资料',
}
const recording = {
  id: 'record-fixture',
  title: '甲账号私人家书',
  category: 'reading',
  fileId: 'file-fixture',
  fileName: '私人家书.mp3',
  size: 128,
  duration: 3,
  createdAt: '2026-09-27T08:00:00Z',
  updatedAt: '2026-09-27T08:00:00Z',
  lockVersion: 1,
}
const promise = {
  id: 'promise-fixture',
  personId: person.id,
  personName: person.title,
  personLanguage: 'zh',
  text: '每天认真听家人讲一件小事',
  targetAvailable: true,
  createdAt: '2026-09-27T08:00:00Z',
  updatedAt: '2026-09-27T08:00:00Z',
  lockVersion: 1,
}
let recitations = [recording],
  promises = [promise],
  conflict = false,
  searchError = false,
  recordingError = false
const account = (token) =>
  token === 'Bearer fixture-b'
    ? { id: 'member-b', name: '测试乙', roles: ['member'], regionIds: ['beijing'] }
    : token === 'Bearer fixture-a'
      ? { id: 'member-a', name: '测试甲', roles: ['member'], regionIds: ['beijing'] }
      : null
const workspace = (token) => ({
  recitations: account(token)?.id === 'member-a' ? recitations : [],
  familyPromises: account(token)?.id === 'member-a' ? promises : [],
  hallPeople: [person],
  mediaItems: [
    {
      id: 'audio-story',
      title: '后台发布音频故事',
      language: 'zh',
      regionId: 'all',
      type: 'audio',
      category: 'recitation',
      excerpt: '后台编辑的故事简介',
      transcript: '后台编辑的真实故事正文',
      source: '/pkg-content/static/audio/promise-zh.mp3',
    },
  ],
  news: [],
})
let browser, page
;(async () => {
  fs.mkdirSync(output, { recursive: true })
  browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    headless: true,
    args: ['--no-sandbox'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      token = req.headers().authorization
    const reply = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (u.pathname.endsWith('/auth/login')) {
      const data = req.postDataJSON()
      return reply({
        token: data.username === 'b' ? 'fixture-b' : 'fixture-a',
        user: account(data.username === 'b' ? 'Bearer fixture-b' : 'Bearer fixture-a'),
      })
    }
    if (u.pathname.endsWith('/auth/me')) return reply(account(token))
    if (u.pathname.endsWith('/auth/logout')) return reply({})
    if (u.pathname.endsWith('/workspace')) return reply(workspace(token))
    if (u.pathname.endsWith('/search')) {
      if (searchError)
        return reply({ code: 'SEARCH_UNAVAILABLE', message: '搜索服务暂不可用，请稍后重试。' }, 503)
      const q = u.searchParams.get('q') || ''
      await new Promise((resolve) => setTimeout(resolve, q === '旧查询' ? 350 : 10))
      return reply({
        items: [
          {
            id: 'news:search-only',
            kind: 'news',
            screen: 'news',
            contentId: 'search-only',
            title: { zh: q === '旧查询' ? '不应迟到的旧结果' : '未预加载的后台检索结果', en: '' },
            summary: { zh: '这条资讯没有出现在workspace目录里', en: '' },
            region: 'all',
          },
        ],
        total: 1,
        counts: { all: 1, news: 1 },
        nextCursor: null,
      })
    }
    if (u.pathname.endsWith('/files') && req.method() === 'POST')
      return reply({
        fileId: 'uploaded-audio',
        name: '网页录音.mp3',
        type: 'audio',
        purpose: 'recitation',
        duration: 2.4,
        size: 128,
      })
    if (u.pathname.endsWith('/url'))
      return reply({ url: base + '/pkg-content/static/audio/promise-zh.mp3' })
    if (u.pathname.endsWith('/commands')) {
      const body = req.postDataJSON()
      commands.push(body)
      if (body.command === 'familyPromise.save') {
        if (conflict)
          return reply({ code: 'VERSION_CONFLICT', message: '约定已在其他设备修改' }, 409)
        promises = [{ ...promise, text: body.data.text, lockVersion: 2 }]
      }
      if (body.command === 'recitation.create') {
        if (recordingError)
          return reply(
            { code: 'SERVICE_UNAVAILABLE', message: '保存暂不可用，音频和文字应保留' },
            503,
          )
        recitations = [
          { ...recording, id: 'created-record', title: body.data.title, fileId: body.data.fileId },
          ...recitations,
        ]
      }
      if (body.command === 'recitation.remove')
        recitations = recitations.filter((x) => x.id !== body.entityId)
      if (body.command === 'familyPromise.remove') promises = []
      return reply({ result: { id: 'fixture-result' }, workspace: workspace(token) })
    }
    return reply({ code: 'FIXTURE_ROUTE_MISSING', message: u.pathname }, 404)
  })
  page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  async function open(screen, params = {}) {
    const pkg = ['learning', 'hall', 'media'].includes(screen)
      ? 'pkg-content/pages/index'
      : 'pages/explore/index'
    await page.goto('about:blank')
    await page.goto(base + '/#/' + pkg + '?' + new URLSearchParams({ screen, ...params }))
    await page.locator('.app-shell').waitFor()
  }
  async function login(name) {
    await open('profile')
    await page.getByText('登录账户', { exact: true }).click()
    await page.locator('.account-form input').nth(0).fill(name)
    await page.locator('.account-form input').nth(1).fill('fixture-only')
    await page.getByText('登录', { exact: true }).click()
    await page.getByText('退出登录', { exact: true }).waitFor()
  }
  async function record(label) {
    await page.evaluate(() => document.fonts.ready)
    assert(
      !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)),
      'Horizontal overflow: ' + label,
    )
    checks.push({ label, width: page.viewportSize().width, passed: true })
    await page.screenshot({
      path: path.join(output, label + '-' + page.viewportSize().width + '.png'),
      fullPage: true,
    })
  }
  await login('a')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    await open('profile', { tab: 'promises' })
    await page.locator('.promise-input textarea').waitFor()
    assert(
      (await page.locator('.promise-input textarea').inputValue()) === promise.text,
      'Cloud promise not restored',
    )
    await record('private-promises')
    await open('profile', { tab: 'learning' })
    await page.getByText(recording.title, { exact: true }).waitFor()
    await record('private-recordings')
    await open('hall', { id: person.id })
    await page.locator('.promise-input textarea').waitFor()
    await record('hall-promise-editor')
    await open('learning', { tab: 'audio' })
    await page.getByText('后台发布音频故事', { exact: true }).first().waitFor()
    assert(
      (await page.getByText('后台编辑的真实故事正文', { exact: true }).count()) === 1,
      'Story transcript not from HTTP catalog',
    )
    await record('published-audio-story')
    await page.getByText('诵读与打卡', { exact: true }).click()
    await page.locator('.cloud-recitations').waitFor()
    await record('audio-recitation')
    await open('search')
    await page.locator('.search-entry').waitFor()
    assert(
      (await page.locator('.search-entry').innerText()).includes('未预加载的后台检索结果'),
      'Search still requires workspace data',
    )
    await record('server-search')
  }
  await open('hall', { id: person.id })
  const input = page.locator('.promise-input textarea')
  await input.fill('这是并发冲突后应当保留的家庭约定')
  conflict = true
  await page.getByText('保存我的约定', { exact: true }).click()
  await page.getByText('约定已在其他页面修改。', { exact: false }).waitFor()
  assert((await input.inputValue()) === '这是并发冲突后应当保留的家庭约定', 'Conflict erased text')
  await record('promise-conflict')
  conflict = false
  await page.getByText('读取云端最新约定', { exact: true }).click()
  await page.getByText('已读取云端最新约定。', { exact: true }).waitFor()
  await input.fill('今天和家人共同实践守时和倾听')
  await page.getByText('保存我的约定', { exact: true }).click()
  await page.getByText('已保存到当前账号，仅你本人可读。', { exact: true }).waitFor()
  assert(commands.at(-1).version === 1, 'Editor did not send loaded version')
  await record('promise-saved')
  await open('search')
  await page.locator('.search-entry').waitFor()
  searchError = true
  await page.locator('.search-keyword-input input').fill('故障')
  await page.getByText('搜索服务暂不可用，请稍后重试。', { exact: true }).waitFor()
  assert(
    (await page.locator('.search-entry').count()) === 0,
    'Search error fell back to cached results',
  )
  await record('search-error')
  searchError = false
  await page.getByText('重试搜索', { exact: true }).click()
  await page.locator('.search-entry').waitFor()
  await page.locator('.search-keyword-input input').fill('旧查询')
  await page.waitForTimeout(320)
  await page.locator('.search-keyword-input input').fill('新查询')
  await page.waitForTimeout(800)
  assert(
    !(await page.locator('.search-entry').innerText()).includes('不应迟到'),
    'Late search replaced current query',
  )
  await record('search-late-response')
  await open('learning', { tab: 'audio' })
  await page.getByText('诵读与打卡', { exact: true }).click()
  await page.locator('.audio-input input').fill('受控验证的云端录音')
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByText('选取音频文件', { exact: true }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({
    name: '网页录音.webm',
    mimeType: 'audio/webm',
    buffer: Buffer.from('fixture-not-a-real-audio-file'),
  })
  await page.locator('.audio-agreement').click()
  recordingError = true
  await page.getByText('保存诵读打卡', { exact: true }).click()
  await page.getByText('保存暂不可用，音频和文字应保留', { exact: true }).waitFor()
  assert(
    (await page.locator('.audio-input input').inputValue()) === '受控验证的云端录音',
    'Failed record save erased title',
  )
  assert(
    (await page.getByText('网页录音.webm · 1 KB', { exact: true }).count()) === 1,
    'Failed record save erased file',
  )
  await record('record-save-retry')
  recordingError = false
  await page.getByText('保存诵读打卡', { exact: true }).click()
  await page.getByText('诵读已保存到当前账号，仅本人可读。', { exact: false }).waitFor()
  assert(commands.at(-1).data.fileId === 'uploaded-audio', 'Saved recording lost uploaded fileId')
  await record('record-saved')
  await page
    .locator('.cloud-record')
    .filter({ hasText: '受控验证的云端录音' })
    .getByText('投稿这条录音', { exact: true })
    .click()
  await page.locator('.media-submit-form').waitFor()
  assert(
    (await page.locator('.media-submit-form input').first().inputValue()) === '受控验证的云端录音',
    'Record title did not reach submission',
  )
  assert(
    (await page.getByText('已选用云端录音，无需重复上传。', { exact: false }).count()) === 1,
    'Saved file not reused',
  )
  await record('reuse-saved-recording')
  await open('profile')
  await page.getByText('退出登录', { exact: true }).click()
  await page.getByText('登录账户', { exact: true }).waitFor()
  await login('b')
  await open('profile', { tab: 'learning' })
  assert(
    (await page.getByText(recording.title, { exact: true }).count()) === 0,
    'Previous account recording leaked',
  )
  await open('profile', { tab: 'promises' })
  assert(
    (await page.locator('.promise-input textarea').count()) === 0,
    'Previous account promise leaked',
  )
  await record('second-account-isolation')
  assert(!errors.length, 'Browser errors: ' + errors.join('; '))
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: 'controlled HTTP fixtures',
        checks,
        commands,
        pageErrors: errors,
        passed: true,
        limits: [
          'No real database, Elasticsearch, conversion, microphone, signed URL or physical WeChat evidence.',
          'All /api/v1 routes were intercepted. Only frontend behavior and desktop/mobile layouts were checked.',
        ],
      },
      null,
      2,
    ) + '\n',
  )
  console.log(JSON.stringify({ passed: true, checks: checks.length, output }))
  await browser.close()
})().catch(async (error) => {
  if (page)
    await page
      .screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
      .catch(() => {})
  fs.writeFileSync(
    path.join(output, 'failure.json'),
    JSON.stringify({ passed: false, error: String(error), checks, pageErrors: errors }, null, 2),
  )
  console.error(error)
  if (browser) await browser.close()
  process.exitCode = 1
})
