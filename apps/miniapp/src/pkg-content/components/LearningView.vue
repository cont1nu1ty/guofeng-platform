<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import SectionHeading from '../../components/SectionHeading.vue'
import CertificateExport from '../../components/CertificateExport.vue'
import AudioRecitationPanel from './AudioRecitationPanel.vue'
import {
  repo,
  region,
  register,
  isRegistered,
  registrations,
  revision,
  notify,
} from '../../composables/useDemo'
import { navigate, goBack, useRouteParams } from '../../composables/useNavigation'
import { t } from '../../composables/useLocale'
import { activityTranslations, venues, type BilingualText } from '../../domain/contentCatalog'
import {
  checkInActivity,
  clearActivityCheckIn,
  isCheckedIn,
  learningStorageError,
} from '../../composables/useLearningProgress'
import type { Activity } from '../../domain/types'
onMounted(async () => {
  await nextTick()
  if (params.value.tab === 'audio')
    uni.pageScrollTo({ selector: '#audio-recitation-panel', duration: 0 })
})
const L = (value: BilingualText) => t(value.zh, value.en)
const params = useRouteParams()
const activities = computed(() => {
  revision.value
  return repo.listActivities({ region: region.value })
})
const event = computed(() => {
  revision.value
  return repo.listActivities().find((item) => item.id === params.value.id)
})
const eventVenue = computed(() => venues.find((item) => item.activityId === event.value?.id))
const showCertificate = ref(false)
const registeredOnly = ref(false)
const filtered = computed(() =>
  activities.value.filter((item) => !registeredOnly.value || isRegistered(item.id)),
)
watch(
  () => params.value.id,
  () => {
    showCertificate.value = false
  },
)
const title = (item: Activity) => t(item.title, activityTranslations[item.id]?.title ?? item.title)
const category = (item: Activity) =>
  t(item.category, activityTranslations[item.id]?.category ?? item.category)
const excerpt = (item: Activity) =>
  t(item.excerpt, activityTranslations[item.id]?.excerpt ?? item.excerpt)
const content = (item: Activity) =>
  t(item.content, activityTranslations[item.id]?.content ?? item.content)
const location = (item: Activity) => {
  const venue = venues.find((entry) => entry.activityId === item.id)
  return venue ? L(venue.city) : item.location
}
function toggleRegistration(id: string) {
  register(id)
  if (!isRegistered(id)) {
    clearActivityCheckIn(id)
    showCertificate.value = false
  }
}
function checkIn(id: string) {
  if (!isRegistered(id)) {
    notify(t('请先完成演示预约', 'Please make a sample booking first'))
    return
  }
  if (!checkInActivity(id)) {
    notify(
      t(
        '本机签到保存失败，请检查存储后重试。',
        'Could not save the sample check-in. Check local storage.',
      ),
    )
    return
  }
  notify(
    t(
      '演示签到成功，已生成参与证书样张',
      'Sample check-in saved. A participation certificate sample is ready.',
    ),
  )
}
function showAllActivities() {
  registeredOnly.value = false
  region.value = 'all'
}
</script>
<template>
  <view class="content-page">
    <template v-if="event">
      <view class="content-back">
        <wd-button variant="plain" size="small" @click="goBack()">
          {{ t('返回传习活动', 'Back to activities') }}
        </wd-button>
        <text class="content-demo-label">
          {{ t('虚构活动 · 不是真实招募', 'Fictional activity · no real enrolment') }}
        </text>
      </view>
      <view class="content-activity-hero">
        <view class="content-hero-copy">
          <text class="content-hero-eyebrow">{{ category(event) }}</text>
          <text class="content-hero-title">{{ title(event) }}</text>
          <text class="content-hero-summary">{{ excerpt(event) }}</text>
          <text class="content-hero-detail">{{ event.date }} · {{ event.time }}</text>
        </view>
        <view class="content-hero-seal">习</view>
      </view>
      <view class="content-activity-detail-grid">
        <view class="content-activity-about">
          <text class="content-panel-title">{{ t('活动介绍', 'About the activity') }}</text>
          <view class="content-prose">
            <text>{{ content(event) }}</text>
          </view>
          <view class="content-section-line">
            <text class="content-panel-title">
              {{ t('一起经历的四个时刻', 'Four moments to experience together') }}
            </text>
          </view>
          <view class="content-event-agenda">
            <view
              v-for="(step, index) in [
                { zh: '相遇 · 导入与破冰', en: 'Meet · introduction and welcome' },
                { zh: '共读 · 听一段家风故事', en: 'Read · a family story' },
                { zh: '实践 · 写下家庭约定', en: 'Create · a family commitment' },
                { zh: '分享 · 把收获带回家', en: 'Share · take an idea home' },
              ]"
              :key="index"
            >
              <text class="content-stop-number">{{ index + 1 }}</text>
              <text>{{ t(step.zh, step.en) }}</text>
            </view>
          </view>
          <view class="content-practice">
            <text class="content-red-label">{{ t('参与提示', 'Before you join') }}</text>
            <text>
              {{
                t(
                  '当前演示不收费、不占用真实名额，也不需要真实个人信息。请使用样例身份体验预约与签到。',
                  'This demo is free, does not reserve real places and needs no real personal information. Use the sample identity to try booking and check-in.',
                )
              }}
            </text>
          </view>
        </view>
        <view class="content-booking-panel">
          <text class="content-panel-title">{{ t('活动安排', 'Activity information') }}</text>
          <view class="content-booking-fact">
            <text>{{ t('日期时间', 'Date and time') }}</text>
            <text>{{ event.date }}</text>
            <text>{{ event.time }}</text>
          </view>
          <view class="content-booking-fact">
            <text>{{ t('活动阵地', 'Venue') }}</text>
            <text>{{ eventVenue ? L(eventVenue.title) : location(event) }}</text>
            <text class="content-caption">{{ location(event) }}</text>
          </view>
          <view class="content-booking-fact">
            <text>{{ t('组织方', 'Organiser') }}</text>
            <text>{{ t(event.organizer, 'Family Heritage Demo Workshop (fictional)') }}</text>
          </view>
          <view class="content-booking-count">
            <text>{{ event.registeredCount }}</text>
            <text>/ {{ event.capacity }} {{ t('人（示例）', 'places (sample)') }}</text>
          </view>
          <wd-button
            block
            :variant="isRegistered(event.id) ? 'plain' : 'base'"
            @click="toggleRegistration(event.id)"
          >
            {{
              isRegistered(event.id)
                ? t('取消演示预约', 'Cancel sample booking')
                : t('预约本场体验', 'Try booking this activity')
            }}
          </wd-button>
          <wd-button
            v-if="eventVenue"
            block
            variant="plain"
            @click="navigate('venues', { id: eventVenue.id })"
          >
            {{ t('查看阵地与导览', 'View venue and route') }}
          </wd-button>
        </view>
      </view>
      <view class="content-checkin-panel">
        <view>
          <text class="content-panel-title">
            {{ t('到场签到 · 参与留念', 'Check in · remember the experience') }}
          </text>
          <text class="content-description">
            {{
              t(
                '演示签到可立即体验，不校验真实位置或时间。',
                'Try sample check-in now. No real location or time is verified.',
              )
            }}
          </text>
        </view>
        <view class="content-button-row">
          <wd-button
            :disabled="!isRegistered(event.id) || isCheckedIn(event.id) || learningStorageError"
            @click="checkIn(event.id)"
          >
            {{
              isCheckedIn(event.id) && isRegistered(event.id)
                ? t('已完成演示签到', 'Sample check-in completed')
                : t('体验活动签到', 'Try activity check-in')
            }}
          </wd-button>
          <wd-button
            v-if="isCheckedIn(event.id) && isRegistered(event.id)"
            variant="plain"
            @click="showCertificate = !showCertificate"
          >
            {{
              showCertificate
                ? t('收起参与证书', 'Hide certificate')
                : t('查看参与证书', 'View certificate')
            }}
          </wd-button>
        </view>
        <text v-if="!isRegistered(event.id)" class="content-caption">
          {{
            t(
              '先预约，再体验签到与证书。',
              'Book first to try check-in and the sample certificate.',
            )
          }}
        </text>
        <text v-if="learningStorageError" class="content-warning">
          {{
            t(
              '本机存储不可用，签到暂不能保存。',
              'Local storage is unavailable. Check-in cannot be saved.',
            )
          }}
        </text>
      </view>
      <view
        v-if="showCertificate && isCheckedIn(event.id) && isRegistered(event.id)"
        class="content-certificate"
      >
        <text class="content-certificate-brand">{{ t('家风中华行', 'Family Heritage') }}</text>
        <text class="content-certificate-title">
          {{ t('活动参与证书', 'Certificate of Participation') }}
        </text>
        <text class="content-certificate-sample">
          {{ t('样 张 · 无 认 证 效 力', 'SAMPLE · NOT A CREDENTIAL') }}
        </text>
        <text>
          {{
            t(
              '体验用户完成以下活动的预约与签到演示',
              'The demo user completed the booking and check-in flow for',
            )
          }}
        </text>
        <text class="content-certificate-course">{{ title(event) }}</text>
        <text>{{ event.date }} · {{ location(event) }}</text>
        <view class="content-certificate-seal">{{ t('演示', 'DEMO') }}</view>
        <text class="content-caption">
          {{
            t(
              '本样张不证明实际参加活动，不具有培训、评奖或认证效力。',
              'This sample does not prove actual attendance or grant training, awards or certification.',
            )
          }}
        </text>
        <CertificateExport
          :certificate="{
            id: 'activity-' + event.id,
            title: t('活动参与证书', 'Activity Participation'),
            recipient: t('家风同行者', 'Demo participant'),
            subject: title(event),
            date: event.date,
          }"
        />
      </view>
    </template>
    <template v-else-if="params.id">
      <view class="empty-state">
        {{ t('未找到这个示例活动。', 'This sample activity was not found.') }}
        <wd-button variant="plain" @click="navigate('learning')">
          {{ t('查看全部活动', 'View all activities') }}
        </wd-button>
      </view>
    </template>
    <template v-else>
      <SectionHeading
        :title="t('在行走中，读懂家风', 'Discover family values through experience')"
        :eyebrow="t('家风传习', 'Learn and experience')"
        :subtitle="
          t(
            '从线上共读到线下研学，让好家风走进日常。',
            'Bring family values into daily life through reading and cultural learning.',
          )
        "
      />
      <view class="content-classroom-intro">
        <view class="content-small-seal">习</view>
        <view class="content-intro-copy">
          <text class="content-panel-title">
            {{ t('一堂家风课，一次心灵之旅', 'A lesson in family values, a journey together') }}
          </text>
          <text class="content-description">
            {{
              t(
                '家书共读 · 文化研学 · 家训手作',
                'Family reading · cultural learning · craft workshops',
              )
            }}
          </text>
        </view>
        <view class="content-learning-stat">
          <text>{{ registrations.length }}</text>
          <text>{{ t('我的演示预约', 'My sample bookings') }}</text>
        </view>
      </view>
      <view class="content-learning-shortcuts">
        <view class="learning-shortcut-card" @click="navigate('classroom')">
          <view class="learning-shortcut-mark"><wd-icon name="book" size="32px" /></view>
          <view class="learning-shortcut-copy">
            <text class="content-panel-title">{{ t('清廉课堂', 'Integrity classroom') }}</text>
            <text class="content-description">
              {{ t('学习课程与情景测验', 'Courses and scenario quizzes') }}
            </text>
          </view>
          <wd-icon name="arrow-right" size="18px" custom-class="learning-shortcut-arrow" />
        </view>
        <view class="learning-shortcut-card" @click="navigate('venues')">
          <view class="learning-shortcut-mark"><wd-icon name="location" size="32px" /></view>
          <view class="learning-shortcut-copy">
            <text class="content-panel-title">
              {{ t('寻找传习阵地', 'Explore learning venues') }}
            </text>
            <text class="content-description">
              {{ t('阵地示意图与场馆导览', 'Venue schematic and visit guides') }}
            </text>
          </view>
          <wd-icon name="arrow-right" size="18px" custom-class="learning-shortcut-arrow" />
        </view>
      </view>
      <view id="audio-recitation-panel"><AudioRecitationPanel /></view>
      <view class="content-filter-tabs content-filter-space">
        <view
          :class="['content-filter-chip', { active: !registeredOnly }]"
          @click="registeredOnly = false"
        >
          {{ t('全部活动', 'All activities') }}
        </view>
        <view
          :class="['content-filter-chip', { active: registeredOnly }]"
          @click="registeredOnly = true"
        >
          {{ t('我的预约', 'My bookings') }}
        </view>
      </view>
      <view class="activity-grid">
        <view
          v-for="(item, index) in filtered"
          :key="item.id"
          class="activity-card"
          @click="navigate('learning', { id: item.id })"
        >
          <view :class="['activity-art', 'activity-art-' + index]">
            <text class="tag">{{ category(item) }}</text>
            <view class="arch-art"><view class="arch-inner" /></view>
            <text class="activity-art-label">{{ ['书香', '清风', '传习'][index % 3] }}</text>
          </view>
          <view class="activity-content">
            <view class="story-meta">
              <text>{{ item.date }}</text>
              <text>· {{ item.time }}</text>
            </view>
            <text class="story-title">{{ title(item) }}</text>
            <text class="story-excerpt">{{ excerpt(item) }}</text>
            <view class="event-location">
              <wd-icon name="location" />
              {{ location(item) }}
            </view>
            <view class="card-bottom">
              <text class="muted">
                {{ item.registeredCount }} / {{ item.capacity }}
                {{ t('人（示例）', 'places (sample)') }}
              </text>
              <wd-button
                :variant="isRegistered(item.id) ? 'plain' : 'base'"
                size="small"
                @click.stop="navigate('learning', { id: item.id })"
              >
                {{
                  isRegistered(item.id)
                    ? t('已预约 · 查看', 'Booked · view')
                    : t('查看与预约', 'Details and booking')
                }}
              </wd-button>
            </view>
          </view>
        </view>
      </view>
      <view v-if="!filtered.length" class="empty-state">
        <text>
          {{
            registeredOnly
              ? t('当前地区暂无演示预约。', 'No sample bookings in this region.')
              : t(
                  '该地区暂未安排演示活动，切换全国查看。',
                  'No sample activities in this region. Switch to all regions.',
                )
          }}
        </text>
        <wd-button variant="plain" @click="showAllActivities">
          {{ t('查看全国活动', 'View all activities') }}
        </wd-button>
      </view>
      <view class="scope-note">
        {{
          t(
            '预约、签到与参与证书只在当前设备演示，不占用真实名额。阵地与地址均为虚构，不能据此安排出行。',
            'Booking, check-in and certificate flows are local samples. No real places are reserved. Venues and addresses are fictional.',
          )
        }}
      </view>
    </template>
  </view>
</template>
