/** Reserve the native status bar and WeChat capsule in custom navigation. */
export function getMiniAppHeaderStyle(): Record<string, string> {
  // #ifdef MP-WEIXIN
  try {
    const windowInfo = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
    const capsule = uni.getMenuButtonBoundingClientRect()
    const status = windowInfo.statusBarHeight || 20
    return {
      height: `${Math.max(capsule.bottom + 8, status + 44)}px`,
      paddingTop: `${status}px`,
      paddingRight: `${Math.max(windowInfo.windowWidth - capsule.left + 12, 100)}px`,
    }
  } catch {
    return { height: '88px', paddingTop: '44px', paddingRight: '105px' }
  }
  // #endif
  return {}
}
