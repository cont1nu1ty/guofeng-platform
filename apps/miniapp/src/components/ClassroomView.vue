<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SectionHeading from './SectionHeading.vue'
import { navigate, goBack, useRouteParams } from '../composables/useNavigation'
import { t } from '../composables/useLocale'
import { notify } from '../composables/useDemo'
import { courses, type BilingualText } from '../domain/contentCatalog'
import {
  completeLesson,
  completeQuiz,
  getCourseProgress,
  learningStorageError,
  learningSummary,
} from '../composables/useLearningProgress'
const L = (value: BilingualText) => t(value.zh, value.en)
const params = useRouteParams()
const course = computed(() => courses.find((item) => item.id === params.value.id))
const lessonIndex = ref(0)
const selectedAnswer = ref(-1)
const quizFeedback = ref<'correct' | 'incorrect' | ''>('')
const showCertificate = ref(false)
const filter = ref('all')
const progress = computed(() => getCourseProgress(course.value?.id ?? ''))
const lesson = computed(() => course.value?.lessons[lessonIndex.value])
const canQuiz = computed(() =>
  Boolean(course.value && progress.value.lessons.length === course.value.lessons.length),
)
const filtered = computed(() =>
  courses.filter(
    (item) =>
      filter.value === 'all' ||
      (filter.value === 'learning' &&
        getCourseProgress(item.id).percent > 0 &&
        !getCourseProgress(item.id).complete) ||
      (filter.value === 'completed' && getCourseProgress(item.id).complete),
  ),
)
watch(
  () => params.value.id,
  () => {
    lessonIndex.value = 0
    selectedAnswer.value = -1
    quizFeedback.value = ''
    showCertificate.value = false
  },
)
function markLesson() {
  if (!course.value || !lesson.value) return
  if (!completeLesson(course.value.id, lesson.value.id)) {
    notify(
      t(
        '本机保存失败，请检查存储后重试。',
        'Could not save locally. Check device storage and try again.',
      ),
    )
    return
  }
  notify(t('本节演示进度已保存', 'Sample lesson progress saved'))
  if (lessonIndex.value < course.value.lessons.length - 1) lessonIndex.value++
}
function answerQuiz() {
  if (!course.value || !canQuiz.value || selectedAnswer.value < 0) return
  if (selectedAnswer.value !== course.value.quiz.answer) {
    quizFeedback.value = 'incorrect'
    return
  }
  if (!completeQuiz(course.value.id, selectedAnswer.value)) {
    notify(
      t(
        '本机保存失败，请检查存储后重试。',
        'Could not save locally. Check device storage and try again.',
      ),
    )
    return
  }
  quizFeedback.value = 'correct'
  notify(
    t('已完成课程演示，可查看结业样张', 'Course demo completed. Your sample certificate is ready.'),
  )
}
function selectAnswer(index: number) {
  selectedAnswer.value = index
  quizFeedback.value = ''
}
</script>
<template>
  <view class="content-page">
    <template v-if="course">
      <view class="content-back">
        <wd-button variant="plain" size="small" @click="goBack()">
          {{ t('返回课堂', 'Back to classroom') }}
        </wd-button>
        <text class="content-demo-label">
          {{ t('示例课程 · 不计真实学时', 'Sample course · no accredited hours') }}
        </text>
      </view>
      <view class="content-course-hero">
        <view class="content-hero-copy">
          <text class="content-hero-eyebrow">
            {{ L(course.theme) }} · {{ t('共', '') }} {{ course.lessons.length }}
            {{ t('课节', 'lessons') }}
          </text>
          <text class="content-hero-title">{{ L(course.title) }}</text>
          <text class="content-hero-summary">{{ L(course.description) }}</text>
          <text class="content-hero-detail">
            {{ t('适学人群：', 'For: ') }}{{ L(course.audience) }}
          </text>
        </view>
        <view class="content-hero-seal">{{ course.mark }}</view>
      </view>
      <view class="content-progress-panel">
        <view class="content-between">
          <text>
            {{
              progress.complete
                ? t('已完成本课程演示', 'Course demo completed')
                : t('本机学习进度', 'Progress on this device')
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
              '完成全部课节与情景测验后，可查看结业证书样张。',
              'Complete each lesson and the scenario quiz to view a sample certificate.',
            )
          }}
        </text>
      </view>
      <view v-if="learningStorageError" class="content-warning">
        {{
          t(
            '本机存储不可用，暂不能保存学习进度。',
            'Local storage is unavailable. Learning progress cannot be saved.',
          )
        }}
      </view>
      <view class="content-course-layout">
        <view class="content-lesson-menu">
          <text class="content-panel-title">{{ t('课程目录', 'Course outline') }}</text>
          <view
            v-for="(item, index) in course.lessons"
            :key="item.id"
            :class="['content-lesson-item', { active: lessonIndex === index }]"
            @click="lessonIndex = index"
          >
            <text class="content-lesson-number">
              {{ progress.lessons.includes(item.id) ? '✓' : '0' + (index + 1) }}
            </text>
            <view>
              <text>{{ L(item.title) }}</text>
              <text class="content-caption">
                {{ item.duration }} {{ t('分钟 · 示意时长', 'min · sample duration') }}
              </text>
            </view>
          </view>
          <view class="content-lesson-summary">
            <wd-icon name="check-circle" />
            <text>
              {{ progress.lessons.length }} / {{ course.lessons.length }}
              {{ t('课节已完成演示', 'sample lessons completed') }}
            </text>
          </view>
        </view>
        <view v-if="lesson" class="content-lesson-reader">
          <view class="content-lesson-visual">
            <view class="content-open-book">
              <view />
              <view />
            </view>
            <text>{{ t('图文课节', 'Reading lesson') }}</text>
            <text class="content-caption">
              {{ t('课程样例 · 正式音视频素材待接入', 'Sample lesson · full media to be added') }}
            </text>
          </view>
          <text class="content-card-title">{{ L(lesson.title) }}</text>
          <view class="content-prose">
            <text>{{ L(lesson.body) }}</text>
          </view>
          <view class="content-practice">
            <text class="content-red-label">
              {{ t('想一想 · 做一做', 'Reflect and practise') }}
            </text>
            <text>{{ L(lesson.practice) }}</text>
          </view>
          <view class="content-between">
            <text class="content-caption">
              {{ t('本按钮用于展示学习进度逻辑。', 'This button demonstrates progress tracking.') }}
            </text>
            <wd-button
              :disabled="learningStorageError || progress.lessons.includes(lesson.id)"
              @click="markLesson"
            >
              {{
                progress.lessons.includes(lesson.id)
                  ? t('本节已完成演示', 'Lesson demo completed')
                  : t('完成本节演示', 'Complete sample lesson')
              }}
            </wd-button>
          </view>
        </view>
      </view>
      <view class="content-quiz">
        <view class="content-section-line">
          <text class="section-title">
            {{ t('学以致用 · 情景测验', 'Put learning into practice') }}
          </text>
          <text class="content-demo-label">{{ t('1 道示例题', '1 sample question') }}</text>
        </view>
        <text v-if="!canQuiz" class="content-caption">
          {{
            t('先完成全部课节，再提交测验。', 'Complete all lessons before submitting your answer.')
          }}
        </text>
        <text class="content-quiz-question">{{ L(course.quiz.question) }}</text>
        <view
          v-for="(option, index) in course.quiz.options"
          :key="index"
          :class="['content-answer', { selected: selectedAnswer === index }]"
          @click="selectAnswer(index)"
        >
          <view class="content-answer-letter">{{ ['A', 'B', 'C'][index] }}</view>
          <text>{{ L(option) }}</text>
          <wd-icon v-if="selectedAnswer === index" name="check" />
        </view>
        <view
          v-if="quizFeedback"
          :class="['content-feedback', { incorrect: quizFeedback === 'incorrect' }]"
        >
          <text class="content-panel-title">
            {{
              quizFeedback === 'correct'
                ? t('回答正确，已完成课程演示', 'Correct — course demo completed')
                : t('再想一想，可以重新选择', 'Take another look and try again')
            }}
          </text>
          <text>{{ L(course.quiz.explanation) }}</text>
        </view>
        <view class="content-button-row">
          <wd-button
            :disabled="!canQuiz || selectedAnswer < 0 || learningStorageError"
            @click="answerQuiz"
          >
            {{ t('提交测验答案', 'Submit answer') }}
          </wd-button>
          <wd-button
            v-if="progress.complete"
            variant="plain"
            @click="showCertificate = !showCertificate"
          >
            {{
              showCertificate
                ? t('收起结业样张', 'Hide sample certificate')
                : t('查看结业样张', 'View sample certificate')
            }}
          </wd-button>
        </view>
      </view>
      <view v-if="progress.complete && showCertificate" class="content-certificate">
        <text class="content-certificate-brand">{{ t('家风中华行', 'Family Heritage') }}</text>
        <text class="content-certificate-title">{{ t('课程结业证书', 'Course Completion') }}</text>
        <text class="content-certificate-sample">
          {{ t('样 张 · 无 认 证 效 力', 'SAMPLE · NOT A CREDENTIAL') }}
        </text>
        <text>
          {{
            t(
              '体验用户已完成以下课程的演示学习流程',
              'The demo user has completed the sample learning flow for',
            )
          }}
        </text>
        <text class="content-certificate-course">{{ L(course.title) }}</text>
        <text>{{ t('完成时间：', 'Completed: ') }}{{ progress.completedAt?.slice(0, 10) }}</text>
        <view class="content-certificate-seal">{{ t('演示', 'DEMO') }}</view>
        <text class="content-caption">
          {{
            t(
              '仅用于界面沟通，不计真实学时，不代表培训认证。',
              'For interface review only. No accredited hours or training certification.',
            )
          }}
        </text>
      </view>
    </template>
    <template v-else-if="params.id">
      <view class="empty-state">
        {{ t('未找到这门演示课程。', 'This sample course was not found.') }}
        <wd-button variant="plain" @click="navigate('classroom')">
          {{ t('查看全部课程', 'View all courses') }}
        </wd-button>
      </view>
    </template>
    <template v-else>
      <SectionHeading
        :title="t('修身齐家，清风同行', 'Learn together. Live with integrity.')"
        :eyebrow="t('清廉课堂', 'Integrity classroom')"
        :subtitle="
          t(
            '在日常故事中学习，在家庭行动中践行。',
            'Learn from everyday stories and put shared values into practice.',
          )
        "
      />
      <view class="content-classroom-intro">
        <view class="content-small-seal">学</view>
        <view class="content-intro-copy">
          <text class="content-panel-title">
            {{ t('一堂家风课，一份共同约定', 'One lesson, one shared commitment') }}
          </text>
          <text class="content-description">
            {{
              t(
                '图文导学 → 逐节学习 → 情景测验 → 结业样张',
                'Introduction → lessons → scenario quiz → sample certificate',
              )
            }}
          </text>
        </view>
        <view class="content-learning-stat">
          <text>{{ learningSummary.completed }}</text>
          <text>{{ t('已完成演示课程', 'Course demos completed') }}</text>
        </view>
      </view>
      <view class="content-filter-tabs content-filter-space">
        <view
          v-for="item in [
            { id: 'all', zh: '全部课程', en: 'All courses' },
            { id: 'learning', zh: '继续学习', en: 'In progress' },
            { id: 'completed', zh: '已完成', en: 'Completed' },
          ]"
          :key="item.id"
          :class="['content-filter-chip', { active: filter === item.id }]"
          @click="filter = item.id"
        >
          {{ t(item.zh, item.en) }}
        </view>
      </view>
      <view class="content-course-grid">
        <view
          v-for="item in filtered"
          :key="item.id"
          class="content-course-card"
          @click="navigate('classroom', { id: item.id })"
        >
          <view class="content-course-cover">
            <text class="content-course-cover-theme">{{ L(item.theme) }}</text>
            <text class="content-course-cover-mark">{{ item.mark }}</text>
            <view class="content-course-cover-lines">
              <view />
              <view />
              <view />
            </view>
            <text class="content-course-cover-footer">
              {{ t('家风中华行 · 清廉课堂', 'Family Heritage · Classroom') }}
            </text>
          </view>
          <view class="content-course-body">
            <text class="content-card-title">{{ L(item.title) }}</text>
            <text class="content-description">{{ L(item.description) }}</text>
            <view class="content-meta">
              <text>{{ item.lessons.length }} {{ t('课节', 'lessons') }}</text>
              <text>
                {{ item.lessons.reduce((sum, lesson) => sum + lesson.duration, 0) }}
                {{ t('分钟（示意）', 'min (sample)') }}
              </text>
            </view>
            <view class="content-progress-track">
              <view :style="{ width: getCourseProgress(item.id).percent + '%' }" />
            </view>
            <view class="content-card-footer">
              <text class="content-caption">
                {{ getCourseProgress(item.id).percent }}% {{ t('演示进度', 'demo progress') }}
              </text>
              <wd-button size="small" @click.stop="navigate('classroom', { id: item.id })">
                {{
                  getCourseProgress(item.id).complete
                    ? t('查看学习记录', 'View record')
                    : getCourseProgress(item.id).percent
                      ? t('继续学习', 'Continue')
                      : t('开始学习', 'Start learning')
                }}
              </wd-button>
            </view>
          </view>
        </view>
      </view>
      <view v-if="!filtered.length" class="empty-state">
        <text>
          {{
            t(
              '此分类暂时没有学习记录，选择课程开始体验。',
              'No records in this category. Choose a course to begin.',
            )
          }}
        </text>
        <wd-button variant="plain" @click="filter = 'all'">
          {{ t('浏览全部课程', 'Browse all courses') }}
        </wd-button>
      </view>
      <view class="content-next-link" @click="navigate('learning')">
        <view>
          <text class="content-panel-title">
            {{ t('从课堂走向生活', 'Take learning into life') }}
          </text>
          <text class="content-description">
            {{
              t(
                '参加家书共读、文化研学与家训手作。',
                'Explore reading sessions, cultural visits and craft workshops.',
              )
            }}
          </text>
        </view>
        <wd-icon name="arrow-right" />
      </view>
      <view class="scope-note">
        {{
          t(
            '课程为原创图文样例，按钮模拟学习完成；进度仅存本机，不包含真实视频、学时认证或正式结业。',
            'Original reading samples with simulated completion. Progress is local; no real video, accredited hours or official completion is included.',
          )
        }}
      </view>
    </template>
  </view>
</template>
