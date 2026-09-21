<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t, locale } from '../../composables/useLocale'
import { readInputValue } from '../../composables/readInputValue'
import { assetUrl } from '../composables/useAssetUrl'
import { navigate } from '../../composables/useNavigation'
import { validateMediaFile, type LocalMediaFile } from '../../domain/localMedia'
import {
  videoSubmissionRecords,
  saveLocalMedia,
  removeLocalMedia,
  localMediaPath,
} from '../../composables/useLocalMedia'
import { useReadingTools } from '../../composables/useReadingTools'
const props = defineProps<{ initialTab?: string }>()
const tab = ref(
  props.initialTab === 'live' ? 'live' : props.initialTab === 'submit' ? 'submit' : '',
)
watch(
  () => props.initialTab,
  (value) => {
    if (value === 'live' || value === 'submit') tab.value = value
  },
)
const title = ref('')
const category = ref('documentary')
const file = ref<LocalMediaFile | null>(null)
const consent = ref(false)
const message = ref('')
const videoReady = ref(false)
const playbackError = ref(false)
const copied = ref(false)
const shot = ref(0)
const dialect = ref('mandarin')
const subtitleLanguage = ref('zh')
const liveState = ref('upcoming')
const reminder = ref(false)
const planText = ref('')
const categories = computed(() => [
  { id: 'documentary', label: t('纪实拍摄', 'Documentary') },
  { id: 'acting', label: t('真人演绎', 'Live action') },
  { id: 'animation', label: t('动漫作品', 'Animation') },
  { id: 'ai', label: t('AI 生成作品', 'AI-created work') },
])
const frames = computed(() => [
  {
    scene: t('餐桌 · 一家人围坐', 'Dinner table · the family gathers'),
    words: t('一粥一饭，记得来之不易。', 'Remember the work behind every meal.'),
    time: '00:00:00,000 --> 00:00:04,000',
  },
  {
    scene: t('楼道 · 帮邻居提物', 'Hallway · helping a neighbour'),
    words: t('邻里相助，让善意传递。', 'Pass kindness on by helping a neighbour.'),
    time: '00:00:04,000 --> 00:00:08,000',
  },
  {
    scene: t('书桌 · 亲子共读', 'Study · reading together'),
    words: t('家风，就在平凡的日常。', 'Family values live in everyday moments.'),
    time: '00:00:08,000 --> 00:00:12,000',
  },
])
const subtitles = computed(() =>
  (subtitleLanguage.value === 'zh'
    ? [
        '一粥一饭，记得来之不易。',
        '邻里之间，多一点体谅，多一份帮助。',
        '答应的事情，认真做到；平凡的日子，用心过好。',
      ]
    : [
        'Remember the work behind every meal.',
        'Offer understanding and practical help to your neighbours.',
        'Keep your promises and live ordinary days with care.',
      ]
  )
    .map((line, index) => `${index + 1}\n${frames.value[index]!.time}\n${line}`)
    .join('\n\n'),
)
const { exportText, exportMessage } = useReadingTools()
function chooseVideo() {
  message.value = ''
  uni.chooseVideo({
    sourceType: ['album'],
    compressed: false,
    success(result) {
      const path = result.tempFilePath
      const name =
        (result as unknown as { name?: string }).name ||
        `video-${Date.now()}.${path.split('.').pop()?.split('?')[0] || 'mp4'}`
      const next = {
        name:
          name.endsWith('mp4') || name.endsWith('mov') || name.endsWith('webm')
            ? name
            : `video-${Date.now()}.mp4`,
        size: result.size,
        path,
        duration: result.duration,
      }
      const error = validateMediaFile(next, 'video')
      if (error) {
        message.value =
          error === 'size'
            ? t(
                '视频须大于 0 且不超过 50MB。',
                'Video must be larger than zero and no more than 50MB.',
              )
            : error === 'duration'
              ? t('视频最长 10 分钟。', 'Video may be up to 10 minutes.')
              : t('请选择 MP4、MOV 或 WebM 视频。', 'Choose MP4, MOV or WebM video.')
        return
      }
      file.value = next
      videoReady.value = false
      playbackError.value = false
      consent.value = false
    },
    fail(error) {
      if (!error.errMsg?.includes('cancel'))
        message.value = t(
          '视频选取失败，请检查文件和权限。',
          'Video selection failed. Check file and permissions.',
        )
    },
  })
}
function metadata(event: unknown) {
  const value = (event as { detail?: { duration?: number } }).detail?.duration
  if (file.value && value && Number.isFinite(value)) file.value.duration = value
  videoReady.value = true
}
function submit() {
  if (
    !file.value ||
    title.value.trim().length < 2 ||
    !consent.value ||
    !videoReady.value ||
    playbackError.value
  ) {
    message.value = t(
      '请填写标题、确认视频能预览，并勾选本机演示约定。',
      'Enter a title, confirm the video preview works and accept the local demo agreement.',
    )
    return
  }
  if (validateMediaFile(file.value, 'video')) {
    message.value = t(
      '文件超出格式、50MB 或 10 分钟限制。',
      'The file exceeds format, 50MB or 10-minute limits.',
    )
    return
  }
  try {
    saveLocalMedia(
      {
        kind: 'video',
        title: title.value.trim(),
        category: category.value,
        fileName: file.value.name,
        size: file.value.size,
        duration: file.value.duration ?? 0,
      },
      file.value.path,
    )
    title.value = ''
    file.value = null
    consent.value = false
    message.value = t(
      '已保存本机视频投稿记录，未上传、未发布。',
      'Video submission metadata saved locally. Nothing was uploaded or published.',
    )
  } catch {
    message.value = t('保存失败，记录未新增。', 'Save failed. No record was added.')
  }
}
function remove(id: string) {
  try {
    removeLocalMedia(id)
    message.value = t('已删除本机投稿记录。', 'Local submission record deleted.')
  } catch {
    message.value = t('删除失败，记录未改变。', 'Deletion failed. The record is unchanged.')
  }
}
function copySubtitles() {
  copied.value = false
  uni.setClipboardData({
    data: subtitles.value,
    success() {
      copied.value = true
    },
    fail() {
      message.value = t('复制失败，请重试。', 'Copy failed. Retry.')
    },
  })
}
function toggleReminder() {
  try {
    uni.setStorageSync('jiafeng:live-reminder:v1', !reminder.value)
    reminder.value = !reminder.value
    message.value = t(
      '只保存本机提醒标记，不发送微信通知。',
      'Only a local reminder marker is saved; no WeChat notification is sent.',
    )
  } catch {
    message.value = t('提醒标记未保存。', 'The reminder marker was not saved.')
  }
}
try {
  reminder.value = uni.getStorageSync('jiafeng:live-reminder:v1') === true
} catch {
  /* read-only fallback */
}
</script>
<template>
  <view class="media-workshop">
    <view class="workshop-nav">
      <wd-button
        v-for="item in [
          { id: 'submit', label: t('我要投稿', 'Submit a video') },
          { id: 'create', label: t('图文分镜', 'Storyboard') },
          { id: 'subtitles', label: t('字幕与配音', 'Subtitles and voice') },
          { id: 'live', label: t('直播与预告', 'Live events') },
        ]"
        :key="item.id"
        size="small"
        :variant="tab === item.id ? 'base' : 'plain'"
        @click="tab = tab === item.id ? '' : item.id"
      >
        {{ item.label }}
      </wd-button>
    </view>
    <view v-if="tab" class="workshop-body">
      <view v-if="tab === 'submit'">
        <text class="workshop-title">
          {{ t('短视频投稿 · 本机演示', 'Video contribution · local demo') }}
        </text>
        <text class="workshop-note">
          {{
            t(
              '选取并预览自己的视频，保存标题与文件信息。文件不上传，刷新后需重选才能播放。支持 MP4 / MOV / WebM，50MB，10 分钟以内。',
              'Choose and preview your video; save the title and file metadata. Files are not uploaded and need selecting again after refresh. MP4 / MOV / WebM, up to 50MB and 10 minutes.',
            )
          }}
        </text>
        <text class="workshop-label">{{ t('作品类型', 'Video type') }}</text>
        <view class="workshop-nav">
          <wd-button
            v-for="item in categories"
            :key="item.id"
            size="small"
            :variant="category === item.id ? 'base' : 'plain'"
            @click="category = item.id"
          >
            {{ item.label }}
          </wd-button>
        </view>
        <text class="workshop-label">{{ t('作品标题', 'Video title') }}</text>
        <input
          v-model="title"
          @blur="title = readInputValue($event, title)"
          :maxlength="60"
          class="workshop-input"
          :placeholder="t('给这段家风故事起个名字', 'Name your family story')"
        />
        <view class="workshop-nav">
          <wd-button size="small" variant="plain" @click="chooseVideo">
            {{ t('选取视频', 'Choose video') }}
          </wd-button>
          <text v-if="file" class="workshop-note">
            {{ file.name }} · {{ (file.size / 1024 / 1024).toFixed(2) }} MB
          </text>
        </view>
        <video
          v-if="file"
          class="workshop-video"
          :src="file.path"
          controls
          @loadedmetadata="metadata"
          @error="playbackError = true"
        />
        <text v-if="playbackError" class="workshop-note">
          {{
            t(
              '此文件无法预览，请改选可播放的视频。',
              'This file cannot be previewed. Select a playable video.',
            )
          }}
        </text>
        <checkbox-group @change="consent = !consent">
          <label class="workshop-agreement">
            <checkbox :checked="consent" color="#C41A1A" />
            {{
              t(
                '我有权使用该素材；仅保存本机演示记录。',
                'I may use this material. Save a local demo record only.',
              )
            }}
          </label>
        </checkbox-group>
        <wd-button size="small" :disabled="!file" @click="submit">
          {{ t('保存视频投稿记录', 'Save video submission record') }}
        </wd-button>
        <text class="workshop-label">
          {{ t('我的视频投稿', 'My video contributions') }} · {{ videoSubmissionRecords.length }}
        </text>
        <view v-for="item in videoSubmissionRecords" :key="item.id" class="workshop-record">
          <text class="workshop-subtitle">{{ item.title }}</text>
          <text class="workshop-note">
            {{ categories.find((value) => value.id === item.category)?.label }} ·
            {{ item.createdAt.slice(0, 10) }} · {{ item.fileName }}
          </text>
          <text v-if="!localMediaPath(item.id)" class="workshop-note">
            {{
              t(
                '原文件需重新选择，记录信息仍保留。',
                'Select the original file again to play. Its metadata remains.',
              )
            }}
          </text>
          <wd-button size="small" variant="plain" @click="remove(item.id)">
            {{ t('删除记录', 'Delete record') }}
          </wd-button>
        </view>
      </view>
      <view v-if="tab === 'create'">
        <text class="workshop-title">
          {{ t('把一个故事，分成三个镜头', 'Tell a story in three shots') }}
        </text>
        <text class="workshop-note">
          {{
            t(
              '固定分镜示例，不分析输入、不生成视频。可记录自己的创作想法，再参考样例安排拍摄。',
              'Fixed storyboard sample: no input analysis or video generation. Note your ideas and use the example to plan a shoot.',
            )
          }}
        </text>
        <textarea
          v-model="planText"
          @blur="planText = readInputValue($event, planText)"
          class="workshop-textarea"
          :maxlength="500"
          :placeholder="t('记录主题、人物和场景…', 'Note a theme, characters and setting…')"
        />
        <view class="workshop-nav">
          <wd-button
            v-for="(item, index) in frames"
            :key="index"
            size="small"
            :variant="shot === index ? 'base' : 'plain'"
            @click="shot = index"
          >
            {{ t('镜头', 'Shot') }} {{ index + 1 }}
          </wd-button>
        </view>
        <view class="workshop-frame">
          <text class="workshop-frame-number">0{{ shot + 1 }}</text>
          <text class="workshop-subtitle">{{ frames[shot]?.scene }}</text>
          <text>{{ frames[shot]?.words }}</text>
          <text class="workshop-note">{{ frames[shot]?.time }}</text>
        </view>
        <wd-button
          size="small"
          variant="plain"
          @click="
            exportText(
              t('分镜计划', 'Storyboard plan'),
              `${t('原创固定分镜样例', 'Original fixed storyboard sample')}\n${planText}\n\n${frames.map((item, index) => `${index + 1}. ${item.scene}\n${item.words}`).join('\n\n')}`,
            )
          "
        >
          {{ t('导出或复制分镜文字', 'Export or copy storyboard text') }}
        </wd-button>
        <text class="workshop-note">{{ exportMessage }}</text>
      </view>
      <view v-if="tab === 'subtitles'">
        <text class="workshop-title">
          {{ t('字幕与方言配音 · 方案预览', 'Subtitles and dialect voice · concept preview') }}
        </text>
        <text class="workshop-note">
          {{
            t(
              '字幕是12秒样片的人工预置文本，不是自动识别；方言选择仅记录参数，不转换声音。',
              'Subtitles are manually prepared for the 12-second sample, not automatically recognized. Dialect choices only set preview parameters; no speech conversion occurs.',
            )
          }}
        </text>
        <view class="workshop-nav">
          <wd-button
            size="small"
            :variant="subtitleLanguage === 'zh' ? 'base' : 'plain'"
            @click="subtitleLanguage = 'zh'"
          >
            {{ t('中文字幕', 'Chinese subtitles') }}
          </wd-button>
          <wd-button
            size="small"
            :variant="subtitleLanguage === 'en' ? 'base' : 'plain'"
            @click="subtitleLanguage = 'en'"
          >
            {{ t('英文字幕', 'English subtitles') }}
          </wd-button>
        </view>
        <text class="workshop-transcript" selectable>{{ subtitles }}</text>
        <wd-button size="small" variant="plain" @click="copySubtitles">
          {{
            copied
              ? t('已复制SRT文本', 'SRT text copied')
              : t('复制SRT字幕文本', 'Copy SRT subtitle text')
          }}
        </wd-button>
        <text class="workshop-label">{{ t('配音方案', 'Voice concept') }}</text>
        <view class="workshop-nav">
          <wd-button
            v-for="item in [
              { id: 'mandarin', label: t('普通话', 'Mandarin') },
              { id: 'sichuan', label: t('四川方言', 'Sichuan dialect') },
              { id: 'cantonese', label: t('粤语', 'Cantonese') },
            ]"
            :key="item.id"
            size="small"
            :variant="dialect === item.id ? 'base' : 'plain'"
            @click="dialect = item.id"
          >
            {{ item.label }}
          </wd-button>
        </view>
        <text class="workshop-note">
          {{
            dialect === 'mandarin'
              ? t(
                  '当前可在音频故事库试听普通话合成样音。',
                  'A Mandarin synthetic sample is available in Audio stories.',
                )
              : t(
                  '该方言暂无音源，仅展示配音选择；不会把普通话冒充方言。',
                  'No audio source is available for this dialect. The voice choice is a concept only.',
                )
          }}
        </text>
        <wd-button size="small" variant="plain" @click="navigate('learning', { tab: 'audio' })">
          {{ t('前往音频故事库', 'Open audio stories') }}
        </wd-button>
      </view>
      <view v-if="tab === 'live'">
        <text class="workshop-title">
          {{ t('年度家风共读 · 云端讲堂', 'Annual family reading · online lecture') }}
        </text>
        <text class="workshop-note">
          {{
            t(
              '虚构直播活动，用于沟通三种界面状态，没有真实直播或排期。',
              'Fictional event with three preview states. No real stream or schedule is running.',
            )
          }}
        </text>
        <view class="workshop-nav">
          <wd-button
            v-for="item in [
              { id: 'upcoming', label: t('预告状态', 'Upcoming') },
              { id: 'live', label: t('直播演示状态', 'Live layout') },
              { id: 'ended', label: t('回放状态', 'Ended') },
            ]"
            :key="item.id"
            size="small"
            :variant="liveState === item.id ? 'base' : 'plain'"
            @click="liveState = item.id"
          >
            {{ item.label }}
          </wd-button>
        </view>
        <view class="workshop-live">
          <text class="workshop-subtitle">
            {{
              liveState === 'upcoming'
                ? t('预告 · 时间待定', 'Upcoming · time to be confirmed')
                : liveState === 'live'
                  ? t('直播界面预览 · 未连接直播信号', 'Live layout preview · no stream connected')
                  : t('本场回放 · 原创样片演示', 'Replay · original sample')
            }}
          </text>
          <text>
            {{
              t(
                '主题：把清廉与守信写进日常家书',
                'Theme: integrity and trust in everyday family letters',
              )
            }}
          </text>
          <text>
            {{ t('主讲：演示讲师 · 非真实专家', 'Speaker: fictional demonstration lecturer') }}
          </text>
        </view>
        <view class="workshop-nav">
          <wd-button v-if="liveState === 'upcoming'" size="small" @click="toggleReminder">
            {{
              reminder
                ? t('取消本机提醒标记', 'Remove local reminder')
                : t('添加本机提醒标记', 'Add local reminder')
            }}
          </wd-button>
          <wd-button size="small" variant="plain" @click="navigate('media', { id: 'lecture-01' })">
            {{ t('播放回放样片 / 缓存', 'Play or cache sample replay') }}
          </wd-button>
        </view>
      </view>
      <text v-if="message" class="workshop-message" role="status">{{ message }}</text>
    </view>
  </view>
</template>
<style scoped>
.media-workshop {
  margin: 20px 0 28px;
  min-width: 0;
}
.workshop-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.workshop-body {
  padding: 24px;
  border: 1px solid #c9a96e;
  background: #f5f0e8;
  color: #2c2c2c;
}
.workshop-title {
  display: block;
  font-family: 'JiafengSerif', serif;
  font-weight: 600;
  font-size: 23px;
  margin-bottom: 14px;
}
.workshop-subtitle {
  display: block;
  font-weight: 600;
  font-size: 18px;
  overflow-wrap: anywhere;
}
.workshop-note {
  display: block;
  font-size: 13px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.workshop-label {
  display: block;
  margin-top: 22px;
  margin-bottom: 8px;
  font-weight: 600;
}
.workshop-input {
  height: 44px;
  padding: 0 12px;
  background: #fffaf1;
  border: 1px solid #c9a96e;
  font-size: 16px;
}
.workshop-textarea {
  box-sizing: border-box;
  padding: 12px;
  width: 100%;
  height: 110px;
  margin: 16px 0;
  background: #fffaf1;
  border: 1px solid #c9a96e;
  font-size: 16px;
  line-height: 1.7;
}
.workshop-video {
  width: 100%;
  height: 280px;
}
.workshop-agreement {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 14px;
  line-height: 1.8;
  margin: 20px 0;
}
.workshop-record {
  padding: 15px 0;
  border-top: 1px solid #c9a96e;
  display: flex;
  gap: 12px;
  flex-direction: column;
  align-items: flex-start;
}
.workshop-frame,
.workshop-live {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 30px 24px;
  background: #fffaf1;
  border-left: 4px solid #c41a1a;
  margin: 20px 0;
  line-height: 1.8;
}
.workshop-frame-number {
  font-size: 40px;
  color: #c41a1a;
  font-family: 'JiafengSerif', serif;
}
.workshop-transcript {
  display: block;
  white-space: pre-wrap;
  line-height: 1.8;
  background: #fffaf1;
  padding: 18px;
  margin: 18px 0;
  overflow-wrap: anywhere;
}
.workshop-message {
  display: block;
  padding: 15px;
  margin-top: 18px;
  border-left: 3px solid #c41a1a;
  line-height: 1.7;
}
@media (max-width: 650px) {
  .workshop-body {
    padding: 16px;
  }
  .workshop-title {
    font-size: 21px;
  }
  .workshop-video {
    height: 200px;
  }
  .workshop-frame,
  .workshop-live {
    padding: 22px 16px;
  }
}
</style>
