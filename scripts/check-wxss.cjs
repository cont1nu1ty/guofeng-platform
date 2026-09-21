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
  const failures = []
  for (const file of files) {
    const relative = path.relative(directory, file)
    try {
      // Request this file's output: pageCount: 0 returns only shared runtime code.
      // Component selector diagnostics are embedded in the output, not thrown.
      const result = await compile({ files: [relative], pageCount: 1, cwd: directory })
      const output = result[relative]
      if (typeof output !== 'string') throw new Error('Compiler did not return this WXSS file.')
      const configPath = file.replace(/\.wxss$/, '.json')
      const component = fs.existsSync(configPath) && JSON.parse(fs.readFileSync(configPath, 'utf8')).component === true
      if (component) {
        const warning = output.match(/Some selectors are not allowed[^)]+\)/)
        if (warning) throw new Error(warning[0])
      }
    } catch (error) {
      failures.push(`${relative}: ${error.message || error}`)
    }
  }
  if (failures.length) throw new Error(failures.join('\n'))
  console.log(`Native WXSS compilation and component selector checks passed: ${files.length} files`)
})().catch(error => { console.error(error); process.exitCode = 1 })
