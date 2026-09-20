<script setup lang="ts">
import { ref, computed } from 'vue'
import HomeView from '../../components/HomeView.vue'
import SubmitView from '../../components/SubmitView.vue'
import LibraryView from '../../components/LibraryView.vue'
import LearningView from '../../components/LearningView.vue'
import ReviewView from '../../components/ReviewView.vue'
import ProfileView from '../../components/ProfileView.vue'
import AssistantView from '../../components/AssistantView.vue'
import AdminView from '../../components/AdminView.vue'
import {
  screen,
  region,
  regionLabel,
  navigate,
  largeText,
  reader,
  verticalReading,
  favorite,
  isFavorite,
  storageError,
} from '../../composables/useDemo'
import type { Screen } from '../../composables/useDemo'
import { regions } from '../../domain/fixtures'
import type { RegionId } from '../../domain/types'
const regionPopup = ref(false)
const featurePopup = ref(false)
const feature = ref('')
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
const featureDetails: Record<string, string> = {
  短视频展播:
    '规划提供家风短视频分类展播、合集、直播与回放。下一步需要确定视频样片、版权和媒体服务方案。',
  先贤名人馆: '规划提供先贤资料、宗祠图文与全景漫游。下一步需要确定首批馆藏、史料授权和全景素材。',
  文创商城: '规划支持公益申领与政务商业定制。下一步需要确定商品目录、申领规则及订单支付流程。',
}
function selectRegion(id: RegionId) {
  region.value = id
  regionPopup.value = false
}
function showFeature(name: string) {
  feature.value = name
  featurePopup.value = true
}
</script>
<template>
  <view :class="['app-shell', { 'large-text': largeText }]">
    <view v-if="storageError" class="storage-alert">{{ storageError }}</view>
    <view class="utility-bar">
      <view class="container utility-inner">
        <text>全国家风文化共建共享平台</text>
        <view>
          <text class="demo-dot" />
          <text>交互演示 · 数据为样例</text>
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
            <text class="brand-name">家风中华行</text>
            <text class="brand-en">FAMILY VALUES · CHINA</text>
          </view>
        </button>
        <view class="header-actions">
          <button class="region-button" @click="regionPopup = true">
            <wd-icon name="location" size="16px" />
            <text>{{ regionLabel }}站</text>
            <wd-icon name="arrow-down" size="12px" />
          </button>
          <button class="assistant-link" @click="navigate('assistant')">✦ 家风助手</button>
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
          {{ item.label }}
        </button>
        <button
          :class="['nav-item', 'nav-admin', { active: screen === 'admin' }]"
          @click="navigate('admin')"
        >
          运营视图 ↗
        </button>
      </view>
    </view>
    <view class="container main-content">
      <HomeView v-if="screen === 'home'" @feature="showFeature" />
      <SubmitView v-else-if="screen === 'submit'" />
      <LibraryView v-else-if="screen === 'library'" />
      <LearningView v-else-if="screen === 'learning'" />
      <ReviewView v-else-if="screen === 'review'" />
      <ProfileView v-else-if="screen === 'profile'" />
      <AssistantView v-else-if="screen === 'assistant'" />
      <AdminView v-else-if="screen === 'admin'" />
    </view>
    <view class="site-footer container">
      <view class="footer-brand">
        <text>家风中华行</text>
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
              ? '首页'
              : item.label === '个人中心'
                ? '我的'
                : item.label.slice(2)
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
            {{ item.label }}
            <text v-if="region === item.id">✓</text>
          </button>
        </view>
        <text class="scope-note">地区切换仅用于内容展示，不代表真实数据分库或权限隔离。</text>
      </view>
    </wd-popup>
    <wd-popup v-model="featurePopup" position="center" closable custom-class="content-popup">
      <view class="dialog-body">
        <text class="eyebrow">COMING IN A FUTURE ITERATION</text>
        <text class="section-title">{{ feature }}</text>
        <text class="tag">规划中 · 尚未实现</text>
        <text class="reader-paragraph">{{ featureDetails[feature] }}</text>
        <wd-button block @click="featurePopup = false">返回首页</wd-button>
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
          <wd-button plain size="small" @click="favorite(reader!.id)">
            {{ isFavorite(reader.id) ? '★ 已收藏' : '☆ 收藏篇章' }}
          </wd-button>
          <button class="text-button" @click="reader = null">结束阅读 →</button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>
