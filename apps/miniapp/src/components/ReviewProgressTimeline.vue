<script setup lang="ts">
import { ref, watch } from 'vue'
import { t } from '../composables/useLocale'
import { reviewStateLabels, type ReviewTimeline } from '../domain/reviewProgress'
const props = defineProps<{ timeline: ReviewTimeline }>()
const expanded = ref('')
const stateLabel = (state: string) => {
  const value = reviewStateLabels[state] ?? reviewStateLabels.unknown!
  return t(value[0], value[1])
}
watch(
  () => props.timeline.revisionNumber,
  () => {
    expanded.value = ''
  },
)
</script>
<template>
  <view class="review-progress">
    <text class="section-title">
      {{ t('本版本评审进度', 'Review progress for this revision') }}
    </text>
    <text class="muted">
      {{ t('稿件版本', 'Submission revision') }} {{ timeline.revisionNumber }} ·
      {{
        timeline.flowVersion
          ? `${t('流程版本', 'Workflow version')} ${timeline.flowVersion}`
          : t('流程版本未记录', 'Workflow version unrecorded')
      }}
    </text>
    <text class="scope-note">
      {{
        timeline.source === 'unrecorded'
          ? t(
              '本历史版本没有保存流程配置，不推断各节点完成情况或评分标准。',
              'This historical revision has no saved configuration. Stage completion and standards are not inferred.',
            )
          : timeline.source === 'legacy_snapshot_unlinked'
            ? t(
                '本历史版本保存了流程标准，但没有可关联的办理实例，不推断是否启动或完成。',
                'This historical revision has saved standards but no linked workflow evidence. Whether it started or completed is unknown.',
              )
            : t(
                '展示本稿件版本绑定的流程与量表，办理状态来自实际工作流记录。后续配置变更不会改写本版本。',
                'These stages and rubrics are bound to this revision. Status comes from recorded workflow actions; later configuration changes do not alter this version.',
              )
      }}
    </text>
    <view
      v-for="(stage, index) in timeline.stages"
      :key="stage.id"
      class="progress-stage"
      :class="stage.state"
    >
      <view class="progress-index">{{ String(index + 1).padStart(2, '0') }}</view>
      <view class="progress-copy">
        <view class="progress-heading">
          <text>{{ stage.label }}</text>
          <text class="tag">{{ stateLabel(stage.state) }}</text>
        </view>
        <text v-if="stage.completedAt" class="muted">
          {{ stage.completedAt.replace('T', ' ').replace('Z', ' UTC') }}
        </text>
        <wd-button
          v-if="stage.rubric"
          size="small"
          variant="plain"
          :aria-label="`${stage.label} ${t('评分标准', 'scoring standards')}`"
          @click="expanded = expanded === stage.id ? '' : stage.id"
        >
          {{
            expanded === stage.id
              ? t('收起标准', 'Hide standards')
              : t('查看评分标准', 'View standards')
          }}
        </wd-button>
        <view v-if="stage.rubric && expanded === stage.id" class="progress-rubric">
          <text>{{ stage.rubric.title }} · {{ stage.rubric.ruleVersion }}</text>
          <text v-for="dimension in stage.rubric.dimensions" :key="dimension.id">
            {{ dimension.label }} · {{ dimension.max }} {{ t('分', 'points') }}
            <text v-if="dimension.description">— {{ dimension.description }}</text>
          </text>
        </view>
      </view>
    </view>
    <view v-if="timeline.events.length" class="progress-events">
      <text class="section-title">{{ t('办理记录', 'Recorded actions') }}</text>
      <text v-for="(event, index) in timeline.events" :key="index">
        {{ event.stage }} · {{ stateLabel(event.outcome) }} ·
        {{ event.time.replace('T', ' ').replace('Z', ' UTC') }}
      </text>
    </view>
  </view>
</template>
<style scoped>
.review-progress,
.progress-copy,
.progress-rubric,
.progress-events {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.review-progress {
  margin: 40rpx 0;
}
.progress-stage {
  display: flex;
  gap: 20rpx;
  padding: 24rpx 0;
  border-bottom: 1px solid var(--border, #e3ddd2);
}
.progress-index {
  color: var(--color-primary, #c41a1a);
  font-weight: 600;
  min-width: 48rpx;
}
.progress-copy {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  align-items: flex-start;
}
.progress-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12rpx;
}
.progress-stage.current {
  border-left: 4px solid var(--color-primary, #c41a1a);
  padding-left: 20rpx;
}
.progress-rubric,
.progress-events {
  line-height: 1.8;
  overflow-wrap: anywhere;
}
</style>
