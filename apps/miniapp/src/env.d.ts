/// <reference types="vite/client" />
declare module 'virtual:jiafeng-wechat-fonts' {
  const fonts: { family: string; weight: string; source: string }[]
  export default fonts
}
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
