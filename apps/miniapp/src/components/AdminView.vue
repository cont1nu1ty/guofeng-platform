<script setup lang="ts">
import { isHttpMode } from '../config/dataMode'
import RemoteExpertPanel from './RemoteExpertPanel.vue'
import { readInputValue } from '../composables/readInputValue'
import { computed, reactive, ref } from 'vue'
import SectionHeading from './SectionHeading.vue'
import {
  works,
  regionLabel,
  myWorks,
  registrations,
  openReader,
  repo,
  revision,
  region,
  safely,
  notify,
} from '../composables/useDemo'
import { useRouteParams } from '../composables/useNavigation'
import { t } from '../composables/useLocale'
import { reviewStages } from '../domain/fixtures'
import type { ReviewAction, WorkStatus } from '../domain/types'
const params = useRouteParams()
const tab = ref(params.value.tab === 'expert' ? 'expert' : 'overview')
const selectedId = ref('')
const pending = computed(
  () => works.value.filter((work) => work.status === 'pending_initial_review').length,
)
const tasks = computed(() => {
  revision.value
  return repo.listReviewTasks({ region: region.value })
})
const selected = computed(() => {
  revision.value
  return selectedId.value ? repo.getWork(selectedId.value) : undefined
})
const scores = reactive({ theme: '85', writing: '85', originality: '85' })
const comment = ref('')
const reviewer = ref('')
const feedback = ref('')
const statusNames: Record<WorkStatus, string> = {
  pending_initial_review: 'Pending initial review',
  in_review: 'In review',
  returned: 'Changes requested',
  shortlisted: 'Shortlisted',
  awarded: 'Awarded',
  collected: 'Collected',
}
const stageEnglish = [
  'County initial review',
  'City industry review',
  'History expert review',
  'Specialist final review',
  'National recheck',
  'National standards review',
]
const activeReview = computed(
  () => selected.value && ['pending_initial_review', 'in_review'].includes(selected.value.status),
)
function statusLabel(status: WorkStatus, label: string) {
  return t(label, `${statusNames[status]} · Demo`)
}
function selectWork(id: string) {
  selectedId.value = id
  comment.value = ''
  feedback.value = ''
  tab.value = 'expert'
}
async function perform(action: ReviewAction) {
  if (!selected.value) return
  if (
    Object.values(scores).some((value) => !String(value).trim() || !Number.isFinite(Number(value)))
  ) {
    notify(t('请完整填写三项数字评分。', 'Enter a numeric value for all three scores.'))
    return
  }
  const updated = await safely(() =>
    repo.reviewWork(selected.value!.id, {
      action,
      scores: {
        theme: Number(scores.theme),
        writing: Number(scores.writing),
        originality: Number(scores.originality),
      },
      comment: comment.value,
      reviewer: reviewer.value || t('演示评审员（虚构）', 'Demo reviewer (fictional)'),
    }),
  )
  if (updated) {
    feedback.value = t(
      '已保存模拟评审，可在公示与个人中心查看结果。',
      'Simulated review saved. Results are available in Reviews and My account.',
    )
    comment.value = ''
    notify(t('模拟评审已保存', 'Simulated review saved'))
  }
}
</script>
<template>
  <RemoteExpertPanel v-if="isHttpMode" />
  <template v-else>
    <SectionHeading
      :title="t('区域运营与专家工作台', 'Operations and reviewer workspace')"
      :eyebrow="t('区域共建 · 模拟评审', 'OPERATIONS · REVIEW SIMULATION')"
      :subtitle="
        t(
          regionLabel + ' · 本机角色模拟，无真实鉴权或权限隔离',
          t(regionLabel) + ' · Local role simulation; no authentication or access control',
        )
      "
    />
    <view class="scope-note">
      {{
        t(
          '所有评审、评分、授奖和入藏操作只改变本机演示数据，不构成正式审核或荣誉认定。',
          'All scores, review decisions, awards and collection actions affect local demo data only and carry no official recognition.',
        )
      }}
    </view>
    <view class="story-filters">
      <button :class="['filter-chip', { active: tab === 'overview' }]" @click="tab = 'overview'">
        {{ t('运营概览', 'Overview') }}
      </button>
      <button :class="['filter-chip', { active: tab === 'expert' }]" @click="tab = 'expert'">
        {{ t('专家任务与评分', 'Reviewer tasks and scores') }}
      </button>
    </view>
    <view class="admin-metrics">
      <view>
        <text>{{ t('当前地区作品', 'Regional works') }}</text>
        <text>{{ works.length }}</text>
        <text class="muted">{{ t('预置 + 本机数据', 'Samples + local submissions') }}</text>
      </view>
      <view>
        <text>{{ t('待初审作品', 'Pending review') }}</text>
        <text>{{ pending }}</text>
        <text class="muted">{{ t('仅状态统计', 'Demo status count') }}</text>
      </view>
      <view>
        <text>{{ t('本机新增投稿', 'My submissions') }}</text>
        <text>{{ myWorks.length }}</text>
        <text class="muted">{{ t('当前演示身份', 'Current demo identity') }}</text>
      </view>
      <view>
        <text>{{ t('本机预约数', 'My bookings') }}</text>
        <text>{{ registrations.length }}</text>
        <text class="muted">{{ t('无真实活动名额', 'No real reservations') }}</text>
      </view>
    </view>
    <view v-if="tab === 'overview'" class="admin-table">
      <view class="table-row table-header">
        <text>{{ t('作品与作者', 'Work and author') }}</text>
        <text>{{ t('当前状态', 'Status') }}</text>
        <text>{{ t('操作', 'Actions') }}</text>
      </view>
      <view v-for="work in works" :key="work.id" class="table-row">
        <view>
          <text class="table-title">{{ work.title }}</text>
          <text class="muted">{{ work.author }}</text>
        </view>
        <text class="tag">{{ statusLabel(work.status, work.statusLabel) }}</text>
        <view>
          <button class="text-button" @click="openReader(work)">{{ t('查看', 'Read') }} →</button>
          <button
            v-if="!['returned', 'collected'].includes(work.status)"
            class="text-button"
            @click="selectWork(work.id)"
          >
            {{ t('进入评审', 'Review') }} →
          </button>
        </view>
      </view>
    </view>
    <view v-else class="review-workspace">
      <view class="review-task-list">
        <text class="section-title">
          {{ t('待办任务', 'Available tasks') }} · {{ tasks.length }}
        </text>
        <button
          v-for="work in tasks"
          :key="work.id"
          :class="['review-task', { selected: selectedId === work.id }]"
          @click="selectWork(work.id)"
        >
          <text class="story-title">{{ work.title }}</text>
          <text class="muted">{{ work.id }}</text>
          <text class="tag">{{ statusLabel(work.status, work.statusLabel) }}</text>
        </button>
        <view v-if="!tasks.length" class="empty-state">
          {{ t('当前地区没有待办模拟任务。', 'No simulated tasks in this region.') }}
        </view>
      </view>
      <view v-if="selected" class="review-score-card">
        <text class="eyebrow">{{ t('专家评分 · 模拟', 'REVIEWER SCORES · DEMO') }}</text>
        <text class="section-title">{{ selected.title }}</text>
        <text class="muted">
          {{ selected.id }} · {{ t('稿件版本', 'Revision') }} {{ selected.revisionNumber ?? 1 }}
        </text>
        <text class="tag">{{ statusLabel(selected.status, selected.statusLabel) }}</text>
        <text class="reader-paragraph">{{ selected.excerpt }}</text>
        <button class="text-button" @click="openReader(selected)">
          {{ t('阅读完整作品', 'Read full work') }} ↗
        </button>
        <text class="field-label">
          {{ t('当前拟定节点', 'Current proposed stage') }}：{{
            t(
              reviewStages[selected.progressIndex]?.label ?? '',
              stageEnglish[selected.progressIndex],
            )
          }}
        </text>
        <view v-if="!['returned', 'collected'].includes(selected.status)">
          <text class="field-label">{{ t('评审员署名（模拟）', 'Reviewer name (demo)') }}</text>
          <input
            @blur="reviewer = readInputValue($event, reviewer)"
            @confirm="reviewer = readInputValue($event, reviewer)"
            v-model="reviewer"
            class="form-input"
            :placeholder="t('不填则使用虚构演示评审员', 'Leave blank for fictional demo reviewer')"
            maxlength="30"
          />
          <view class="score-grid">
            <view>
              <text class="field-label">{{ t('主题表达', 'Theme') }}</text>
              <input
                @blur="scores.theme = readInputValue($event, scores.theme)"
                @confirm="scores.theme = readInputValue($event, scores.theme)"
                v-model="scores.theme"
                class="form-input"
                type="number"
              />
            </view>
            <view>
              <text class="field-label">{{ t('文字表达', 'Writing') }}</text>
              <input
                @blur="scores.writing = readInputValue($event, scores.writing)"
                @confirm="scores.writing = readInputValue($event, scores.writing)"
                v-model="scores.writing"
                class="form-input"
                type="number"
              />
            </view>
            <view>
              <text class="field-label">{{ t('原创与材料', 'Originality') }}</text>
              <input
                @blur="scores.originality = readInputValue($event, scores.originality)"
                @confirm="scores.originality = readInputValue($event, scores.originality)"
                v-model="scores.originality"
                class="form-input"
                type="number"
              />
            </view>
          </view>
          <text class="muted">
            {{
              t(
                '每项0–100分，等权平均；分数不会自动决定结果。',
                'Each score is 0–100, equally weighted. Scores do not determine decisions automatically.',
              )
            }}
          </text>
          <text class="field-label">
            {{ t('评审意见（5–1000字）', 'Review comment (5–1000 characters)') }}
          </text>
          <textarea
            @blur="comment = readInputValue($event, comment)"
            @confirm="comment = readInputValue($event, comment)"
            v-model="comment"
            :key="selectedId"
            class="writing-area review-comment"
            :maxlength="1000"
            :placeholder="
              t(
                '说明判断依据；退回时请指出可修改的内容。',
                'Explain the decision. Include actionable changes when returning a work.',
              )
            "
          />
          <view class="review-actions">
            <wd-button v-if="activeReview" variant="plain" @click="perform('return')">
              {{ t('退回修改', 'Request changes') }}
            </wd-button>
            <wd-button
              v-if="activeReview && selected.progressIndex < 5"
              @click="perform('advance')"
            >
              {{ t('通过并晋级', 'Approve next stage') }}
            </wd-button>
            <wd-button
              v-if="activeReview && selected.progressIndex === 5"
              @click="perform('shortlist')"
            >
              {{ t('确认入围', 'Confirm shortlist') }}
            </wd-button>
            <wd-button v-if="selected.status === 'shortlisted'" @click="perform('award')">
              {{ t('模拟授奖', 'Simulate award') }}
            </wd-button>
            <wd-button v-if="selected.status === 'awarded'" @click="perform('collect')">
              {{ t('模拟入藏', 'Simulate collection') }}
            </wd-button>
          </view>
        </view>
        <view v-else class="scope-note">
          {{
            selected.status === 'returned'
              ? t(
                  '已退回，投稿人可在个人中心修改并使用原编号重投。',
                  'Returned. The author can revise from My account and resubmit with the same ID.',
                )
              : t(
                  '已完成模拟入藏，当前任务结束。',
                  'Simulated collection completed. This task is closed.',
                )
          }}
        </view>
        <text v-if="feedback" class="review-feedback">{{ feedback }}</text>
      </view>
      <view v-else class="empty-state">
        {{
          t(
            '选择一篇任务，阅读并填写模拟评审。',
            'Select a work to read and complete a simulated review.',
          )
        }}
      </view>
    </view>
  </template>
</template>
<style scoped>
.review-workspace {
  display: grid;
  grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.5fr);
  gap: 24px;
}
.review-task-list,
.review-score-card {
  background: var(--jf-surface, #fffaf1);
  border: 1px solid var(--jf-line, #ded4c3);
  padding: 24px;
  min-width: 0;
}
.review-task {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  text-align: left;
  margin: 16px 0 0;
  padding: 16px;
  background: transparent;
  border: 1px solid #ded4c3;
  border-radius: 0;
  line-height: 1.5;
}
.review-task.selected {
  border-color: #c41a1a;
  background: #f8eee6;
}
.review-task::after {
  border: 0;
}
.review-task .story-title {
  font-size: 17px;
}
.review-score-card > .section-title,
.review-score-card > .muted {
  display: block;
  margin: 12px 0;
}
.score-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 12px 0;
}
.review-comment {
  min-height: 150px;
  height: 150px;
}
.review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}
.review-feedback {
  display: block;
  background: #f5f0e8;
  color: #2c2c2c;
  border-left: 3px solid #c9a96e;
  padding: 16px;
  margin-top: 20px;
}
.review-task .muted {
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .review-workspace {
    grid-template-columns: 1fr;
  }
  .review-task-list,
  .review-score-card {
    padding: 18px;
  }
  .score-grid {
    gap: 8px;
  }
}
</style>
