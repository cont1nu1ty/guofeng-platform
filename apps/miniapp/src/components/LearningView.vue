<script setup lang="ts">
import { computed } from 'vue'
import SectionHeading from './SectionHeading.vue'
import {
  repo,
  region,
  register,
  isRegistered,
  registrations,
  revision,
} from '../composables/useDemo'
const activities = computed(() => {
  revision.value
  return repo.listActivities({ region: region.value })
})
</script>
<template>
  <SectionHeading
    title="在行走中，读懂家风"
    eyebrow="LEARN · EXPERIENCE · INHERIT"
    subtitle="从线上共读到线下研学，让好家风走进日常。"
  />
  <view class="learning-intro">
    <view class="learning-stamp">
      知
      <br />
      行
    </view>
    <view>
      <text class="section-title">一堂家风课，一次心灵之旅</text>
      <text class="section-subtitle">清廉课堂 · 家书共读 · 文化研学</text>
    </view>
    <view class="registration-count">
      <text>{{ registrations.length }}</text>
      <text>我的演示预约</text>
    </view>
  </view>
  <view class="activity-grid">
    <view v-for="(event, index) in activities" :key="event.id" class="activity-card">
      <view :class="['activity-art', 'activity-art-' + index]">
        <text class="tag">{{ event.category }}</text>
        <view class="arch-art"><view class="arch-inner" /></view>
        <text class="activity-art-label">{{ ['书香', '清风', '传习'][index % 3] }}</text>
      </view>
      <view class="activity-content">
        <view class="story-meta">
          <text>{{ event.date }}</text>
          <text>· {{ event.time }}</text>
        </view>
        <text class="story-title">{{ event.title }}</text>
        <text class="story-excerpt">{{ event.excerpt }}</text>
        <view class="event-location">
          <wd-icon name="location" />
          {{ event.location }}
        </view>
        <view class="card-bottom">
          <text class="muted">{{ event.registeredCount }} / {{ event.capacity }} 人（示例）</text>
          <wd-button :plain="isRegistered(event.id)" size="small" @click="register(event.id)">
            {{ isRegistered(event.id) ? '取消预约' : '预约体验' }}
          </wd-button>
        </view>
      </view>
    </view>
  </view>
  <view v-if="!activities.length" class="empty-state">该地区暂未安排演示活动，切换全国查看。</view>
  <view class="scope-note">
    预约只记录在当前设备，不占用真实名额。地图导航、签到与结业证书安排在后续迭代。
  </view>
</template>
