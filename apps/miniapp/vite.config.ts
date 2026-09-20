import { defineConfig } from 'vite'
import Uni from '@uni-helper/plugin-uni'
// Adapted from wot-ui/wot-starter; see ../../licenses/wot-starter.MIT.txt.
export default defineConfig({
  base: './',
  plugins: [Uni()],
  optimizeDeps: { exclude: ['@wot-ui/ui'] },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions'],
      },
    },
  },
})
