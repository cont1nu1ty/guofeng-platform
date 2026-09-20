import { ref } from 'vue'
export type Locale = 'zh' | 'en'
const initial = (): Locale => { try { return uni.getStorageSync('jiafeng:locale') === 'en' ? 'en' : 'zh' } catch { return 'zh' } }
export const locale = ref<Locale>(initial())
export const translations: Record<string,string> = {
 '首页':'Home','家风典藏':'Library','家风投稿':'Contribute','家风传习':'Learning','评审公示':'Reviews','个人中心':'My account',
 '全国':'National','北京':'Beijing','浙江':'Zhejiang','四川':'Sichuan','家风中华行':'Family Values · China',
 '资讯动态':'News','清廉课堂':'Integrity classroom','短视频展播':'Videos','先贤名人馆':'Heritage halls','文创商城':'Culture gifts',
 'AI 家风助手':'Writing assistant','返回':'Back','查看详情':'View details','全部':'All','搜索':'Search','关闭':'Close',
}
export function t(zh: string, en?: string): string { return locale.value==='en' ? (en ?? translations[zh] ?? zh) : zh }
export function setLocale(value:Locale) {
  locale.value=value
  try { uni.setStorageSync('jiafeng:locale',value) } catch { uni.showToast({title:t('语言已切换，本机未能保存设置','Language changed; preference could not be saved'),icon:'none'}) }
}
export function toggleLocale(){ setLocale(locale.value==='zh'?'en':'zh') }
