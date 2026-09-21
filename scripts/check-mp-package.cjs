// Inspect the final on-disk WeChat package, including copied static assets.
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..')
const directory = path.resolve(root, process.argv[2] || 'apps/miniapp/dist/build/mp-weixin')
const app = JSON.parse(fs.readFileSync(path.join(directory, 'app.json'), 'utf8'))
const subpackages = (app.subPackages || app.subpackages || []).map(item => item.root + '/')
function walk(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(item => {
    const file = path.join(folder, item.name)
    return item.isDirectory() ? walk(file) : [file]
  })
}
const files = walk(directory).filter(file => !file.endsWith('/project.private.config.json'))
const main = files.filter(file => !subpackages.some(prefix => path.relative(directory, file).split(path.sep).join('/').startsWith(prefix)))
const bytes = main.reduce((sum, file) => sum + fs.statSync(file).size, 0)
if (bytes >= 2 * 1024 * 1024) throw new Error(`Main package exceeds 2 MiB: ${bytes} bytes`)
if (files.some(file => /[/\\]static[/\\](?:h5[/\\])?fonts[/\\]/.test(file))) {
  throw new Error('WeChat package contains duplicate binary fonts or H5-only fonts. Rebuild from a clean output directory.')
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/font-data/mp/manifest.json'), 'utf8'))
const expected = ['JiafengSans:400:JiafengSans-Regular.woff', 'JiafengSerif:600:JiafengSerif-SemiBold.woff']
if (JSON.stringify(manifest.fonts.map(font => `${font.family}:${font.weight}:${font.file}`).sort()) !== JSON.stringify(expected)) {
  throw new Error('The WeChat font manifest must contain exactly Sans 400 and Serif 600.')
}
if (files.some(file => manifest.fonts.some(font => path.basename(file) === font.file))) {
  throw new Error('The WeChat package contains a duplicate binary font.')
}
const actual = []
for (const file of files.filter(file => /\.(?:js|wxss)$/.test(file))) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/data:font\/woff;base64,([A-Za-z0-9+/=]+)/g)) {
    actual.push({ hash: createHash('sha256').update(Buffer.from(match[1], 'base64')).digest('hex'), file })
  }
}
for (const font of manifest.fonts) {
  const matches = actual.filter(item => item.hash === font.sha256)
  if (matches.length !== 1 || !main.includes(matches[0].file)) {
    throw new Error(`Expected exactly one bundled copy of ${font.family}`)
  }
}
console.log(`WeChat package verified: ${bytes} main-package bytes; ${2 * 1024 * 1024 - bytes} bytes remaining; two unique inline fonts; no duplicate WOFF files.`)
