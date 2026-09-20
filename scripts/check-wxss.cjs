// Optional additional check using a locally installed WeChat DevTools compiler.
// Usage: node scripts/check-wxss.cjs /absolute/path/to/node_modules/wcc/lib/wcsc
const fs = require('node:fs')
const path = require('node:path')
const compilerPath = process.argv[2]
if (!compilerPath) {
  console.error('Pass the absolute path to your local WeChat DevTools wcc/lib/wcsc module.')
  process.exit(1)
}
const directory = path.resolve(__dirname, '..', process.argv[3] || 'apps/miniapp/dist/build/mp-weixin')
function walk(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(item => {
    const file = path.join(folder, item.name)
    return item.isDirectory() ? walk(file) : file.endsWith('.wxss') ? [file] : []
  })
}
;(async () => {
  const compile = require(path.resolve(compilerPath))
  const files = walk(directory)
  if (!files.length) throw new Error('No WXSS files. Build the mini-program first.')
  for (const file of files) {
    const relative = path.relative(directory, file)
    try { await compile({ files: [relative], cwd: directory }) }
    catch (error) { throw new Error(`${relative}: ${error.message || error}`) }
  }
  console.log(`Native WXSS compilation passed: ${files.length} files`)
})().catch(error => { console.error(error); process.exitCode = 1 })
