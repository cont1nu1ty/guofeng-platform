<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import SectionHeading from '../../components/SectionHeading.vue'
import { navigate, goBack, useRouteParams } from '../../composables/useNavigation'
import { remoteUser } from '../../services/api'
import { t } from '../../composables/useLocale'
import { useEducation } from '../composables/useEducation'
import { allQuestionsAnswered, type AssignedGroup } from '../domain/education'
const params = useRouteParams()
const { courses, account, course, progress, error, busy, result, load, change } = useEducation()
const lessonIndex = ref(0),
  identityOpen = ref(false)
const answers = reactive<Record<string, string>>({})
const accepted = reactive<Record<string, boolean>>({})
const identity = reactive({ organization: '', requestNote: '' })
const lesson = computed(() => course.value?.lessons[lessonIndex.value])
const canQuiz = computed(
  () => !!course.value && course.value.lessons.every((l) => progress.value.lessons.includes(l.id)),
)
const answerReady = computed(() => !!course.value && allQuestionsAnswered(course.value, answers))
const identityLabel = computed(() =>
  account.value.identity?.status === 'approved'
    ? t('人工审核通过', 'Manually approved')
    : account.value.identity?.status === 'pending'
      ? t('等待人工审核', 'Awaiting review')
      : account.value.identity?.status === 'rejected'
        ? t('已退回，可修改申请', 'Returned for revision')
        : t('未申请', 'Not requested'),
)
watch(
  () => [params.value.id, params.value.version, remoteUser.value?.id],
  () => {
    lessonIndex.value = 0
    Object.keys(answers).forEach((k) => delete answers[k])
    Object.keys(accepted).forEach((k) => delete accepted[k])
    void load(params.value.id, params.value.version)
  },
  { immediate: true },
)
function reload() {
  return load(params.value.id, params.value.version)
}
async function markLesson() {
  if (!course.value || !lesson.value) return
  if (
    await change('course.progress', course.value.id, {
      publicationVersion: course.value.publicationVersion,
      lessonId: lesson.value.id,
    })
  ) {
    if (lessonIndex.value < course.value.lessons.length - 1) lessonIndex.value++
  }
}
async function answerQuiz() {
  if (course.value && canQuiz.value && answerReady.value)
    await change('course.progress', course.value.id, {
      publicationVersion: course.value.publicationVersion,
      answers: { ...answers },
    })
}
function openIdentity() {
  Object.assign(identity, {
    organization: account.value.identity?.organization || '',
    requestNote: account.value.identity?.requestNote || '',
  })
  identityOpen.value = !identityOpen.value
}
async function saveIdentity() {
  if (await change('education.requestIdentity', '', identity, account.value.identity?.version))
    identityOpen.value = false
}
async function confirm(group: AssignedGroup) {
  if (accepted[group.id])
    await change(
      'education.confirmDeclaration',
      group.id,
      { accepted: true, textHash: group.declarationHash },
      group.version,
    )
}
</script>
<template>
  <view class="content-page">
    <view v-if="error" class="content-warning" role="alert">
      <text>{{ error }}</text>
      <wd-button size="small" variant="plain" :disabled="busy" @click="reload">
        {{ t('重新加载', 'Reload') }}
      </wd-button>
    </view>
    <view v-if="busy" class="content-caption">{{ t('正在与服务器同步…', 'Synchronizing…') }}</view>
    <template v-if="course">
      <view v-if="course.publicationVersion < 1" class="content-warning">
        {{
          t(
            '旧版导入课程仅供阅读；运营发布版本后方可记录学习，旧记录不自动转换为结业凭证。',
            'This legacy import is read-only until a version is published. Previous records do not become completion evidence.',
          )
        }}
      </view>
      <view class="content-back">
        <wd-button variant="plain" size="small" @click="goBack()">
          {{ t('返回课堂', 'Back to classroom') }}
        </wd-button>
        <text class="content-demo-label">
          v{{ course.publicationVersion }} ·
          {{ t('阅读确认，不计真实学时', 'Reading confirmation · no accredited hours') }}
        </text>
      </view>
      <view class="content-course-hero">
        <view class="content-hero-copy">
          <text class="content-hero-eyebrow">
            {{ course.category }} · {{ course.lessons.length }} {{ t('课节', 'lessons') }}
          </text>
          <text class="content-hero-title">{{ course.title }}</text>
          <text class="content-hero-summary">{{ course.description }}</text>
          <text class="content-hero-detail">
            {{ course.teacher }} · {{ t('参考时长', 'Suggested time') }} {{ course.duration }}
            {{ t('分钟', 'minutes') }}
          </text>
        </view>
        <view class="content-hero-seal">学</view>
      </view>
      <view class="content-progress-panel">
        <view class="content-between">
          <text>
            {{
              progress.complete
                ? t('本版本已完成', 'Version completed')
                : t('账号学习进度', 'Account progress')
            }}
          </text>
          <text class="content-red-label">{{ progress.percent }}%</text>
        </view>
        <view class="content-progress-track">
          <view :style="{ width: progress.percent + '%' }" />
        </view>
        <text class="content-caption">
          {{
            t(
              '逐章主动确认已阅读；有测验时由服务器判分。修改课程不会改变本版本的记录。',
              'Confirm each reading. Quizzes are graded by the server. Records belong to this published version.',
            )
          }}
        </text>
        <text v-if="progress.completedAt" class="content-caption">
          {{ t('完成记录：', 'Completed: ') }}{{ progress.completedAt }}
        </text>
      </view>
      <view v-if="!remoteUser" class="content-warning">
        {{
          t(
            '可浏览课程；保存阅读、测验与承诺前请先登录。',
            'You may browse. Sign in to save reading, quiz and commitment records.',
          )
        }}
      </view>
      <view class="content-course-layout">
        <view class="content-lesson-menu">
          <text class="content-panel-title">{{ t('课程目录', 'Course outline') }}</text>
          <view
            v-for="(item, index) in course.lessons"
            :key="item.id"
            :class="['content-lesson-item', { active: index === lessonIndex }]"
            @click="lessonIndex = index"
          >
            <text class="content-lesson-number">
              {{ progress.lessons.includes(item.id) ? '✓' : index + 1 }}
            </text>
            <text>{{ item.title }}</text>
          </view>
        </view>
        <view v-if="lesson" class="content-lesson-reader">
          <text class="content-card-title">{{ lesson.title }}</text>
          <view class="content-prose">
            <text>{{ lesson.body }}</text>
          </view>
          <view v-if="lesson.practice" class="content-practice">
            <text class="content-red-label">
              {{ t('想一想 · 做一做', 'Reflect and practise') }}
            </text>
            <text>{{ lesson.practice }}</text>
          </view>
          <view class="content-button-row">
            <wd-button
              :loading="busy"
              :disabled="
                !remoteUser || course.publicationVersion < 1 || progress.lessons.includes(lesson.id)
              "
              @click="markLesson"
            >
              {{
                progress.lessons.includes(lesson.id)
                  ? t('已确认阅读', 'Reading confirmed')
                  : t('我已阅读本节', 'I have read this lesson')
              }}
            </wd-button>
          </view>
        </view>
      </view>
      <view v-if="course.questions.length" class="content-quiz">
        <text class="section-title">{{ t('情景测验', 'Scenario quiz') }}</text>
        <text class="content-caption">
          {{ t('及格线', 'Pass mark') }} {{ course.passPercent }}% ·
          {{ t('允许重试，保留最佳成绩', 'Retries allowed; best score retained') }}
        </text>
        <text v-if="!canQuiz" class="content-caption">
          {{ t('请先确认读完全部章节。', 'Confirm all lessons before submitting.') }}
        </text>
        <view v-for="(q, qi) in course.questions" :key="q.id" class="education-question">
          <text class="content-quiz-question">{{ qi + 1 }}. {{ q.prompt }}</text>
          <wd-radio-group v-model="answers[q.id]" shape="button">
            <wd-radio v-for="option in q.options" :key="option.id" :value="option.id">
              {{ option.text }}
            </wd-radio>
          </wd-radio-group>
        </view>
        <view v-if="result" :class="['content-feedback', { incorrect: !result.passed }]">
          <text>
            {{ t('本次成绩', 'Latest score') }} {{ result.score }}% ·
            {{
              result.passed
                ? t('已通过', 'Passed')
                : t('未达及格线，可重新作答', 'Below pass mark. Try again.')
            }}
          </text>
        </view>
        <text v-if="progress.bestScore !== null" class="content-caption">
          {{ t('本版本最佳成绩：', 'Best score for this version: ') }}{{ progress.bestScore }}%
        </text>
        <wd-button
          :loading="busy"
          :disabled="!remoteUser || course.publicationVersion < 1 || !canQuiz || !answerReady"
          @click="answerQuiz"
        >
          {{ t('提交测验', 'Submit quiz') }}
        </wd-button>
      </view>
      <view v-else class="scope-note">
        {{
          t(
            '本版本未组卷；全部章节阅读确认后形成完成记录。',
            'No quiz in this version. Confirming all readings completes the record.',
          )
        }}
      </view>
    </template>
    <template v-else-if="params.id && !busy">
      <view class="empty-state">
        <text>{{ t('课程暂不可用。', 'Course unavailable.') }}</text>
        <wd-button variant="plain" @click="navigate('classroom')">
          {{ t('查看课堂', 'Open classroom') }}
        </wd-button>
      </view>
    </template>
    <template v-else-if="!params.id">
      <SectionHeading
        :title="t('修身齐家，清风同行', 'Learn together. Live with integrity.')"
        :eyebrow="t('清廉课堂', 'Integrity classroom')"
        :subtitle="
          t(
            '课程按发布版本学习，阅读确认和测验结果保存到本人账号。',
            'Study published course versions and save reading and quiz records to your account.',
          )
        "
      />
      <view class="education-catalog">
        <view v-for="item in courses" :key="item.id" class="education-card">
          <text class="content-red-label">
            {{ item.category }} · v{{ item.publicationVersion }}
          </text>
          <text class="content-card-title">{{ item.title }}</text>
          <text class="content-description">{{ item.description }}</text>
          <text class="content-caption">
            {{ item.lessons.length }} {{ t('章节', 'lessons') }} · {{ item.questions.length }}
            {{ t('道测验题', 'quiz questions') }}
          </text>
          <wd-button variant="plain" @click="navigate('classroom', { id: item.id })">
            {{ t('进入学习', 'Start learning') }}
          </wd-button>
        </view>
      </view>
      <view v-if="!courses.length && !busy" class="empty-state">
        {{ t('暂无已发布课程。', 'No published courses.') }}
      </view>
      <template v-if="remoteUser">
        <view class="education-account">
          <text class="section-title">{{ t('我的学习班组', 'My learning groups') }}</text>
          <view v-for="group in account.groups" :key="group.id" class="education-card">
            <text class="content-card-title">{{ group.name }}</text>
            <text class="content-caption">
              {{ t('指定课程版本', 'Assigned course version') }} v{{ group.publicationVersion }} ·
              {{
                group.cadreOnly
                  ? t('干部学习组', 'Verified cadre group')
                  : t('学习组', 'Learning group')
              }}
            </text>
            <wd-button
              variant="plain"
              @click="
                navigate('classroom', {
                  id: group.courseId,
                  version: String(group.publicationVersion),
                })
              "
            >
              {{ t('学习指定版本', 'Study assigned version') }}
            </wd-button>
            <template v-if="group.declarationText">
              <text class="content-panel-title">
                {{ t('班组承诺', 'Group commitment') }} · v{{ group.version }}
              </text>
              <text class="education-text">{{ group.declarationText }}</text>
              <text class="content-caption">
                {{
                  t(
                    '保存账号、内容版本和确认时间；这是确认台账，不是电子签章。',
                    'Stores your account, content version and confirmation time. This is a confirmation record, not an electronic signature.',
                  )
                }}
              </text>
              <text v-if="group.confirmed" class="content-red-label">
                {{ t('当前版本已确认', 'Current version confirmed') }}
              </text>
              <template v-else>
                <wd-checkbox v-model="accepted[group.id]">
                  {{
                    t(
                      '我已阅读并自愿确认以上承诺',
                      'I have read and voluntarily confirm this commitment',
                    )
                  }}
                </wd-checkbox>
                <wd-button :loading="busy" :disabled="!accepted[group.id]" @click="confirm(group)">
                  {{ t('保存确认记录', 'Save confirmation') }}
                </wd-button>
              </template>
            </template>
          </view>
          <text v-if="!account.groups.length" class="content-caption">
            {{ t('尚未分配学习班组。', 'No learning group assigned.') }}
          </text>
        </view>
        <view class="education-account">
          <text class="section-title">{{ t('干部身份申请', 'Cadre identity request') }}</text>
          <text>{{ identityLabel }}</text>
          <text v-if="account.identity?.reason" class="content-caption">
            {{ account.identity.reason }}
          </text>
          <text class="content-caption">
            {{
              t(
                '填写申请后由管理员依据获准资料人工确认，自填信息不会自动获得干部身份。',
                'An administrator checks approved evidence. Self-declared information does not grant verified status.',
              )
            }}
          </text>
          <wd-button size="small" variant="plain" @click="openIdentity">
            {{
              identityOpen
                ? t('收起申请', 'Hide request')
                : t('填写或修改申请', 'Create or revise request')
            }}
          </wd-button>
          <view v-if="identityOpen" class="education-form">
            <text>{{ t('工作单位', 'Organization') }}</text>
            <input
              v-model="identity.organization"
              class="education-input"
              :maxlength="200"
              :placeholder="t('填写单位名称', 'Organization name')"
            />
            <text>{{ t('核验说明', 'Verification note') }}</text>
            <textarea
              v-model="identity.requestNote"
              class="education-input education-textarea"
              :maxlength="3000"
              :placeholder="
                t(
                  '说明可由管理员核验的资料或联系途径，请勿填身份证号码',
                  'Describe approved evidence or a verification contact. Do not enter ID numbers.',
                )
              "
            />
            <wd-button
              :loading="busy"
              :disabled="
                identity.organization.trim().length < 2 || identity.requestNote.trim().length < 5
              "
              @click="saveIdentity"
            >
              {{ t('提交人工审核', 'Request manual review') }}
            </wd-button>
          </view>
        </view>
        <view v-if="account.declarations.length" class="education-account">
          <text class="section-title">{{ t('承诺历史记录', 'Commitment history') }}</text>
          <view v-for="record in account.declarations" :key="record.id" class="education-card">
            <text class="content-caption">
              v{{ record.groupVersion }} · {{ record.confirmedAt }}
            </text>
            <text class="education-text">{{ record.text }}</text>
          </view>
        </view>
        <view v-if="account.history.length" class="education-account">
          <text class="section-title">{{ t('我的版本学习记录', 'My version records') }}</text>
          <view
            v-for="record in account.history"
            :key="record.courseId + record.publicationVersion"
            class="education-card"
          >
            <text>
              {{ courses.find((c) => c.id === record.courseId)?.title || record.courseId }} · v{{
                record.publicationVersion
              }}
            </text>
            <text class="content-caption">
              {{
                record.completedAt
                  ? t('已完成：', 'Completed: ') + record.completedAt
                  : t('学习中', 'In progress')
              }}
            </text>
            <wd-button
              variant="plain"
              size="small"
              @click="
                navigate('classroom', {
                  id: record.courseId,
                  version: String(record.publicationVersion),
                })
              "
            >
              {{ t('查看该版本', 'Open version') }}
            </wd-button>
          </view>
        </view>
        <view v-if="account.legacyRecords.length" class="scope-note">
          {{ t('保留了', 'Retained ') }} {{ account.legacyRecords.length }}
          {{
            t(
              '条旧学习记录；旧记录未绑定发布版本，不自动认定新版本完成。',
              ' historical records without a verified publication version. They do not complete a new version.',
            )
          }}
        </view>
      </template>
    </template>
  </view>
</template>
<style scoped>
.education-catalog {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.education-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding: 22px;
  border: 1px solid var(--border-color, #e7dfd2);
  background: var(--paper-color, #fffdf8);
  border-radius: 10px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.education-account {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 30px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color, #e7dfd2);
}
.education-text {
  white-space: pre-wrap;
  line-height: 1.8;
}
.education-question {
  margin: 24px 0;
}
.education-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
.education-input {
  box-sizing: border-box;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color, #e7dfd2);
  border-radius: 6px;
  min-height: 48px;
  background: var(--paper-color, #fffdf8);
  font-size: 16px;
}
.education-textarea {
  height: 120px;
}
.content-warning {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.content-prose {
  white-space: pre-wrap;
}
@media (max-width: 650px) {
  .education-catalog {
    grid-template-columns: 1fr;
  }
  .education-card {
    padding: 18px;
  }
  .education-input {
    font-size: 16px;
  }
}
</style>
