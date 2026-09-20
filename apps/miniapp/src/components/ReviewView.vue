<script setup lang="ts">
import { ref } from 'vue'
import SectionHeading from './SectionHeading.vue'
import { reviewStages } from '../domain/fixtures'
import { repo, openReader, myWorks } from '../composables/useDemo'
import type { Work } from '../domain/types'
const query = ref('')
const result = ref<Work | null>(null)
const searched = ref(false)
function search(id?: string) {
  if (id) query.value = id
  result.value = repo.getWork(query.value.trim()) ?? null
  searched.value = true
}
</script>
<template>
  <SectionHeading
    title="每一份认真，都有回音"
    eyebrow="REVIEW & PROGRESS"
    subtitle="了解评审路径，查看作品进度。"
  />
  <view class="query-panel">
    <text class="section-title">作品进度查询</text>
    <view class="query-row">
      <input
        v-model="query"
        class="form-input"
        placeholder="输入 DEMO- 开头的演示作品编号"
        aria-label="作品编号"
        @confirm="search()"
      />
      <wd-button @click="search()">查询进度</wd-button>
    </view>
    <view class="sample-query">
      <text class="muted">试一试：</text>
      <button class="text-button" @click="search('DEMO-WORK-003')">DEMO-WORK-003 ↗</button>
      <button v-if="myWorks.length" class="text-button" @click="search(myWorks[0]!.id)">
        最近一次投稿 ↗
      </button>
    </view>
  </view>
  <view v-if="searched && !result" class="empty-state">
    未找到该编号。请检查输入；本演示仅查询当前设备中的作品。
  </view>
  <view v-if="result" class="review-result">
    <view>
      <text class="tag">{{ result.statusLabel }}</text>
      <text class="story-title">{{ result.title }}</text>
      <text class="muted">{{ result.id }} · {{ result.author }}</text>
    </view>
    <button class="text-button" @click="openReader(result!)">查看作品 ↗</button>
  </view>
  <SectionHeading
    title="六级评审 · 拟定流程"
    subtitle="按原讨论稿呈现，评审层级与标准尚待业务确认。"
  />
  <view class="timeline">
    <view
      v-for="(stage, index) in reviewStages"
      :key="stage.id"
      :class="[
        'timeline-item',
        {
          complete: result && (result.status === 'collected' || index < result.progressIndex),
          current: result && result.status !== 'collected' && index === result.progressIndex,
        },
      ]"
    >
      <view class="timeline-dot">
        {{
          result && (result.status === 'collected' || index < result.progressIndex)
            ? '✓'
            : String(index + 1).padStart(2, '0')
        }}
      </view>
      <view class="timeline-copy">
        <view class="timeline-heading">
          <text>{{ stage.label }}</text>
          <text
            v-if="result && result.status !== 'collected' && index === result.progressIndex"
            class="tag"
          >
            当前节点（演示）
          </text>
        </view>
        <text class="muted">{{ stage.description }}</text>
      </view>
    </view>
  </view>
  <view class="scope-note">
    当前进度来自预置样例或本机提交记录，不运行真实工作流；正式版本的私人进度查询需登录并校验作品归属。
  </view>
</template>
