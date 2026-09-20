<script setup lang="ts">
import { ref } from 'vue'
import SectionHeading from './SectionHeading.vue'
import {
  myWorks,
  favorites,
  registrations,
  repo,
  navigate,
  openReader,
  largeText,
  register,
} from '../composables/useDemo'
const tab = ref('works')
</script>
<template>
  <view class="profile-hero">
    <view class="profile-avatar">家</view>
    <view>
      <text class="section-title">家风同行者</text>
      <text class="section-subtitle">访客演示身份 · 数据保存在当前设备</text>
    </view>
    <wd-button plain size="small" @click="navigate('submit')">开始创作 ↗</wd-button>
  </view>
  <view class="profile-stats">
    <button @click="tab = 'works'">
      <text>{{ myWorks.length }}</text>
      我的投稿
    </button>
    <button @click="tab = 'favorites'">
      <text>{{ favorites.length }}</text>
      我的收藏
    </button>
    <button @click="tab = 'events'">
      <text>{{ registrations.length }}</text>
      我的预约
    </button>
  </view>
  <view class="profile-layout">
    <view>
      <view class="story-filters">
        <button :class="['filter-chip', { active: tab === 'works' }]" @click="tab = 'works'">
          我的投稿
        </button>
        <button
          :class="['filter-chip', { active: tab === 'favorites' }]"
          @click="tab = 'favorites'"
        >
          我的收藏
        </button>
        <button :class="['filter-chip', { active: tab === 'events' }]" @click="tab = 'events'">
          我的预约
        </button>
      </view>
      <template v-if="tab === 'works'">
        <view v-for="work in myWorks" :key="work.id" class="personal-row">
          <view>
            <text class="tag">{{ work.statusLabel }}</text>
            <text class="story-title" @click="openReader(work)">{{ work.title }}</text>
            <text class="muted">{{ work.id }}</text>
          </view>
          <button class="text-button" @click="navigate('review')">查询进度 →</button>
        </view>
        <view v-if="!myWorks.length" class="empty-state">
          <text>你的第一篇家风故事，从这里开始。</text>
          <wd-button plain @click="navigate('submit')">写一篇作品</wd-button>
        </view>
      </template>
      <template v-else-if="tab === 'favorites'">
        <view
          v-for="work in favorites"
          :key="work.id"
          class="personal-row"
          @click="openReader(work)"
        >
          <view>
            <text class="story-title">{{ work.title }}</text>
            <text class="muted">{{ work.author }}</text>
          </view>
          <text>↗</text>
        </view>
        <view v-if="!favorites.length" class="empty-state">读到喜欢的故事，就把它收藏起来吧。</view>
      </template>
      <template v-else>
        <view v-for="item in registrations" :key="item.activityId" class="personal-row">
          <view>
            <text class="tag">演示预约成功</text>
            <text class="story-title">
              {{ repo.listActivities().find((a) => a.id === item.activityId)?.title }}
            </text>
            <text class="muted">
              {{ repo.listActivities().find((a) => a.id === item.activityId)?.date }}
            </text>
          </view>
          <button class="text-button" @click="register(item.activityId)">取消预约</button>
        </view>
        <view v-if="!registrations.length" class="empty-state">还没有预约，去传习页面看看吧。</view>
      </template>
    </view>
    <view class="settings-card">
      <SectionHeading title="阅读与设置" />
      <view class="setting-row">
        <view>
          <text>大字模式</text>
          <text class="muted">放大正文，阅读更轻松</text>
        </view>
        <wd-switch v-model="largeText" active-color="#C41A1A" />
      </view>
      <view class="setting-row" @click="navigate('assistant')">
        <text>AI 家风助手（示例）</text>
        <text>→</text>
      </view>
      <view class="setting-row" @click="navigate('admin')">
        <text>查看运营演示视图</text>
        <text>→</text>
      </view>
      <text class="scope-note">微信授权、实名认证、消息、证书与语言切换将在后续迭代中接入。</text>
    </view>
  </view>
</template>
