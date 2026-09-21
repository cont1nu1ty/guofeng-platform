<script setup lang="ts">
import { ref, computed, provide } from 'vue'
import { localizeNotice } from '../composables/localizeNotice'
import { getMiniAppHeaderStyle } from '../composables/useMiniAppInsets'
const miniappHeaderStyle = getMiniAppHeaderStyle()
import { region, regionLabel, navigate, largeText, storageError } from '../composables/useDemo'
import type { Screen } from '../composables/useDemo'
import { routeKey, goBack } from '../composables/useNavigation'
import { t, locale, toggleLocale } from '../composables/useLocale'
const props = withDefaults(defineProps<{ screen?: Screen; params?: Record<string, string> }>(), {
  screen: 'home',
  params: () => ({}),
})
provide(
  routeKey,
  computed(() => props.params),
)
const canBack = computed(
  () =>
    Object.keys(props.params).length > 0 &&
    !['news', 'classroom', 'venues', 'learning', 'media', 'hall', 'shop', 'library'].includes(
      props.screen,
    ),
)
import { regions } from '../domain/fixtures'
import type { RegionId } from '../domain/types'
const regionPopup = ref(false)
const nav: { id: Screen; label: string; icon: string }[] = [
  { id: 'home', label: '首页', icon: 'home' },
  { id: 'library', label: '家风典藏', icon: 'book' },
  { id: 'submit', label: '家风投稿', icon: 'edit' },
  { id: 'learning', label: '家风传习', icon: 'company' },
  { id: 'review', label: '评审公示', icon: 'check-circle' },
  { id: 'profile', label: '个人中心', icon: 'user' },
]
const mobileNav = nav.filter((i) => i.id !== 'review')
function selectRegion(id: RegionId) {
  region.value = id
  regionPopup.value = false
}
</script>
<template>
  <view :class="['app-shell', { 'large-text': largeText, 'locale-en': locale === 'en' }]">
    <!-- #ifdef MP-WEIXIN -->
    <view class="miniapp-safe-top" :style="miniappHeaderStyle">
      <text>{{ t('家风文化 · 界面演示', 'Family culture · Demo') }}</text>
    </view>
    <!-- #endif -->
    <view v-if="storageError" class="storage-alert">{{ localizeNotice(storageError) }}</view>
    <view class="utility-bar">
      <view class="container utility-inner">
        <text>
          {{ t('全国家风文化共建共享平台', 'Family culture · A shared national platform') }}
        </text>
        <view>
          <text class="demo-dot" />
          <text>{{ t('交互演示 · 数据为样例', 'Interactive demo · Sample data') }}</text>
        </view>
      </view>
    </view>
    <view class="masthead">
      <view class="container masthead-inner">
        <button class="brand" @click="navigate('home')">
          <view class="brand-seal">
            家
            <br />
            风
          </view>
          <view>
            <text class="brand-name">{{ t('家风中华行') }}</text>
            <text class="brand-en">{{ t('家风文化 · 共建共享', 'FAMILY VALUES · CHINA') }}</text>
          </view>
        </button>
        <view class="header-actions">
          <button
            class="header-search"
            :aria-label="t('全站搜索', 'Search the platform')"
            @click="navigate('search')"
          >
            <wd-icon name="search" size="18px" />
          </button>
          <button class="locale-toggle" @click="toggleLocale">
            {{ locale === 'zh' ? 'EN' : '中文' }}
          </button>
          <button class="region-button" @click="regionPopup = true">
            <wd-icon name="location" size="16px" />
            <text>{{ t(regionLabel) }}{{ t('站', '') }}</text>
            <wd-icon name="arrow-down" size="12px" />
          </button>
          <button class="assistant-link" @click="navigate('assistant')">
            ✦ {{ t('家风助手', 'Assistant') }}
          </button>
          <button class="avatar-button" :aria-label="t('个人中心')" @click="navigate('profile')">
            家
          </button>
        </view>
      </view>
    </view>
    <view class="desktop-nav">
      <view class="container nav-inner">
        <button
          v-for="item in nav"
          :key="item.id"
          :class="['nav-item', { active: screen === item.id }]"
          @click="navigate(item.id)"
        >
          {{ t(item.label) }}
        </button>
        <button
          :class="['nav-item', 'nav-admin', { active: screen === 'admin' }]"
          @click="navigate('admin')"
        >
          {{ t('运营视图', 'Operations') }} ↗
        </button>
      </view>
    </view>
    <view class="container main-content">
      <view v-if="canBack" class="back-bar">
        <button class="text-button" @click="goBack">← {{ t('返回上一页', 'Back') }}</button>
      </view>
      <slot />
    </view>
    <view class="site-footer container">
      <view class="footer-brand">
        <text>{{ t('家风中华行') }}</text>
        <text>{{ t('小家有温度，大家有力量。', 'Strong families, shared values.') }}</text>
      </view>
      <view class="footer-note">
        <text>{{ t('文化共建 · 数字传承', 'Culture shared · Heritage continued') }}</text>
        <text>
          {{ t('需求沟通原型 · 非正式运营平台', 'Discussion prototype · Sample content') }}
        </text>
      </view>
    </view>
    <view class="mobile-nav">
      <button
        v-for="item in mobileNav"
        :key="item.id"
        :class="['mobile-nav-item', { active: screen === item.id }]"
        @click="navigate(item.id)"
      >
        <wd-icon :name="item.icon" size="22px" />
        <text>
          {{
            item.label === '首页'
              ? t('首页')
              : item.label === '个人中心'
                ? t('我的', 'Me')
                : locale === 'en'
                  ? ({ library: 'Library', submit: 'Write', learning: 'Learn' }[
                      item.id as 'library' | 'submit' | 'learning'
                    ] ?? t(item.label))
                  : item.label.slice(2)
          }}
        </text>
      </button>
    </view>
    <wd-popup
      :z-index="100"
      v-model="regionPopup"
      position="center"
      closable
      custom-class="content-popup"
    >
      <view class="dialog-body">
        <text class="eyebrow">{{ t('共建共享 · 地区分站', 'REGIONAL STATIONS') }}</text>
        <text class="section-title">{{ t('选择你的家风分站', 'Choose a regional station') }}</text>
        <text class="section-subtitle">
          {{
            t(
              '34 个省级地区与海外入口；部分地区暂有样例',
              '34 regional choices and overseas; samples are available in selected regions',
            )
          }}
        </text>
        <scroll-view scroll-y class="region-scroll">
          <view class="region-options">
            <button
              v-for="item in regions"
              :key="item.id"
              :class="['choice-card', { active: region === item.id }]"
              @click="selectRegion(item.id)"
            >
              {{ t(item.label) }}
              <text v-if="region === item.id">✓</text>
            </button>
          </view>
        </scroll-view>
        <text class="scope-note">
          {{
            t(
              '地区切换仅用于内容展示，不代表真实数据分库或权限隔离。',
              'Regions filter sample content. This is not account authorization or database isolation.',
            )
          }}
        </text>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped>
.header-search {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 32px;
  padding: 0;
  background: transparent;
  color: var(--jf-ink);
  border: 0;
}
.region-scroll {
  height: 45vh;
  max-height: 420px;
  margin: 18px 0;
}
/* #ifdef MP-WEIXIN */
.miniapp-safe-top {
  display: flex;
  align-items: center;
  padding-left: 18px;
  background: var(--jf-paper);
  color: var(--jf-ink);
  font-size: 12px;
  box-sizing: border-box;
}
.utility-bar {
  display: none;
}
/* #endif */
</style>
