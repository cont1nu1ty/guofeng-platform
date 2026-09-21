<script setup lang="ts">
import { readInputValue } from '../composables/readInputValue'
import { computed, ref, watch } from 'vue'
import SectionHeading from './SectionHeading.vue'
import CertificateExport from './CertificateExport.vue'
import { reviewStages, reviewStandards } from '../domain/fixtures'
import { repo, openReader, myWorks, revision, reviewQuery, navigate } from '../composables/useDemo'
import { useRouteParams } from '../composables/useNavigation'
import { t } from '../composables/useLocale'
import type { WorkStatus, ReviewAction } from '../domain/types'
const params = useRouteParams()
const query = ref(reviewQuery.value)
const searchedId = ref('')
const searched = ref(false)
const publicTab = ref<'shortlisted' | 'awarded' | 'collected'>('shortlisted')
const certificateVisible = ref(false)
const result = computed(() => {
  revision.value
  return searchedId.value ? repo.getWork(searchedId.value) : undefined
})
const publicWorks = computed(() => {
  revision.value
  return repo.listPublicWorks(publicTab.value)
})
const certificate = computed(() => {
  revision.value
  return result.value ? repo.getCertificate(result.value.id) : undefined
})
const statusNames: Record<WorkStatus, string> = {
  pending_initial_review: 'Pending initial review',
  in_review: 'In review',
  returned: 'Changes requested',
  shortlisted: 'Shortlisted',
  awarded: 'Awarded',
  collected: 'Collected',
}
const actionNames: Record<ReviewAction, [string, string]> = {
  return: ['退回修改', 'Changes requested'],
  advance: ['通过晋级', 'Advanced'],
  shortlist: ['确认入围', 'Shortlisted'],
  award: ['模拟授奖', 'Simulated award'],
  collect: ['模拟入藏', 'Simulated collection'],
}
const stageEnglish = [
  'County initial review',
  'City industry review',
  'History expert review',
  'Specialist final review',
  'National recheck',
  'National standards review',
]
const standardEnglish = [
  {
    title: 'Theme',
    description:
      'A clear family culture theme, positive expression, and respect for everyday experience.',
  },
  {
    title: 'Writing',
    description: 'Clear structure and fluent writing that fits the selected literary genre.',
  },
  {
    title: 'Originality and materials',
    description:
      'Review originality declarations, completeness and privacy. This is not a real plagiarism check.',
  },
]
function search(id?: string) {
  if (id) query.value = id
  searchedId.value = query.value.trim()
  reviewQuery.value = searchedId.value
  searched.value = true
}
function selectPublic(id: string) {
  search(id)
  uni.pageScrollTo({ scrollTop: 0, duration: 200 })
}
function complete(index: number) {
  return (
    !!result.value &&
    (['shortlisted', 'awarded', 'collected'].includes(result.value.status) ||
      index < result.value.progressIndex)
  )
}
function current(index: number) {
  return (
    !!result.value &&
    !['shortlisted', 'awarded', 'collected'].includes(result.value.status) &&
    index === result.value.progressIndex
  )
}
function actionLabel(action: ReviewAction) {
  const label = actionNames[action]
  return label ? t(label[0], label[1]) : String(action)
}
watch(
  () => params.value.id,
  (id) => {
    if (id) search(id)
    else if (reviewQuery.value) search(reviewQuery.value)
  },
  { immediate: true },
)
</script>
<template>
  <SectionHeading
    :title="t('每一份认真，都有回音', 'Every story deserves a response')"
    :eyebrow="t('评审公示 · 进度查询', 'REVIEW & PROGRESS')"
    :subtitle="
      t(
        '查询本机作品进度、评语与模拟公示。',
        'Track local submissions, feedback and simulated public results.',
      )
    "
  />
  <view class="query-panel">
    <text class="section-title">{{ t('作品进度查询', 'Track a submission') }}</text>
    <view class="query-row">
      <input
        @blur="query = readInputValue($event, query)"
        v-model="query"
        class="form-input"
        :placeholder="t('输入 DEMO- 开头的演示作品编号', 'Enter a demo ID beginning with DEMO-')"
        :aria-label="t('作品编号', 'Work ID')"
        @confirm="search(readInputValue($event, query))"
      />
      <wd-button @click="search()">{{ t('查询进度', 'Track progress') }}</wd-button>
    </view>
    <view class="sample-query">
      <text class="muted">{{ t('试一试：', 'Try:') }}</text>
      <button class="text-button" @click="search('DEMO-WORK-003')">DEMO-WORK-003 ↗</button>
      <button v-if="myWorks.length" class="text-button" @click="search(myWorks[0]!.id)">
        {{ t('最近一次投稿', 'Latest submission') }} ↗
      </button>
    </view>
  </view>
  <view v-if="searched && !result" class="empty-state">
    {{
      t(
        '未找到该编号。本演示仅查询预置样例和当前设备中的作品。',
        'No matching ID. Only sample works and submissions on this device are available.',
      )
    }}
  </view>
  <view v-if="result" class="review-result">
    <view>
      <text class="tag">{{ t(result.statusLabel, statusNames[result.status] + ' · Demo') }}</text>
      <text class="story-title">{{ result.title }}</text>
      <text class="muted">
        {{ result.id }} · {{ result.author }} · {{ t('版本', 'Revision') }}
        {{ result.revisionNumber ?? 1 }}
      </text>
    </view>
    <view>
      <button class="text-button" @click="openReader(result)">
        {{ t('查看作品', 'Read work') }} ↗
      </button>
      <button v-if="certificate" class="text-button" @click="certificateVisible = true">
        {{ t('预览模拟证书', 'Preview demo certificate') }} ↗
      </button>
    </view>
  </view>
  <view v-if="result?.status === 'returned'" class="scope-note">
    {{
      t(
        '作品已退回修改。请查看下方意见，在个人中心使用“修改重投”继续；原编号与历史评语会保留。',
        'Changes requested. Read the feedback below, then use Revise and resubmit in My account. The ID and previous feedback are retained.',
      )
    }}
  </view>
  <view v-if="result && result.reviews?.length" class="review-history">
    <text class="section-title">{{ t('评分与评审意见', 'Scores and reviewer feedback') }}</text>
    <view
      v-for="entry in [...(result.reviews ?? [])].reverse()"
      :key="entry.id"
      class="review-history-item"
    >
      <view class="history-heading">
        <text class="tag">
          {{ actionLabel(entry.action) }} · {{ t('版本', 'Rev') }} {{ entry.submissionRevision }}
        </text>
        <text class="muted">{{ t('均分', 'Average') }} {{ entry.averageScore }} / 100</text>
      </view>
      <text class="reader-paragraph">{{ entry.comment }}</text>
      <text class="muted">
        {{ entry.reviewer }} · {{ entry.createdAt.slice(0, 10) }} · {{ t('节点', 'Stage') }}
        {{ entry.stageIndex + 1 }}
      </text>
    </view>
  </view>
  <SectionHeading
    :title="t('六级评审 · 拟定流程', 'Six proposed review stages')"
    :subtitle="
      t(
        '依原讨论稿演示，层级与标准尚待确认；所有流转仅在本机模拟。',
        'Based on the discussion draft. Stages and standards are provisional; transitions are simulated locally.',
      )
    "
  />
  <view class="timeline">
    <view
      v-for="(stage, index) in reviewStages"
      :key="stage.id"
      :class="['timeline-item', { complete: complete(index), current: current(index) }]"
    >
      <view class="timeline-dot">
        {{ complete(index) ? '✓' : String(index + 1).padStart(2, '0') }}
      </view>
      <view class="timeline-copy">
        <view class="timeline-heading">
          <text>{{ t(stage.label, stageEnglish[index]) }}</text>
          <text v-if="current(index)" class="tag">
            {{ t('当前节点（演示）', 'Current stage · Demo') }}
          </text>
        </view>
        <text class="muted">
          {{
            t(
              stage.description,
              'Proposed review step. Ownership, process and standards are yet to be confirmed.',
            )
          }}
        </text>
      </view>
    </view>
  </view>
  <SectionHeading
    :title="t('模拟结果公示', 'Simulated public results')"
    :subtitle="
      t(
        '以下仅为虚构样例或本机操作结果，不构成正式入选、荣誉或馆藏。',
        'Fictional examples and local simulation results. No official selection, award or collection is implied.',
      )
    "
  />
  <view class="story-filters">
    <button
      :class="['filter-chip', { active: publicTab === 'shortlisted' }]"
      @click="publicTab = 'shortlisted'"
    >
      {{ t('入围名单', 'Shortlist') }}
    </button>
    <button
      :class="['filter-chip', { active: publicTab === 'awarded' }]"
      @click="publicTab = 'awarded'"
    >
      {{ t('获奖名单', 'Awards') }}
    </button>
    <button
      :class="['filter-chip', { active: publicTab === 'collected' }]"
      @click="publicTab = 'collected'"
    >
      {{ t('典藏名单', 'Collection') }}
    </button>
  </view>
  <view class="public-list">
    <view v-for="work in publicWorks" :key="work.id" class="personal-row">
      <view>
        <text class="tag">{{ t(work.statusLabel, statusNames[work.status] + ' · Demo') }}</text>
        <text class="story-title">{{ work.title }}</text>
        <text class="muted">{{ work.author }} · {{ work.id }}</text>
      </view>
      <button class="text-button" @click="selectPublic(work.id)">
        {{ t('查看进度', 'View progress') }} →
      </button>
    </view>
    <view v-if="!publicWorks.length" class="empty-state">
      {{
        t(
          '该名单暂没有模拟结果，可到专家工作台体验评审。',
          'No simulated results yet. Try a review in the reviewer workspace.',
        )
      }}
    </view>
  </view>
  <SectionHeading
    :title="t('评分参考标准 · 待定', 'Proposed scoring criteria')"
    :subtitle="
      t(
        '三项等权平均，0–100分；最终规则由业务方确认，分数不自动授奖。',
        'Three equally weighted scores, each 0–100. Rules require confirmation; scores do not grant awards automatically.',
      )
    "
  />
  <view class="review-standards">
    <view v-for="(standard, index) in reviewStandards" :key="standard.id">
      <text class="story-title">{{ t(standard.label, standardEnglish[index]!.title) }}</text>
      <text class="reader-paragraph">
        {{ t(standard.description, standardEnglish[index]!.description) }}
      </text>
      <text class="muted">{{ t(standard.weight, 'Equal weight · 0–100') }}</text>
    </view>
  </view>
  <button class="text-button" @click="navigate('admin', { tab: 'expert' })">
    {{ t('进入模拟专家工作台', 'Open simulated reviewer workspace') }} ↗
  </button>
  <view class="scope-note">
    {{
      t(
        '本页没有真实身份校验。正式版本必须登录并验证作品归属后，才能查询私人评语与证书；公开名单另行发布。',
        'This page has no real identity checks. Production access to private feedback and certificates requires login and ownership validation; public lists are published separately.',
      )
    }}
  </view>
  <wd-popup
    :z-index="100"
    v-model="certificateVisible"
    position="center"
    closable
    custom-class="content-popup"
  >
    <view v-if="certificate" class="dialog-body certificate-demo">
      <text class="eyebrow">
        {{ t('模拟证书 · 无正式效力', 'DEMO CERTIFICATE · NO OFFICIAL VALIDITY') }}
      </text>
      <text class="section-title">
        {{
          t(
            certificate.awardLabel,
            certificate.awardLabel.includes('典藏')
              ? 'Collection certificate'
              : 'Sample award certificate',
          )
        }}
      </text>
      <text class="reader-paragraph">{{ certificate.title }}</text>
      <text>{{ certificate.author }}</text>
      <text class="muted">{{ certificate.id }}</text>
      <text class="muted">{{ certificate.issuedAt.slice(0, 10) }}</text>
      <text class="scope-note">
        {{
          t(
            '仅用于功能演示，不含真实签章，不代表官方奖项或版权凭证。',
            'For demonstration only. No authentic seal, official award or copyright certification.',
          )
        }}
      </text>
      <CertificateExport
        :certificate="{
          id: certificate.id,
          title: t(
            certificate.awardLabel,
            certificate.awardLabel.includes('典藏')
              ? 'Collection certificate'
              : 'Sample award certificate',
          ),
          recipient: certificate.author,
          subject: certificate.title,
          date: certificate.issuedAt,
        }"
      />
      <wd-button variant="plain" @click="certificateVisible = false">
        {{ t('关闭', 'Close') }}
      </wd-button>
    </view>
  </wd-popup>
</template>
<style scoped>
.review-history {
  padding: 24px;
  background: #fffaf1;
  border: 1px solid #ded4c3;
  margin-bottom: 32px;
}
.review-history-item {
  padding: 18px 0;
  border-bottom: 1px solid #e4dac9;
}
.review-history-item:last-child {
  border-bottom: 0;
}
.history-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.review-standards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin: 24px 0;
}
.review-standards > view {
  padding: 24px;
  border: 1px solid #ded4c3;
  background: #fffaf1;
}
.certificate-demo {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.certificate-demo > .muted {
  overflow-wrap: anywhere;
}
.review-result .muted,
.public-list .muted {
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .review-standards {
    grid-template-columns: 1fr;
  }
  .review-history {
    padding: 18px;
  }
}
</style>
