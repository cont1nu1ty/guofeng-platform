<script setup lang="ts">
import { remoteUser, remoteWorkspace } from '../services/api'
import { isHttpMode } from '../config/dataMode'
import { commerceStatusLabels } from '../domain/showcaseCatalog'
import { computed, ref, watch } from 'vue'
import SectionHeading from './SectionHeading.vue'
import AccountPanel from './AccountPanel.vue'
import FamilyPromiseEditor from './FamilyPromiseEditor.vue'
import CloudRecitationRecords from './CloudRecitationRecords.vue'
import CertificateExport from './CertificateExport.vue'
import {
  myWorks,
  favorites,
  registrations,
  notifications,
  certificates,
  reviewQuery,
  repo,
  openReader,
  largeText,
  isRegistered,
  safely,
  notify,
  favorite,
} from '../composables/useDemo'
import { navigate, useRouteParams } from '../composables/useNavigation'
import { locale, setLocale, t } from '../composables/useLocale'
import { fontStatus } from '../composables/useFontStatus'
import type { FontLoadResult } from '../composables/loadFonts'
import {
  recitationRecords,
  videoSubmissionRecords,
  localMediaPath,
  localMediaError,
} from '../composables/useLocalMedia'
import {
  learningRecords,
  checkedInActivities,
  learningSummary,
  clearActivityCheckIn,
  learningStorageError,
} from '../composables/useLearningProgress'
import {
  commerceRequests,
  mediaFavorites,
  cancelCommerceRequest,
  toggleMediaFavorite,
  showcaseStorageError,
} from '../composables/useShowcase'
import {
  excerpts,
  aiArchives,
  removeExcerpt,
  removeAiArchive,
  archiveError,
} from '../composables/usePersonalArchive'
import { culturalProducts, mediaCatalog } from '../domain/showcaseCatalog'
import { activityTranslations, type BilingualText } from '../domain/contentCatalog'
import type { Work } from '../domain/types'

interface RowAction {
  label: string
  run: () => void
  secondary?: boolean
}
interface PersonalRow {
  id: string
  title: string
  tag?: string
  meta: string
  body?: string
  progress?: number
  unread?: boolean
  quote?: boolean
  actions: RowAction[]
}
interface CertificateCard {
  id: string
  title: string
  recipient: string
  subject: string
  date: string
  mark: string
  kind: 'work' | 'course' | 'activity'
}
const L = (value: BilingualText) => t(value.zh, value.en)
const params = useRouteParams()
const tab = ref('works')
const workFilter = ref('all')
const role = ref('visitor')
const showCertificate = ref(false)
const showArchive = ref(false)
const selectedArchive = ref<PersonalRow>()
function openArchive(row: PersonalRow) {
  selectedArchive.value = row
  showArchive.value = true
}
const selectedCertificateId = ref('')
const information = ref<'privacy' | 'about'>('privacy')
const showInformation = ref(false)
const showFontDetails = ref(false)
const unreadCount = computed(() => notifications.value.filter((item) => !item.read).length)
const completedCourses = computed(() => learningRecords.value.filter((item) => item.complete))
const validCheckIns = computed(() =>
  checkedInActivities.value.filter((item) =>
    registrations.value.some((entry) => entry.activityId === item.activityId),
  ),
)
const dateLabel = (date?: string) => date?.slice(0, 10) ?? '—'
const activity = (id: string) => repo.listActivities().find((item) => item.id === id)
const activityTitle = (id: string) =>
  t(activity(id)?.title ?? '演示活动', activityTranslations[id]?.title ?? 'Sample activity')
const productTitle = (id: string) => {
  const product = culturalProducts.find((item) => item.id === id)
  return product ? L(product.name) : t('文创样品', 'Sample culture gift')
}
const workStatus = (work: Work) =>
  t(
    work.statusLabel,
    {
      pending_initial_review: 'Pending initial review',
      in_review: 'In review',
      returned: 'Revision requested',
      shortlisted: 'Shortlisted',
      awarded: 'Awarded',
      collected: 'Collected',
    }[work.status] ?? work.statusLabel,
  )
const systemMessage = (value: string) =>
  t(
    value,
    (
      {
        '投稿已收到（模拟）': 'Submission received (sample)',
        '作品已重新提交（模拟）': 'Submission received again (sample)',
        '作品已保存到本机演示库，等待模拟初审。':
          'Your work is saved locally and awaits sample initial review.',
        '作品保留原编号，已重新进入初审，历史评语保留。':
          'Your work retains its ID and review history and has returned to initial review.',
        '待初审（演示）': 'Pending initial review (sample)',
        '评审中（演示）': 'In review (sample)',
        '退回修改（演示）': 'Revision requested (sample)',
        '已入围（演示）': 'Shortlisted (sample)',
        '已获奖（演示）': 'Awarded (sample)',
        '已入藏（演示）': 'Collected (sample)',
      } as Record<string, string>
    )[value] ?? value,
  )
const certificateCards = computed<CertificateCard[]>(() => [
  ...certificates.value.map((item) => ({
    id: item.id,
    title: t(
      item.awardLabel,
      item.awardLabel.includes('典藏') ? 'Collection certificate' : 'Sample award certificate',
    ),
    recipient: item.author,
    subject: item.title,
    date: item.issuedAt,
    mark: '藏',
    kind: 'work' as const,
  })),
  ...completedCourses.value.map((item) => ({
    id: `course:${item.course.id}`,
    title: t('课程结业证书', 'Course Completion'),
    recipient: t('家风同行者', 'Demo participant'),
    subject: L(item.course.title),
    date: item.completedAt ?? '',
    mark: '学',
    kind: 'course' as const,
  })),
  ...validCheckIns.value.map((item) => ({
    id: `activity:${item.activityId}`,
    title: t('活动参与证书', 'Activity Participation'),
    recipient: t('家风同行者', 'Demo participant'),
    subject: activityTitle(item.activityId),
    date: item.checkedInAt,
    mark: '行',
    kind: 'activity' as const,
  })),
])
const selectedCertificate = computed(() =>
  certificateCards.value.find((item) => item.id === selectedCertificateId.value),
)
const tabs = computed(() => [
  {
    id: 'works',
    label: t('我的投稿', 'Submissions'),
    count:
      myWorks.value.length +
      (isHttpMode ? remoteWorkspace.mediaSubmissions.length : videoSubmissionRecords.value.length),
  },
  { id: 'messages', label: t('消息中心', 'Messages'), count: unreadCount.value },
  { id: 'certificates', label: t('证书夹', 'Certificates'), count: certificateCards.value.length },
  {
    id: 'favorites',
    label: t('我的收藏', 'Favourites'),
    count: favorites.value.length + mediaFavorites.value.length,
  },
  { id: 'events', label: t('预约与签到', 'Bookings'), count: registrations.value.length },
  {
    id: 'learning',
    label: t('学习记录', 'Learning'),
    count:
      learningSummary.value.started +
      (isHttpMode ? remoteWorkspace.recitations.length : recitationRecords.value.length),
  },
  ...(isHttpMode
    ? [
        {
          id: 'promises',
          label: t('家庭约定', 'Family promises'),
          count: remoteWorkspace.familyPromises.length,
        },
      ]
    : []),
  { id: 'gifts', label: t('文创记录', 'Gift requests'), count: commerceRequests.value.length },
  {
    id: 'archive',
    label: t('摘抄与创作', 'Notebook'),
    count: excerpts.value.length + aiArchives.value.length,
  },
])
watch(
  () => params.value.tab,
  (value) => {
    if (tabs.value.some((item) => item.id === value)) tab.value = value
  },
  { immediate: true },
)
const workFilters = computed(() => [
  { id: 'all', label: t('全部', 'All') },
  { id: 'pending_initial_review', label: t('待初审', 'Pending') },
  { id: 'in_review', label: t('评审中', 'In review') },
  { id: 'returned', label: t('待修改', 'Revision') },
  { id: 'shortlisted', label: t('已入围', 'Shortlisted') },
  { id: 'awarded', label: t('已获奖', 'Awarded') },
  { id: 'collected', label: t('已典藏', 'Collected') },
])
const fontLabel = computed(() =>
  !fontStatus.value
    ? t('字体加载中', 'Loading fonts')
    : fontStatus.value.allLoaded
      ? t('思源宋体、黑体已加载', 'Source Han fonts loaded')
      : fontStatus.value.fonts.some((font) => font.errorCode === 'timeout')
        ? t('字体加载状态待确认', 'Font status unconfirmed')
        : t('部分字体使用系统后备', 'Some fonts use system fallbacks'),
)
function fontFailureMessage(font: FontLoadResult): string {
  switch (font.errorCode) {
    case 'unsupported-sdk':
      return t('升级微信后可使用离线字体', 'Update WeChat to use offline fonts')
    case 'timeout':
      return t('加载超时', 'Loading timed out')
    case 'unavailable':
      return t('当前环境不支持字体加载', 'Font loading is unavailable in this environment')
    case 'invalid-font':
      return t('字体文件未能识别', 'The font file could not be read')
    case 'permission-denied':
      return t('微信未允许加载字体', 'WeChat did not allow the font to load')
    case 'not-detected':
      return t('未检测到字体加载成功', 'Font loading was not confirmed')
    default:
      return t('字体加载失败', 'Font loading failed')
  }
}
function openProgress(id: string) {
  reviewQuery.value = id
  navigate('review', { id })
}
function previewCertificate(id: string) {
  selectedCertificateId.value = id
  showCertificate.value = true
}
async function revise(id: string) {
  if (await safely(() => repo.prepareRevision(id))) navigate('submit')
}
async function readMessage(id: string, workId: string, sourceType?: string, targetId?: string) {
  const saved = await safely(async () => {
    await repo.markNotificationRead(id)
    return true
  })
  if (!saved) return
  if (sourceType === 'review-task' && targetId)
    navigate('admin', { tab: 'expert', taskId: targetId })
  else if (sourceType === 'news' && targetId) navigate('news', { id: targetId })
  else if (workId) openProgress(workId)
}
async function markAllRead() {
  const unread = notifications.value.filter((item) => !item.read)
  for (const item of unread) {
    const saved = await safely(async () => {
      await repo.markNotificationRead(item.id)
      return true
    })
    if (!saved) return
  }
  notify(t('消息已标为已读', 'Messages marked as read'))
}

async function cancelBooking(id: string) {
  await safely(() => repo.cancelRegistration(id))
  if (!isRegistered(id) && !clearActivityCheckIn(id))
    notify(
      t(
        '预约已取消，签到记录清理失败，请检查存储',
        'Booking cancelled; check-in could not be cleared',
      ),
    )
}
async function cancelGift(id: string) {
  try {
    await cancelCommerceRequest(id)
    notify(isHttpMode ? '申请已取消' : t('已取消本机演示记录', 'Local sample request cancelled'))
  } catch (error) {
    notify(error instanceof Error ? error.message : '记录未取消，请重试。')
  }
}
async function removeVideo(id: string) {
  try {
    await toggleMediaFavorite(id)
  } catch {
    notify(t('本机保存失败，请重试', 'Could not save locally. Please try again.'))
  }
}
const rows = computed<PersonalRow[]>(() => {
  if (tab.value === 'works')
    return myWorks.value
      .filter((work) => workFilter.value === 'all' || work.status === workFilter.value)
      .map((work) => {
        const actions: RowAction[] = [
          { label: t('进度与评语 →', 'Progress and feedback →'), run: () => openProgress(work.id) },
        ]
        if (work.status === 'returned')
          actions.push({
            label: t('修改后重投', 'Revise and resubmit'),
            run: () => revise(work.id),
          })
        const cert = certificates.value.find((item) => item.workId === work.id)
        if (cert)
          actions.push({
            label: t('查看证书', 'View certificate'),
            run: () => previewCertificate(cert.id),
          })
        return {
          id: work.id,
          title: work.title,
          tag: workStatus(work),
          meta: `${work.id} · ${dateLabel(work.submittedAt)}`,
          actions,
        }
      })
  if (tab.value === 'messages')
    return notifications.value.map((item) => ({
      id: item.id,
      title: systemMessage(item.title),
      tag: item.read ? t('已读', 'Read') : t('未读', 'Unread'),
      meta: `${dateLabel(item.createdAt)}${item.workId ? ' · ' + item.workId : ''}`,
      body: systemMessage(item.content),
      unread: !item.read,
      actions: [
        {
          label: t('查看详情 →', 'View details →'),
          run: () => readMessage(item.id, item.workId, item.sourceType, item.targetId),
        },
      ],
    }))
  if (tab.value === 'favorites')
    return [
      ...favorites.value.map((item) => ({
        id: item.id,
        title: item.title,
        tag: t('作品与典籍', 'Stories and classics'),
        meta: item.author,
        actions: [
          { label: t('继续阅读 →', 'Continue reading →'), run: () => openReader(item) },
          { label: t('取消收藏', 'Remove'), run: () => favorite(item.id), secondary: true },
        ],
      })),
      ...mediaCatalog
        .filter((item) => mediaFavorites.value.includes(item.id))
        .map((item) => ({
          id: item.id,
          title: L(item.title),
          tag: t('视频收藏', 'Saved video'),
          meta: `${L(item.collection)} · ${item.duration}`,
          actions: [
            {
              label: t('观看视频 →', 'Watch video →'),
              run: () => navigate('media', { id: item.id }),
            },
            { label: t('取消收藏', 'Remove'), run: () => removeVideo(item.id), secondary: true },
          ],
        })),
    ]
  if (tab.value === 'events')
    return registrations.value.map((item) => {
      const checkIn = validCheckIns.value.find((record) => record.activityId === item.activityId)
      const actions: RowAction[] = [
        {
          label: t('活动 / 签到 →', 'Activity / check-in →'),
          run: () => navigate('learning', { id: item.activityId }),
        },
      ]
      if (checkIn)
        actions.push({
          label: t('参与证书', 'Certificate'),
          run: () => previewCertificate(`activity:${item.activityId}`),
        })
      actions.push({
        label: t('取消预约', 'Cancel booking'),
        run: () => cancelBooking(item.activityId),
        secondary: true,
      })
      return {
        id: item.activityId,
        title: activityTitle(item.activityId),
        tag: checkIn
          ? t('演示已签到', 'Sample check-in complete')
          : t('演示预约成功', 'Sample booking confirmed'),
        meta: `${activity(item.activityId)?.date ?? ''} · ${activity(item.activityId)?.time ?? ''}`,
        body: checkIn
          ? `${t('签到日期：', 'Checked in: ')}${dateLabel(checkIn.checkedInAt)}`
          : undefined,
        actions,
      }
    })
  if (tab.value === 'learning')
    return learningRecords.value.map((item) => {
      const actions: RowAction[] = [
        {
          label: item.complete ? t('查看课程 →', 'View course →') : t('继续学习 →', 'Continue →'),
          run: () => navigate('classroom', { id: item.course.id }),
        },
      ]
      if (item.complete)
        actions.push({
          label: t('结业样张', 'Certificate sample'),
          run: () => previewCertificate(`course:${item.course.id}`),
        })
      return {
        id: item.course.id,
        title: L(item.course.title),
        tag: item.complete ? t('已完成演示', 'Demo completed') : t('学习中', 'In progress'),
        meta: `${item.lessons.length} / ${item.course.lessons.length} ${t('课节', 'lessons')}`,
        progress: item.percent,
        body: item.complete
          ? `${t('完成日期：', 'Completed: ')}${dateLabel(item.completedAt)}`
          : t(
              '完成全部课节与测验后，可查看结业样张。',
              'Complete all lessons and the quiz to view a certificate sample.',
            ),
        actions,
      }
    })
  if (tab.value === 'gifts')
    return commerceRequests.value.map((item) => {
      const actions: RowAction[] = [
        {
          label: t('查看产品 →', 'View item →'),
          run: () => navigate('shop', { id: item.productId }),
        },
      ]
      if (item.status === 'recorded' && !showcaseStorageError.value)
        actions.push({
          label: t('取消记录', 'Cancel request'),
          run: () => cancelGift(item.id),
          secondary: true,
        })
      return {
        id: item.id,
        title: productTitle(item.productId),
        tag: `${item.kind === 'public' ? t('公益申领', 'Public-interest gift') : t('商业定制', 'Custom request')} · ${isHttpMode ? commerceStatusLabels[item.status] : item.status === 'cancelled' ? t('已取消', 'Cancelled') : t('本机已记录', 'Recorded locally')}`,
        meta: `${item.id} · ${dateLabel(item.createdAt)}`,
        body: `${item.organization} · ${item.quantity} ${t('份', 'items')}\n${item.purpose}`,
        actions,
      }
    })
  if (tab.value === 'archive')
    return [
      ...excerpts.value.map((item) => ({
        id: item.id,
        title: item.sourceTitle,
        tag: t('我的摘抄', 'Saved excerpt'),
        meta: dateLabel(item.createdAt),
        body: `${item.text}${item.note ? '\n' + t('感悟：', 'Reflection: ') + item.note : ''}`,
        quote: true,
        actions: [
          {
            label: t('查看原文 →', 'Read source →'),
            run: () => navigate('library', { id: item.sourceId }),
          },
          {
            label: t('移除摘抄', 'Remove excerpt'),
            run: () => {
              removeExcerpt(item.id)
            },
            secondary: true,
          },
        ],
      })),
      ...aiArchives.value.map((item) => ({
        id: item.id,
        title: item.prompt || t('家风创作存档', 'Saved writing sample'),
        tag:
          item.mode === 'knowledge'
            ? t('家风知识', 'Heritage knowledge')
            : item.mode === 'compliance'
              ? t('审校样例', 'Review sample')
              : item.mode === 'storyboard'
                ? t('短剧分镜', 'Storyboards')
                : t('AI 预设创作示例', 'Preset assistant sample'),
        meta: dateLabel(item.createdAt),
        body: item.result,
        actions: [
          {
            label: t('继续编辑 →', 'Continue editing →'),
            run: () => navigate('assistant', { archive: item.id }),
          },
          {
            label: t('移除存档', 'Remove archive'),
            run: () => {
              removeAiArchive(item.id)
            },
            secondary: true,
          },
        ],
      })),
    ]
  return []
})
const visibleMediaRecords = computed(() =>
  isHttpMode
    ? []
    : tab.value === 'learning'
      ? recitationRecords.value
      : tab.value === 'works' && workFilter.value === 'all'
        ? videoSubmissionRecords.value
        : [],
)
const panelHelp = computed(
  () =>
    ({
      works: t(
        '按状态查看投稿，跟进评审意见与结果。',
        'Track submissions, feedback and results by status.',
      ),
      messages: t(
        isHttpMode
          ? '查看平台处理进度的站内通知。微信订阅通知另行接入。'
          : '消息由本机流程生成，不发送真实微信通知。',
        'Local demo updates; no real WeChat notification is sent.',
      ),
      certificates: t(
        '作品、课程与活动的证书样张，不具有认证效力。',
        'Sample certificates for contributions, courses and activities. Not credentials.',
      ),
      favorites: t(
        '收藏作品、典籍和视频，留住喜欢的家风故事。',
        'Keep favourite stories, classics and videos in one place.',
      ),
      events: t(
        isHttpMode ? '查看当前账号的活动预约和签到记录。' : '预约、签到和参与记录仅用于界面演示。',
        'Bookings, check-ins and participation are interface demonstrations.',
      ),
      learning: isHttpMode
        ? t(
            '学习进度与私人诵读保存到当前账号，不计认证培训学时。',
            'Learning progress and private recordings are saved to your account, without accredited training hours.',
          )
        : t(
            '学习进度保存在当前设备，不计真实培训学时。',
            'Learning progress is local and carries no accredited hours.',
          ),
      promises: t(
        '家庭约定保存在当前账号，仅本人可读。',
        'Promises are saved to your account and visible only to you.',
      ),
      gifts: t(
        isHttpMode
          ? '申请由平台处理，状态以实际处理结果为准。本次不涉及支付。'
          : '演示申请不构成订单、支付或实际发货。',
        'Sample requests do not create purchases, payments or deliveries.',
      ),
      archive: t(
        isHttpMode
          ? '摘抄与创作记录保存到当前账号。预设助手文本不代表模型推理。'
          : '摘抄与创作示例保存在本机，可随时返回编辑。',
        'Local excerpts and writing samples are ready to revisit.',
      ),
    })[tab.value] ?? '',
)
const emptyCopy = computed(
  () =>
    ({
      works: t(
        '此分类还没有作品，从你的第一篇家风故事开始。',
        'No submissions here yet. Begin with your first family story.',
      ),
      messages: t(
        '提交作品或完成演示评审后，通知会出现在这里。',
        'Updates appear after a submission or sample review.',
      ),
      certificates: t(
        '完成课程、签到或取得作品评审结果后，可查看证书样张。',
        'Complete a course, check in or receive a review result to view certificates.',
      ),
      favorites: t('读到喜欢的故事，就把它收藏起来吧。', 'Save a story that speaks to you.'),
      events: t('还没有预约，去传习页面看看吧。', 'No bookings yet. Explore an activity.'),
      learning: t(
        '一堂家风课，从一个小小的行动开始。',
        'Begin with one lesson and one small action.',
      ),
      gifts: t(
        '把家风带回家，从一份文化礼物开始。',
        'Take family values home with a cultural gift.',
      ),
      archive: t(
        '在典籍阅读中摘抄，或在助手中保存创作示例。',
        'Save a library excerpt or a writing sample from the assistant.',
      ),
    })[tab.value] ?? '',
)
function explore() {
  if (tab.value === 'works' || tab.value === 'messages') {
    if (tab.value === 'works' && workFilter.value !== 'all') workFilter.value = 'all'
    else navigate('submit')
  } else if (tab.value === 'events') navigate('learning')
  else if (tab.value === 'learning' || tab.value === 'certificates') navigate('classroom')
  else if (tab.value === 'gifts') navigate('shop')
  else navigate('library')
}
function openInformation(kind: 'privacy' | 'about') {
  information.value = kind
  showInformation.value = true
}
</script>
<template>
  <view class="profile-page" :class="{ 'profile-large': largeText }">
    <view class="profile-hero">
      <view class="profile-avatar">家</view>
      <view class="profile-identity">
        <text class="section-title">
          {{ remoteUser?.name || t('家风同行者', 'A companion in family heritage') }}
        </text>
        <text class="section-subtitle">
          {{
            isHttpMode
              ? t('平台账号 · 云端个人记录', 'Platform account · Personal records')
              : t('体验账户 · 当前设备的个人记录', 'Demo account · records on this device')
          }}
        </text>
        <text class="profile-local-note">
          {{
            t(
              '投稿、学习与预约，在这里留下足迹。',
              'Your contributions, learning and activities, together.',
            )
          }}
        </text>
      </view>
      <wd-button variant="plain" size="small" @click="navigate('submit')">
        {{ t('开始创作 ↗', 'Start writing ↗') }}
      </wd-button>
    </view>
    <AccountPanel />
    <view class="profile-stats profile-overview">
      <button class="profile-overview-button" @click="tab = 'works'">
        <text>{{ myWorks.length }}</text>
        {{ t('我的投稿', 'Submissions') }}
      </button>
      <button class="profile-overview-button" @click="tab = 'learning'">
        <text>{{ learningSummary.completed }}</text>
        {{ t('完成课程', 'Courses completed') }}
      </button>
      <button class="profile-overview-button" @click="tab = 'certificates'">
        <text>{{ certificateCards.length }}</text>
        {{ t('证书样张', 'Sample certificates') }}
      </button>
      <button class="profile-overview-button" @click="tab = 'messages'">
        <text>{{ unreadCount }}</text>
        {{ t('未读消息', 'Unread messages') }}
      </button>
    </view>
    <view class="profile-layout">
      <view class="profile-main">
        <view class="profile-tabs">
          <button
            v-for="item in tabs"
            :key="item.id"
            :class="['profile-tab', { active: tab === item.id }]"
            @click="tab = item.id"
          >
            <text>{{ item.label }}</text>
            <text v-if="item.count" class="profile-count">{{ item.count }}</text>
          </button>
        </view>
        <view class="profile-panel-heading">
          <text class="profile-description">{{ panelHelp }}</text>
          <button v-if="tab === 'messages' && unreadCount" class="text-button" @click="markAllRead">
            {{ t('全部已读', 'Mark all read') }}
          </button>
        </view>
        <view v-if="tab === 'works'" class="profile-subfilters">
          <button
            v-for="item in workFilters"
            :key="item.id"
            :class="['profile-filter', { active: workFilter === item.id }]"
            @click="workFilter = item.id"
          >
            {{ item.label }}
          </button>
        </view>
        <view v-if="tab === 'certificates'" class="profile-certificate-grid">
          <button
            v-for="item in certificateCards"
            :key="item.id"
            class="profile-certificate-card"
            @click="previewCertificate(item.id)"
          >
            <text class="profile-certificate-mark">{{ item.mark }}</text>
            <text class="profile-panel-title">{{ item.title }}</text>
            <text>{{ item.subject }}</text>
            <text class="muted">{{ dateLabel(item.date) }}</text>
            <text class="text-button">{{ t('预览样张 →', 'Preview sample →') }}</text>
          </button>
        </view>
        <template v-else>
          <view
            v-for="row in rows"
            :key="row.id"
            :class="['personal-row', 'profile-record', { 'profile-unread': row.unread }]"
          >
            <view class="profile-record-copy">
              <text v-if="row.tag" class="tag">{{ row.tag }}</text>
              <text
                class="story-title"
                @click="tab === 'archive' ? openArchive(row) : row.actions[0]?.run()"
              >
                {{ row.title }}
              </text>
              <text
                :class="[
                  'profile-description',
                  { 'profile-quote': row.quote, 'profile-archive-preview': tab === 'archive' },
                ]"
                v-if="row.body"
                @click="tab === 'archive' && openArchive(row)"
              >
                {{ row.body }}
              </text>
              <text class="muted">{{ row.meta }}</text>
              <view v-if="row.progress !== undefined" class="profile-progress-row">
                <view class="profile-progress">
                  <view class="profile-progress-fill" :style="{ width: row.progress + '%' }" />
                </view>
                <text>{{ row.progress }}%</text>
              </view>
            </view>
            <view class="profile-actions">
              <button v-if="tab === 'archive'" class="text-button" @click="openArchive(row)">
                {{ t('展开全文', 'Read in full') }}
              </button>
              <button
                v-for="(action, index) in row.actions"
                :key="index"
                :class="action.secondary ? 'profile-secondary-button' : 'text-button'"
                @click="action.run"
              >
                {{ action.label }}
              </button>
            </view>
          </view>
        </template>
        <template v-if="isHttpMode && tab === 'promises'">
          <FamilyPromiseEditor
            v-for="promise in remoteWorkspace.familyPromises"
            :key="promise.id"
            :person-id="promise.personId"
            :person-name="promise.personName"
          />
          <text v-if="!remoteWorkspace.familyPromises.length" class="scope-note">
            {{
              t(
                '还没有家庭约定。走进名人馆，写下想和家人实践的小事。',
                'No promises yet. Visit a gallery and choose something to practise with your family.',
              )
            }}
          </text>
          <wd-button size="small" variant="plain" @click="navigate('hall')">
            {{ t('走进名人馆', 'Visit galleries') }}
          </wd-button>
        </template>
        <CloudRecitationRecords v-if="isHttpMode && tab === 'learning'" />
        <view v-if="tab === 'learning'" class="profile-notebook-links">
          <button class="text-button" @click="navigate('learning', { tab: 'audio' })">
            {{ t('听故事 / 诵读打卡 →', 'Audio stories / reading practice →') }}
          </button>
        </view>
        <view v-if="tab === 'works' && workFilter === 'all'" class="profile-notebook-links">
          <button class="text-button" @click="navigate('media', { tab: 'submit' })">
            {{ t('视频投稿与记录 →', 'Video submissions and records →') }}
          </button>
        </view>
        <view
          v-for="record in visibleMediaRecords"
          :key="record.id"
          class="personal-row profile-record"
        >
          <view class="profile-record-copy">
            <text class="tag">
              {{
                record.kind === 'recitation'
                  ? t('诵读打卡 · 本机记录', 'Reading practice · Local record')
                  : t('视频投稿 · 本机记录', 'Video submission · Local record')
              }}
            </text>
            <text class="story-title">{{ record.title }}</text>
            <text class="profile-description">
              {{ record.fileName }} · {{ Math.round(record.size / 1024) }} KB
            </text>
            <text class="muted">
              {{ dateLabel(record.createdAt) }} ·
              {{
                localMediaPath(record.id)
                  ? t('本次会话可试听 / 预览', 'Preview available in this session')
                  : t(
                      '文件需重新选择，记录已保留',
                      'Select the file again to preview; record retained',
                    )
              }}
            </text>
          </view>
          <view class="profile-actions">
            <button
              class="text-button"
              @click="
                record.kind === 'recitation'
                  ? navigate('learning', { tab: 'audio' })
                  : navigate('media', { tab: 'submit' })
              "
            >
              {{ t('查看记录 →', 'View record →') }}
            </button>
          </view>
        </view>
        <text v-if="(tab === 'learning' || tab === 'works') && localMediaError" class="scope-note">
          {{
            t(
              '本机音视频记录无法读取，已有数据未覆盖。',
              'Local media records could not be read. Existing data was preserved.',
            )
          }}
        </text>
        <view
          v-if="
            tab === 'promises'
              ? false
              : tab === 'learning' && isHttpMode && remoteWorkspace.recitations.length
                ? false
                : tab === 'certificates'
                  ? !certificateCards.length
                  : !rows.length && !visibleMediaRecords.length
          "
          class="empty-state"
        >
          <text>{{ emptyCopy }}</text>
          <wd-button variant="plain" @click="explore">
            {{ t('继续探索', 'Continue exploring') }}
          </wd-button>
        </view>
        <view v-if="tab === 'archive' && archiveError" class="scope-note">
          {{
            t(
              '本机存档暂无法读取，原数据未覆盖。',
              'The local archive cannot be read. Existing data has not been overwritten.',
            )
          }}
        </view>
        <view v-if="tab === 'archive'" class="profile-notebook-links">
          <button class="text-button" @click="navigate('library')">
            {{ t('去典藏阅读 →', 'Read the library →') }}
          </button>
          <button class="text-button" @click="navigate('assistant')">
            {{ t('打开创作助手 →', 'Open writing assistant →') }}
          </button>
        </view>
        <text v-if="tab === 'learning' && learningStorageError" class="scope-note">
          {{
            t(
              '学习存储不可用，请检查本机权限后重试。',
              'Learning storage is unavailable. Check local permissions.',
            )
          }}
        </text>
      </view>
      <view class="settings-card profile-settings">
        <SectionHeading :title="t('阅读与设置', 'Reading and settings')" />
        <view class="setting-row">
          <view>
            <text>{{ t('大字模式', 'Larger text') }}</text>
            <text class="muted">
              {{ t('放大正文，阅读更轻松', 'Larger text for easier reading') }}
            </text>
          </view>
          <wd-switch v-model="largeText" active-color="#C41A1A" />
        </view>
        <view class="profile-setting-block">
          <text>{{ t('界面语言', 'Interface language') }}</text>
          <view class="profile-language">
            <button
              class="profile-option-button"
              :class="{ active: locale === 'zh' }"
              @click="setLocale('zh')"
            >
              简体中文
            </button>
            <button
              class="profile-option-button"
              :class="{ active: locale === 'en' }"
              @click="setLocale('en')"
            >
              English
            </button>
          </view>
          <text class="muted">
            {{ t('用户作品保留原文', 'User submissions keep their original language') }}
          </text>
        </view>
        <view class="profile-setting-block">
          <button class="profile-setting-link" @click="showFontDetails = !showFontDetails">
            <view>
              <text>{{ t('思源字体状态', 'Source Han font status') }}</text>
              <text class="muted">{{ fontLabel }}</text>
            </view>
            <text>{{ showFontDetails ? '−' : '+' }}</text>
          </button>
          <view v-if="showFontDetails" class="profile-font-details">
            <text v-for="font in fontStatus?.fonts ?? []" :key="font.family">
              {{ font.family }} ·
              {{
                font.loaded
                  ? t('已加载', 'Loaded')
                  : font.errorCode === 'timeout'
                    ? t('待确认', 'Unconfirmed')
                    : t('系统后备', 'System fallback')
              }}
              {{ font.loaded ? '' : ' · ' + fontFailureMessage(font) }}
            </text>
            <text>
              {{
                t(
                  '本地子集；未收录的生僻字使用系统字体。微信端仍需真机验证。',
                  'Local subsets; missing characters use system fonts. WeChat requires real-device validation.',
                )
              }}
            </text>
          </view>
        </view>
        <button
          class="setting-row profile-setting-link"
          @click="navigate('news', { view: 'subscriptions' })"
        >
          <text>{{ t('资讯订阅与通知', 'News subscriptions and notices') }}</text>
          <text>→</text>
        </button>
        <button
          class="setting-row profile-setting-link"
          @click="navigate('learning', { tab: 'audio' })"
        >
          <text>{{ t('音频故事与诵读', 'Audio stories and reading practice') }}</text>
          <text>→</text>
        </button>
        <button class="setting-row profile-setting-link" @click="openInformation('privacy')">
          <text>{{ t('隐私与数据', 'Privacy and data') }}</text>
          <text>→</text>
        </button>
        <button class="setting-row profile-setting-link" @click="openInformation('about')">
          <text>{{ t('关于平台', 'About this platform') }}</text>
          <text>→</text>
        </button>
        <view v-if="isHttpMode && remoteUser?.roles.includes('expert')" class="profile-role-card">
          <text class="profile-panel-title">专家权限</text>
          <wd-button variant="plain" @click="navigate('admin', { tab: 'expert' })">
            进入专家工作台
          </wd-button>
        </view>
        <view v-if="!isHttpMode" class="profile-role-card">
          <text class="profile-panel-title">{{ t('角色体验', 'Role preview') }}</text>
          <text class="muted">
            {{ t('仅用于演示，不代表已认证身份', 'A preview only; no verified identity') }}
          </text>
          <view class="profile-role-options">
            <button
              v-for="item in [
                { id: 'visitor', zh: '投稿用户', en: 'Contributor' },
                { id: 'expert', zh: '评审专家', en: 'Reviewer' },
                { id: 'operator', zh: '运营人员', en: 'Operator' },
              ]"
              :key="item.id"
              class="profile-option-button"
              :class="{ active: role === item.id }"
              @click="role = item.id"
            >
              {{ t(item.zh, item.en) }}
            </button>
          </view>
          <button
            class="text-button"
            @click="
              role === 'visitor'
                ? navigate('submit')
                : navigate('admin', { tab: role === 'expert' ? 'expert' : 'overview' })
            "
          >
            {{
              role === 'visitor'
                ? t('进入投稿中心 →', 'Open submissions →')
                : role === 'expert'
                  ? t('进入专家工作台 →', 'Open reviewer workspace →')
                  : t('进入运营视图 →', 'Open operations view →')
            }}
          </button>
        </view>
        <text class="scope-note">
          {{
            t(
              isHttpMode
                ? '云端记录按账号隔离。试点登录不等于完成实名认证；证书样张不代表正式签发。'
                : '可体验本机模拟登录与认证。真实授权、实名认证和跨设备同步尚未接入。',
              'Local sign-in and verification states can be previewed. Real authorisation, identity checks and cross-device sync are not connected.',
            )
          }}
        </text>
      </view>
    </view>
    <wd-popup
      v-model="showArchive"
      :z-index="100"
      position="center"
      closable
      custom-class="content-popup"
    >
      <view v-if="selectedArchive" class="profile-dialog profile-archive-dialog">
        <text class="tag">{{ selectedArchive.tag }}</text>
        <text class="section-title">{{ selectedArchive.title }}</text>
        <scroll-view scroll-y class="profile-full-scroll">
          <text class="profile-full-text" selectable>{{ selectedArchive.body }}</text>
        </scroll-view>
        <text class="muted">{{ selectedArchive.meta }}</text>
        <wd-button variant="plain" @click="showArchive = false">
          {{ t('收起全文', 'Close full text') }}
        </wd-button>
      </view>
    </wd-popup>
    <wd-popup
      v-model="showCertificate"
      :z-index="100"
      position="center"
      closable
      custom-class="content-popup"
    >
      <view v-if="selectedCertificate" class="profile-dialog">
        <view class="profile-certificate-sheet">
          <text class="profile-certificate-brand">{{ t('家风中华行', 'Family Heritage') }}</text>
          <text class="profile-certificate-heading">{{ selectedCertificate.title }}</text>
          <text class="profile-sample-label">
            {{ t('演示样张 · 无认证效力', 'DEMONSTRATION SAMPLE · NOT A CREDENTIAL') }}
          </text>
          <text>{{ selectedCertificate.recipient }}</text>
          <text class="profile-certificate-subject">{{ selectedCertificate.subject }}</text>
          <text>{{ t('记录日期：', 'Recorded: ') }}{{ dateLabel(selectedCertificate.date) }}</text>
          <text class="profile-certificate-id">{{ selectedCertificate.id }}</text>
          <view class="profile-certificate-seal">{{ t('样张', 'DEMO') }}</view>
        </view>
        <CertificateExport :certificate="selectedCertificate" />
        <text class="scope-note">
          {{
            t(
              '仅展示证书样式与记录关联，不代表正式评奖、认证或培训学时。',
              'Shows the certificate layout and linked record only. No official award, credential or accredited hours.',
            )
          }}
        </text>
      </view>
    </wd-popup>
    <wd-popup
      v-model="showInformation"
      :z-index="100"
      position="center"
      closable
      custom-class="content-popup"
    >
      <view class="profile-dialog">
        <text class="section-title">
          {{
            information === 'privacy'
              ? t('隐私与本机数据', 'Privacy and local data')
              : t('家风中华行', 'Family Values · China')
          }}
        </text>
        <template v-if="information === 'privacy'">
          <text class="profile-dialog-paragraph">
            {{
              t(
                isHttpMode
                  ? '草稿、投稿、附件、收藏、学习、预约和申请记录会通过服务接口保存在平台，并关联当前账号。媒体本机样片和离线样张仍保留其明确标识。'
                  : '草稿、投稿、收藏、学习、预约和文创演示记录保存在当前设备，未连接真实账户或后台服务。请使用虚构信息体验。',
                'Drafts, submissions, favourites, learning, bookings and sample gift requests are stored on this device. No real account or backend is connected. Use fictional information.',
              )
            }}
          </text>
          <text class="profile-dialog-paragraph">
            {{
              t(
                isHttpMode
                  ? '清理设备存储会移除登录状态和本机设置，不会删除服务端账号记录。此为试点功能说明，正式隐私协议与留存期限须由运营方另行发布。'
                  : '清理浏览器或小程序存储会清除记录；更换设备不会自动同步。本说明描述演示的数据行为，不是正式服务隐私协议。',
                'Clearing browser or mini-program storage removes records. Data does not sync to another device. This describes the demo and is not a production privacy policy.',
              )
            }}
          </text>
        </template>
        <template v-else>
          <text class="profile-dialog-paragraph">
            {{
              t(
                '记录家庭故事，传承优良家风。当前版本用于前端界面展示和需求沟通。',
                'Record family stories and share lasting values. This version supports interface demonstration and requirements discussion.',
              )
            }}
          </text>
          <text class="profile-dialog-paragraph">
            {{
              t(
                '基于 Uni-app、Vue 3 与 Wot UI 构建，使用本地思源字体子集。文章、活动、课程、证书与业务数据均为样例。',
                'Built with Uni-app, Vue 3 and Wot UI, with local Source Han font subsets. Articles, activities, courses, certificates and business data are samples.',
              )
            }}
          </text>
        </template>
        <wd-button variant="plain" @click="showInformation = false">
          {{ t('我知道了', 'Understood') }}
        </wd-button>
      </view>
    </wd-popup>
  </view>
</template>
<style scoped lang="scss">
.profile-archive-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.profile-full-scroll {
  max-height: 52vh;
  height: 44vh;
}
.profile-full-text {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.9;
  font-size: 16px;
}
.profile-large .profile-full-text {
  font-size: 19px;
}
.profile-page {
  color: var(--jf-ink, #2c2c2c);
}
.profile-hero {
  background: #f7e8e8;
  border-top-color: var(--jf-red, #c41a1a);
}
.profile-avatar {
  background: var(--jf-red, #c41a1a);
  color: var(--jf-paper, #f5f0e8);
  font-family: 'JiafengSerif', serif;
}
.profile-identity {
  flex: 1;
  min-width: 0;
}
.profile-local-note {
  display: block;
  margin-top: 9px;
  font-size: 13px;
  line-height: 1.7;
}
.profile-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}
.profile-overview .profile-overview-button {
  min-width: 0;
  padding: 20px 8px;
  line-height: 1.7;
  font-size: 12px;
}
.profile-main {
  min-width: 0;
}
.profile-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--jf-gold, #c9a96e);
}
.profile-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid transparent;
  margin: 0;
  padding: 9px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--jf-ink, #2c2c2c);
}
.profile-tab.active {
  color: var(--jf-red, #c41a1a);
  border-color: var(--jf-red, #c41a1a);
  background: #fff;
  font-weight: 600;
}
.profile-count {
  padding: 0 5px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 17px;
  background: var(--jf-paper, #f5f0e8);
}
.profile-subfilters {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: 0 0 15px;
}
.profile-filter {
  margin: 0;
  padding: 7px 10px;
  line-height: 1.5;
  font-size: 12px;
  border-bottom: 2px solid transparent;
}
.profile-filter.active {
  color: var(--jf-red, #c41a1a);
  border-bottom-color: var(--jf-red, #c41a1a);
  font-weight: 600;
}
.profile-record {
  align-items: flex-start;
  gap: 18px;
}
.profile-record-copy {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.profile-record .story-title {
  font-size: 18px;
  line-height: 1.6;
}
.profile-record .muted {
  display: block;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.profile-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  flex-shrink: 0;
  padding-top: 5px;
}
.profile-secondary-button {
  color: var(--jf-ink, #2c2c2c);
  font-size: 12px;
  line-height: 1.6;
  text-decoration: underline;
  text-underline-offset: 3px;
  margin: 0;
}
.profile-description {
  display: block;
  font-size: 13px;
  line-height: 1.85;
  margin: 7px 0;
  white-space: pre-line;
}
.profile-panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}
.profile-panel-title {
  display: block;
  font-family: 'JiafengSerif', serif;
  font-weight: 600;
  font-size: 18px;
  line-height: 1.65;
}
.profile-panel-heading .text-button {
  flex-shrink: 0;
}
.profile-unread {
  border-left: 3px solid var(--jf-red, #c41a1a);
  padding-left: 16px;
}
.profile-progress-row {
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 12px;
  margin-top: 14px;
}
.profile-progress {
  flex: 1;
  height: 5px;
  background: #e2d9cd;
}
.profile-progress > .profile-progress-fill {
  height: 100%;
  background: var(--jf-red, #c41a1a);
}
.profile-quote {
  font-family: 'JiafengSerif', serif;
  font-size: 18px;
  line-height: 1.8;
}
.profile-archive-preview {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.profile-notebook-links {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
  padding-top: 25px;
}
.profile-certificate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.profile-certificate-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin: 0;
  padding: 24px;
  background: #fffdf9;
  border: 1px solid var(--jf-gold, #c9a96e);
  text-align: left;
  white-space: normal;
  font-size: 14px;
  line-height: 1.7;
}
.profile-certificate-mark {
  border: 1px solid var(--jf-red, #c41a1a);
  color: var(--jf-red, #c41a1a);
  font-family: 'JiafengSerif', serif;
  font-size: 23px;
  padding: 3px 8px;
}
.profile-settings {
  align-self: start;
}
.profile-setting-block {
  padding: 19px 0;
  border-bottom: 1px solid #dfd7cb;
  font-size: 14px;
}
.profile-setting-block .muted {
  display: block;
  margin-top: 7px;
  font-size: 12px;
  line-height: 1.7;
}
.profile-setting-link {
  background: transparent;
  border-radius: 0;
  display: flex;
  width: 100%;
  justify-content: space-between;
  align-items: center;
  margin: 0;
  padding-left: 0;
  padding-right: 0;
  text-align: left;
  font-size: 14px;
  line-height: 1.7;
}
.profile-language,
.profile-role-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 13px;
}
.profile-language .profile-option-button,
.profile-role-options .profile-option-button {
  flex: 1;
  margin: 0;
  padding: 8px 9px;
  border: 1px solid #dfd7cb;
  font-size: 12px;
  line-height: 1.6;
}
.profile-role-options .profile-option-button {
  padding: 8px 7px;
  overflow-wrap: anywhere;
}
.profile-language .profile-option-button.active,
.profile-role-options .profile-option-button.active {
  border-color: var(--jf-red, #c41a1a);
  color: var(--jf-red, #c41a1a);
  background: #fff;
}
.profile-font-details {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 13px;
  padding: 12px;
  background: #fffdf9;
  font-size: 11px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.profile-role-card {
  padding: 24px 0 0;
}
.profile-role-card > .text-button {
  display: block;
  margin-top: 18px;
  text-align: left;
}
.profile-role-card > .muted {
  display: block;
  margin-top: 7px;
  line-height: 1.7;
}
.profile-dialog {
  padding: 32px 23px 24px;
}
.profile-dialog-paragraph {
  display: block;
  margin: 22px 0;
  font-size: 15px;
  line-height: 1.9;
}
.profile-certificate-sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 28px 20px;
  border: 3px double var(--jf-gold, #c9a96e);
  background: #fffdf9;
  text-align: center;
  font-size: 14px;
  line-height: 1.7;
}
.profile-certificate-brand {
  color: var(--jf-red, #c41a1a);
  font-size: 12px;
  letter-spacing: 2px;
}
.profile-certificate-heading {
  font-family: 'JiafengSerif', serif;
  font-weight: 600;
  font-size: 27px;
  line-height: 1.5;
}
.profile-sample-label {
  color: var(--jf-red, #c41a1a);
  font-size: 10px;
  letter-spacing: 1px;
  border-top: 1px solid var(--jf-gold, #c9a96e);
  border-bottom: 1px solid var(--jf-gold, #c9a96e);
  padding: 8px 4px;
}
.profile-certificate-subject {
  font-family: 'JiafengSerif', serif;
  font-weight: 600;
  font-size: 20px;
  line-height: 1.8;
}
.profile-certificate-id {
  font-size: 10px;
  overflow-wrap: anywhere;
}
.profile-certificate-seal {
  border: 2px solid var(--jf-red, #c41a1a);
  color: var(--jf-red, #c41a1a);
  font-family: 'JiafengSerif', serif;
  font-size: 18px;
  padding: 8px;
  transform: rotate(-7deg);
}
.profile-large .profile-description,
.profile-large .profile-local-note,
.profile-large .profile-dialog-paragraph {
  font-size: 18px;
  line-height: 1.9;
}
.profile-large .profile-record .story-title,
.profile-large .profile-quote {
  font-size: 22px;
}
.profile-large .profile-record .muted {
  font-size: 15px;
}
@media (max-width: 700px) {
  .profile-hero {
    flex-wrap: wrap;
    gap: 15px;
  }
  .profile-identity {
    min-width: 180px;
  }
  .profile-local-note {
    font-size: 12px;
  }
  .profile-overview .profile-overview-button {
    font-size: 11px;
    padding: 16px 5px;
  }
  .profile-tabs {
    gap: 6px;
  }
  .profile-tab {
    padding: 8px 9px;
    font-size: 12px;
  }
  .profile-record {
    flex-direction: column;
    gap: 12px;
  }
  .profile-record-copy {
    width: 100%;
  }
  .profile-actions {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 18px;
  }
  .profile-panel-heading {
    flex-wrap: wrap;
    gap: 10px;
  }
  .profile-certificate-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 360px) {
  .profile-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .profile-role-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .profile-role-options .profile-option-button {
    width: 100%;
    box-sizing: border-box;
  }
}
</style>
