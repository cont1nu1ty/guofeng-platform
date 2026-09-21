import { computed, ref } from 'vue'
import {
  createAccountDemo,
  AccountError,
  type AccountErrorCode,
  type AccountState,
} from '../domain/accountDemo'
import { t } from './useLocale'
const version = ref(0)
export const accountUnavailable = ref(false)
let store: ReturnType<typeof createAccountDemo> | undefined
try {
  store = createAccountDemo({
    getItem: (key) => uni.getStorageSync(key) || null,
    setItem: (key, value) => uni.setStorageSync(key, value),
  })
} catch {
  accountUnavailable.value = true
}
export const accountState = computed<AccountState>(() => {
  version.value
  return (
    store?.getState() ?? { version: 1, signedIn: false, verification: { status: 'unverified' } }
  )
})
export function accountErrorText(error: unknown) {
  const code: AccountErrorCode = error instanceof AccountError ? error.code : 'storage'
  const messages: Record<AccountErrorCode, [string, string]> = {
    storage: [
      '本机保存失败，账户状态未改变。请重试。',
      'Local save failed. Account state is unchanged. Please retry.',
    ],
    format: [
      '本机账户记录无法读取，原数据未被覆盖。',
      'The local account record could not be read. Existing data was not overwritten.',
    ],
    sign_in: ['请先启用演示账户。', 'Enable the demo account first.'],
    consent: ['请先勾选本机演示说明。', 'Please accept the local demo notice first.'],
    name: [
      '演示称呼需为 2–30 字，请勿填写证件或电话号码。',
      'Use a fictional name of 2–30 characters, without ID or phone numbers.',
    ],
    affiliation: [
      '演示单位需为 2–60 字，请使用虚构资料。',
      'Use a fictional organisation of 2–60 characters.',
    ],
    category: ['请选择演示身份类别。', 'Select a demo identity category.'],
    pending: [
      '当前资料正在模拟审核，可先演示审核结果。',
      'A simulated review is pending. Choose a sample outcome first.',
    ],
    review: [
      '只有审核中的资料可以演示审核结果。',
      'Only a pending application can receive a sample outcome.',
    ],
  }
  return t(...messages[code])
}
export function changeAccount(action: (account: ReturnType<typeof createAccountDemo>) => unknown) {
  if (!store) return accountErrorText(new AccountError('format'))
  try {
    action(store)
    version.value++
    return ''
  } catch (error) {
    return accountErrorText(error)
  }
}
