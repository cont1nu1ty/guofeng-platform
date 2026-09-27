// Real local API + browser MediaRecorder check, using a generated test tone as capture input.
// This is not evidence for a physical microphone, mobile hardware, or WeChat recording.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/home/steven/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '../../..')
const base = process.env.MINI_LIVE_URL || 'http://127.0.0.1:19082'
const envFile =
  process.env.MINI_LIVE_ENV || path.join(root, 'deploy/.local/jiafeng-demo-records-check.env')
const output =
  process.env.MINI_LIVE_OUT ||
  path.join(root, 'docs/verification/previews/records-search-2026-09-27')
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base))
  throw Error('Only the isolated local test deployment is supported.')
const password = fs
  .readFileSync(envFile, 'utf8')
  .match(/^JIAFENG_DEV_PASSWORD=(.+)$/m)[1]
  .trim()
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jiafeng-audio-capture-'))
const tone = path.join(temp, 'test-tone.wav')
execFileSync('ffmpeg', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=440:duration=30',
  '-ar',
  '48000',
  '-ac',
  '1',
  tone,
])
const title = 'QA网页真实录音-' + Date.now(),
  checks = [],
  errors = [],
  created = {}
let browser, page
const assert = (value, message) => {
  if (!value) throw Error(message)
}
const report = () => ({
  checkedAt: new Date().toISOString(),
  origin: base,
  checks,
  created,
  pageErrors: errors,
  limits: [
    'A generated sine wave is injected through Chromium fake media capture; browser MediaRecorder, real upload, server conversion, MySQL and S3 are exercised.',
    'No physical microphone, phone or WeChat hardware was used.',
    'Creates one labelled private QA recording in the isolated test deployment; exact IDs are recorded for follow-up cleanup.',
  ],
})
;(async () => {
  fs.mkdirSync(output, { recursive: true })
  browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${tone}`,
    ],
  })
  async function makeContext(width = 1440) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      permissions: ['microphone'],
    })
    await context.addInitScript(() => {
      window.__recordingPlayback = []
      const Original = window.Audio
      window.Audio = new Proxy(Original, {
        construct(target, args) {
          const audio = Reflect.construct(target, args)
          for (const event of ['loadedmetadata', 'playing', 'ended', 'error'])
            audio.addEventListener(event, () =>
              window.__recordingPlayback.push({
                event,
                duration: audio.duration,
                currentTime: audio.currentTime,
                error: audio.error?.code || null,
              }),
            )
          return audio
        },
      })
    })
    const p = await context.newPage()
    p.on('pageerror', (e) => errors.push(e.message))
    return { context, page: p }
  }
  async function open(p, screen, params = {}) {
    await p.goto('about:blank')
    const workspace = p.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/v1/workspace' && r.status() === 200,
    )
    const pkg = ['learning', 'hall', 'media'].includes(screen)
      ? 'pkg-content/pages/index'
      : 'pages/explore/index'
    await p.goto(base + '/#/' + pkg + '?' + new URLSearchParams({ screen, ...params }))
    await p.locator('.app-shell').waitFor()
    return (await workspace).json()
  }
  async function login(p, user) {
    await open(p, 'profile')
    await p.getByText('登录账户', { exact: true }).click()
    await p.locator('.account-form input').nth(0).fill(user)
    await p.locator('.account-form input').nth(1).fill(password)
    await p.getByText('登录', { exact: true }).click()
    await p.getByText('退出登录', { exact: true }).waitFor()
  }
  async function record(p, label) {
    await p.evaluate(() => document.fonts.ready)
    assert(
      !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)),
      'Horizontal overflow: ' + label,
    )
    checks.push({ label, width: p.viewportSize().width, passed: true })
    await p.screenshot({
      path: path.join(output, `live-${label}-${p.viewportSize().width}.png`),
      fullPage: true,
    })
  }
  const first = await makeContext()
  page = first.page
  await login(page, 'member_zj')
  await open(page, 'learning', { tab: 'audio' })
  await page.getByText('诵读与打卡', { exact: true }).click()
  await page.locator('.audio-input input').fill(title)
  await page.getByText('开始录音', { exact: true }).click()
  await page.getByText('结束录音', { exact: false }).waitFor()
  await page.waitForTimeout(3200)
  await page.getByText('结束录音', { exact: false }).click()
  await page.locator('.audio-file').waitFor()
  const originalFile = await page.locator('.audio-file').innerText()
  assert(originalFile.includes('.webm'), 'Chrome did not produce expected WebM audio')
  await page.locator('.audio-agreement').click()
  const uploadResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/v1/files' && r.request().method() === 'POST',
  )
  const commandResponse = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/commands' &&
      r.request().postDataJSON()?.command === 'recitation.create',
  )
  await page.getByText('保存诵读打卡', { exact: true }).click()
  const uploadedResponse = await uploadResponse,
    uploaded = await uploadedResponse.json()
  assert(uploadedResponse.ok(), 'Real audio upload failed: ' + JSON.stringify(uploaded))
  assert(
    uploaded.name.endsWith('.mp3') && uploaded.duration > 0 && uploaded.duration <= 180,
    'Converted MP3 metadata invalid',
  )
  created.fileId = uploaded.fileId
  created.duration = uploaded.duration
  created.originalFormat = 'audio/webm'
  created.savedFilename = uploaded.name
  const commandResult = await commandResponse,
    body = await commandResult.json()
  assert(commandResult.ok(), 'Record persistence failed: ' + JSON.stringify(body))
  const saved = body.workspace?.recitations.find((x) => x.title === title) || body.result
  assert(saved?.id, 'Missing new recording ID')
  created.recitationId = saved.id
  created.title = title
  await page.getByText('诵读已保存到当前账号，仅本人可读。', { exact: false }).waitFor()
  await record(page, 'browser-webm-uploaded')
  let workspace = await open(page, 'profile', { tab: 'learning' })
  assert(
    workspace.recitations.some((x) => x.id === created.recitationId),
    'Recording missing after refresh',
  )
  await page.getByText(title, { exact: true }).waitFor()
  await record(page, 'record-persists-after-refresh')
  await page.getByText('退出登录', { exact: true }).click()
  await page.getByText('登录账户', { exact: true }).waitFor()
  await login(page, 'member_zj')
  workspace = await open(page, 'profile', { tab: 'learning' })
  assert(
    workspace.recitations.some((x) => x.id === created.recitationId),
    'Recording missing after re-login',
  )
  await record(page, 'record-persists-after-login')
  const second = await makeContext(390)
  await login(second.page, 'member_zj')
  workspace = await open(second.page, 'profile', { tab: 'learning' })
  assert(
    workspace.recitations.some((x) => x.id === created.recitationId),
    'Recording missing in second context',
  )
  const row = second.page.locator('.cloud-record').filter({ hasText: title })
  const urlResponse = second.page.waitForResponse(
    (r) => new URL(r.url()).pathname === `/api/v1/files/${created.fileId}/url`,
  )
  await row.getByText('播放录音', { exact: true }).click()
  const signed = await (await urlResponse).json()
  assert(signed.url && signed.url.includes('X-Amz-'), 'Missing signed S3 playback URL')
  await second.page.waitForFunction(() =>
    window.__recordingPlayback.some((x) => x.event === 'playing' && x.duration > 0),
  )
  checks.push({
    label: 'second-context-real-MP3-playback',
    passed: true,
    events: await second.page.evaluate(() => window.__recordingPlayback),
  })
  await record(second.page, 'second-context-playback')
  await second.page.getByText('退出登录', { exact: true }).click()
  await second.page.getByText('登录账户', { exact: true }).waitFor()
  await login(second.page, 'member_bj')
  workspace = await open(second.page, 'profile', { tab: 'learning' })
  assert(
    !workspace.recitations.some((x) => x.id === created.recitationId),
    'Other account received private record',
  )
  assert(
    (await second.page.getByText(title, { exact: true }).count()) === 0,
    'Other account displays private record',
  )
  await record(second.page, 'other-account-no-private-record')
  // Read-only checks of real search and public stories in both layouts.
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    await open(page, 'search')
    await page.locator('.search-entry').first().waitFor()
    await record(page, 'real-search')
    await open(page, 'learning', { tab: 'audio' })
    await page.locator('.audio-story').first().waitFor()
    await record(page, 'real-audio-story-catalog')
  }
  assert(!errors.length, 'Browser errors: ' + errors.join('; '))
  fs.writeFileSync(
    path.join(output, 'live-browser-recording.json'),
    JSON.stringify({ ...report(), passed: true }, null, 2) + '\n',
  )
  console.log(JSON.stringify({ passed: true, checks: checks.length, created, output }))
  await browser.close()
  fs.rmSync(temp, { recursive: true, force: true })
})().catch(async (error) => {
  const safe = String(error).replaceAll(password, '[redacted]')
  if (page)
    await page
      .screenshot({ path: path.join(output, 'live-browser-failure.png'), fullPage: true })
      .catch(() => {})
  fs.mkdirSync(output, { recursive: true })
  fs.writeFileSync(
    path.join(output, 'live-browser-failure.json'),
    JSON.stringify({ ...report(), passed: false, error: safe }, null, 2) + '\n',
  )
  console.error(safe)
  if (browser) await browser.close()
  fs.rmSync(temp, { recursive: true, force: true })
  process.exitCode = 1
})
