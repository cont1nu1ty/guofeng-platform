<script setup lang="ts">
import { computed } from 'vue'
import SectionHeading from './SectionHeading.vue'
import { works, regionLabel, myWorks, registrations, openReader } from '../composables/useDemo'
const pending = computed(
  () => works.value.filter((w) => w.status === 'pending_initial_review').length,
)
</script>
<template>
  <SectionHeading
    title="区域运营概览"
    eyebrow="OPERATIONS PREVIEW"
    :subtitle="regionLabel + ' · 展示用运营视图，未接入管理后台'"
  />
  <view class="admin-metrics">
    <view>
      <text>当前地区作品</text>
      <text>{{ works.length }}</text>
      <text class="muted">预置 + 本机数据</text>
    </view>
    <view>
      <text>待初审作品</text>
      <text>{{ pending }}</text>
      <text class="muted">仅状态统计</text>
    </view>
    <view>
      <text>本机新增投稿</text>
      <text>{{ myWorks.length }}</text>
      <text class="muted">当前演示身份</text>
    </view>
    <view>
      <text>本机预约数</text>
      <text>{{ registrations.length }}</text>
      <text class="muted">无真实活动名额</text>
    </view>
  </view>
  <view class="admin-table">
    <view class="table-row table-header">
      <text>作品与作者</text>
      <text>当前状态</text>
      <text>操作</text>
    </view>
    <view v-for="work in works" :key="work.id" class="table-row">
      <view>
        <text class="table-title">{{ work.title }}</text>
        <text class="muted">{{ work.author }}</text>
      </view>
      <text class="tag">{{ work.statusLabel }}</text>
      <button class="text-button" @click="openReader(work)">查看 →</button>
    </view>
  </view>
  <view class="scope-note">
    正式管理端计划复用 RuoYi-Vue-Plus /
    plus-ui。当前页面没有鉴权、租户隔离或审批写入能力；切换地区仅筛选演示数据。
  </view>
</template>
