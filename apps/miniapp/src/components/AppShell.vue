<script setup lang="ts">
import { ref, computed, provide } from 'vue'
import HomeView from './HomeView.vue'
import SubmitView from './SubmitView.vue'
import LibraryView from './LibraryView.vue'
import LearningView from './LearningView.vue'
import ReviewView from './ReviewView.vue'
import ProfileView from './ProfileView.vue'
import AssistantView from './AssistantView.vue'
import AdminView from './AdminView.vue'
import {
  region,
  regionLabel,
  navigate,
  largeText,
  reader,
  verticalReading,
  favorite,
  isFavorite,
  storageError,
} from '../composables/useDemo'
import type { Screen } from '../composables/useDemo'
import { routeKey, goBack } from '../composables/useNavigation'
import { t, locale, toggleLocale } from '../composables/useLocale'
import NewsView from './NewsView.vue'
import ClassroomView from './ClassroomView.vue'
import VenuesView from './VenuesView.vue'
import MediaView from './MediaView.vue'
import HallView from './HallView.vue'
import ShopView from './ShopView.vue'
const props = withDefaults(defineProps<{ screen?: Screen; params?:Record<string,string> }>(),{screen:'home',params:()=>({})})
provide(routeKey,computed(()=>props.params))
const canBack = computed(()=>Object.keys(props.params).length>0 && !['news','classroom','venues','learning','media','hall','shop'].includes(props.screen))
import { regions } from '../domain/fixtures'
import type { RegionId } from '../domain/types'
const regionPopup = ref(false)
const readerVisible = computed({
  get: () => !!reader.value,
  set: (value: boolean) => {
    if (!value) reader.value = null
  },
})
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
  <view :class="['app-shell', { 'large-text': largeText, 'locale-en':locale==='en' }]">
    <view v-if="storageError" class="storage-alert">{{ storageError }}</view>
    <view class="utility-bar">
      <view class="container utility-inner">
        <text>{{ t('全国家风文化共建共享平台','Family culture · A shared national platform') }}</text>
        <view>
          <text class="demo-dot" />
          <text>{{ t('交互演示 · 数据为样例','Interactive demo · Sample data') }}</text>
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
            <text class="brand-en">{{ t('家风文化 · 共建共享','FAMILY VALUES · CHINA') }}</text>
          </view>
        </button>
        <view class="header-actions">
<button class="locale-toggle" @click="toggleLocale">{{ locale==='zh'?'EN':'中文' }}</button>
          <button class="region-button" @click="regionPopup = true">
            <wd-icon name="location" size="16px" />
            <text>{{ t(regionLabel) }}{{ t('站','') }}</text>
            <wd-icon name="arrow-down" size="12px" />
          </button>
          <button class="assistant-link" @click="navigate('assistant')">✦ {{ t('家风助手','Assistant') }}</button>
          <button class="avatar-button" aria-label="个人中心" @click="navigate('profile')">
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
          {{ t('运营视图','Operations') }} ↗
        </button>
      </view>
    </view>
    <view class="container main-content">
<view v-if="canBack" class="back-bar"><button class="text-button" @click="goBack">← {{ t('返回上一页','Back') }}</button></view>
      <HomeView v-if="screen === 'home'" />
      <SubmitView v-else-if="screen === 'submit'" />
      <LibraryView v-else-if="screen === 'library'" />
      <LearningView v-else-if="screen === 'learning'" />
      <ReviewView v-else-if="screen === 'review'" />
      <ProfileView v-else-if="screen === 'profile'" />
      <AssistantView v-else-if="screen === 'assistant'" />
      <AdminView v-else-if="screen === 'admin'" />
<NewsView v-else-if="screen==='news'"/><ClassroomView v-else-if="screen==='classroom'"/><VenuesView v-else-if="screen==='venues'"/><MediaView v-else-if="screen==='media'"/><HallView v-else-if="screen==='hall'"/><ShopView v-else-if="screen==='shop'"/>
    </view>
    <view class="site-footer container">
      <view class="footer-brand">
        <text>{{ t('家风中华行') }}</text>
        <text>小家有温度，大家有力量。</text>
      </view>
      <view class="footer-note">
        <text>文化共建 · 数字传承</text>
        <text>需求沟通原型 v0.1 · 非正式运营平台</text>
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
                ? t('我的','Me')
                : locale==='en' ? ({library:'Library',submit:'Write',learning:'Learn'}[item.id as 'library'|'submit'|'learning'] ?? t(item.label)) : item.label.slice(2)
          }}
        </text>
      </button>
    </view>
    <wd-popup v-model="regionPopup" position="center" closable custom-class="content-popup">
      <view class="dialog-body">
        <text class="eyebrow">REGIONAL STATIONS</text>
        <text class="section-title">选择你的家风分站</text>
        <text class="section-subtitle">当前开放三个地区的样例内容</text>
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
        <text class="scope-note">地区切换仅用于内容展示，不代表真实数据分库或权限隔离。</text>
      </view>
    </wd-popup>
    <wd-popup v-model="readerVisible" position="center" closable custom-class="reader-popup">
      <view v-if="reader" class="reader-body">
        <view class="reader-toolbar">
          <text class="tag">演示原创篇章</text>
          <view>
            <button class="text-button" @click="verticalReading = !verticalReading">
              {{ verticalReading ? '横排阅读' : '竖排阅读' }}
            </button>
            <button class="text-button" @click="largeText = !largeText">
              {{ largeText ? '标准字号' : '大字阅读' }}
            </button>
          </view>
        </view>
        <text class="reader-title">{{ reader.title }}</text>
        <text class="reader-author">{{ reader.author }}</text>
        <scroll-view
          scroll-y
          scroll-x
          :class="['reader-scroll', { vertical: verticalReading, 'reader-large': largeText }]"
        >
          <view class="reader-content">
            <text
              v-for="(paragraph, index) in reader.content.split('\n\n')"
              :key="index"
              class="reader-paragraph"
            >
              {{ paragraph }}
            </text>
          </view>
        </scroll-view>
        <view class="reader-actions">
          <wd-button variant="plain" size="small" @click="favorite(reader!.id)">
            {{ isFavorite(reader.id) ? '★ 已收藏' : '☆ 收藏篇章' }}
          </wd-button>
          <button class="text-button" @click="reader = null">结束阅读 →</button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>
