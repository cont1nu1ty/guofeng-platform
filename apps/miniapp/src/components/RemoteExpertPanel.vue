<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  remoteWorkspace,
  remoteUser,
  command,
  refreshWorkspace,
  type RemoteReviewTask,
} from '../services/api'
import RemoteAccountPanel from './RemoteAccountPanel.vue'
const selected = ref<RemoteReviewTask | null>(null)
const scores = ref<number[]>([0, 0, 0, 0])
const comment = ref('')
const busy = ref(false)
const error = ref('')
const canReview = computed(() => remoteUser.value?.roles.includes('expert'))
function open(task: RemoteReviewTask) {
  selected.value = task
  scores.value = [...(task.scores || [0, 0, 0, 0])]
  comment.value = task.comment || ''
  error.value = ''
}
async function submit() {
  const task = selected.value
  if (!task || busy.value || task.status !== 'pending') return
  if (
    scores.value.some(
      (score, i) =>
        !Number.isFinite(Number(score)) ||
        Number(score) < 0 ||
        Number(score) > task.dimensions[i]!.max,
    )
  ) {
    error.value = '请在各项上限内填写评分。'
    return
  }
  if (comment.value.trim().length < 10 || comment.value.trim().length > 1000) {
    error.value = '请填写 10–1000 字的评审意见。'
    return
  }
  busy.value = true
  error.value = ''
  try {
    await command(
      'review.submit',
      task.id,
      { scores: scores.value.map(Number), comment: comment.value.trim() },
      task.version,
    )
    selected.value = remoteWorkspace.reviewTasks.find((x) => x.id === task.id) || null
  } catch (e) {
    error.value = e instanceof Error ? e.message : '评分未提交，请重试。'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <view class="remote-review">
    <RemoteAccountPanel />
    <text class="section-title">专家评审任务</text>
    <view class="scope-note">
      仅显示分配给当前账号的任务。评分绑定稿件版本与量表版本，提交后由评审管理处理结果。
    </view>
    <view v-if="!canReview" class="empty-state">当前账号没有专家权限。</view>
    <template v-else>
      <wd-button size="small" variant="plain" @click="refreshWorkspace().catch(() => {})">
        刷新任务
      </wd-button>
      <view v-if="!remoteWorkspace.reviewTasks.length" class="empty-state">暂无评审任务</view>
      <view
        v-for="task in remoteWorkspace.reviewTasks"
        :key="task.id"
        class="task-card"
        @click="open(task)"
      >
        <text>{{ task.title }}</text>
        <text class="muted">
          {{ task.status === 'submitted' ? '已完成' : '待评分' }} ·
          {{ task.dueAt?.slice(0, 10) || '未设截止日期' }}
        </text>
      </view>
      <view v-if="selected" class="task-detail">
        <text class="section-title">{{ selected.title }}</text>
        <text class="muted">量表 {{ selected.ruleVersion }} · 任务版本 {{ selected.version }}</text>
        <text class="manuscript">{{ selected.content }}</text>
        <view
          v-for="(dimension, index) in selected.dimensions"
          :key="dimension.id"
          class="score-field"
        >
          <text>{{ dimension.label }}（0–{{ dimension.max }}）</text>
          <input
            v-model="scores[index]"
            type="digit"
            class="form-input"
            :disabled="busy || selected.status === 'submitted'"
          />
        </view>
        <textarea
          v-model="comment"
          class="form-input comment"
          maxlength="1000"
          placeholder="请输入 10–1000 字的评审意见"
          :disabled="busy || selected.status === 'submitted'"
        />
        <text v-if="error" class="error-message">{{ error }}</text>
        <wd-button v-if="selected.status === 'pending'" :loading="busy" @click="submit">
          提交评分
        </wd-button>
        <text v-else class="scope-note">评分已提交，不能重复修改。</text>
      </view>
    </template>
  </view>
</template>
<style scoped>
.remote-review {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.task-card,
.task-detail {
  padding: 28rpx;
  border: 1px solid #e0d9cd;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.manuscript {
  white-space: pre-wrap;
  line-height: 1.9;
}
.score-field {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.score-field input {
  max-width: 130px;
}
.comment {
  width: 100%;
  box-sizing: border-box;
  min-height: 160rpx;
}
.error-message {
  color: #a32e27;
}
</style>
