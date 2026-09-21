import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import Uni from '@uni-helper/plugin-uni'

// Data URLs are supported by WeChat >= 3.7.9. Generate them at build time:
// the runtime file system cannot read the WOFF files from the code package.
function wechatFonts(): Plugin {
  const id = 'virtual:jiafeng-wechat-fonts'
  const directory = new URL('../../scripts/font-data/mp/', import.meta.url)
  return {
    name: 'jiafeng-wechat-fonts',
    resolveId(source) {
      if (source === id) return `\0${id}`
    },
    load(source) {
      if (source !== `\0${id}`) return
      if (process.env.UNI_PLATFORM !== 'mp-weixin') return 'export default []'
      const manifestPath = fileURLToPath(new URL('manifest.json', directory))
      this.addWatchFile(manifestPath)
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        fonts: { family: string; weight: number; file: string; bytes: number; sha256: string }[]
      }
      const expected = [
        'JiafengSans:400:JiafengSans-Regular.woff',
        'JiafengSerif:600:JiafengSerif-SemiBold.woff',
      ]
      if (
        JSON.stringify(
          manifest.fonts.map((font) => `${font.family}:${font.weight}:${font.file}`).sort(),
        ) !== JSON.stringify(expected)
      )
        throw new Error('The WeChat font manifest must contain exactly Sans 400 and Serif 600.')
      const fonts = manifest.fonts.map((font) => {
        const file = fileURLToPath(new URL(font.file, directory))
        this.addWatchFile(file)
        const bytes = readFileSync(file)
        if (
          bytes.length !== font.bytes ||
          createHash('sha256').update(bytes).digest('hex') !== font.sha256
        )
          throw new Error(`Font integrity check failed: ${font.file}. Rebuild font subsets.`)
        return {
          family: font.family,
          weight: String(font.weight),
          source: `url("data:font/woff;base64,${bytes.toString('base64')}")`,
        }
      })
      return `export default ${JSON.stringify(fonts)}`
    },
  }
}
// Adapted from wot-ui/wot-starter; see ../../licenses/wot-starter.MIT.txt.
export default defineConfig({
  base: './',
  plugins: [wechatFonts(), Uni()],
  optimizeDeps: { exclude: ['@wot-ui/ui'] },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions'],
      },
    },
  },
})
