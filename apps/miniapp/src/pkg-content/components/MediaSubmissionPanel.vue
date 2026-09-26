<script setup lang="ts">
import AudioRecitationPanel from './AudioRecitationPanel.vue'
import { recitationRecords, localMediaPath } from '../../composables/useLocalMedia'
import { computed, reactive, ref } from 'vue'
import { command, remoteUser, remoteWorkspace, uploadRemoteFile } from '../../services/api'
import { locale, t } from '../../composables/useLocale'
import { notify } from '../../composables/useDemo'
import { readInputValue } from '../../composables/readInputValue'
import { validateMediaFile, type MediaSubmission } from '../../domain/remoteCatalog'
import { regions } from '../../domain/fixtures'
const opened = ref(false)
const languages = ['zh', 'en'] as const
function toggleForm() {
  reset()
  opened.value = !opened.value
}
const recordingTools = ref(false)
const busy = ref(false)
const message = ref('')
const editing = ref<MediaSubmission | null>(null)
const fileName = ref('')
const form = reactive({
  title: '',
  excerpt: '',
  transcript: '',
  collection: '',
  duration: '',
  category: 'documentary',
  type: 'short',
  language: locale.value,
  region: '',
  sourceFileId: '',
})
const myItems = computed(() => remoteWorkspace.mediaSubmissions)
const choices = computed(() =>
  regions.filter((x) => x.id !== 'all' && remoteUser.value?.regionIds.includes(x.id)),
)
function reset() {
  editing.value = null
  fileName.value = ''
  Object.assign(form, {
    title: '',
    excerpt: '',
    transcript: '',
    collection: '',
    duration: '',
    category: 'documentary',
    type: 'short',
    language: locale.value,
    region: remoteUser.value?.regionIds.find((x) => x !== 'all') || '',
    sourceFileId: '',
  })
  message.value = ''
}
function revise(item: MediaSubmission) {
  const language = item.language
  editing.value = item
  Object.assign(form, {
    title: item.title[language],
    excerpt: item.excerpt[language],
    transcript: item.transcript.map((x) => x[language]).join('\n'),
    collection: item.collection[language],
    duration: item.duration,
    category: item.category,
    type: item.type,
    language,
    region: item.region,
    sourceFileId: item.sourceFileId,
  })
  fileName.value = t('保留原媒体文件，可重新选择', 'Keeping the existing file; you may replace it')
  opened.value = true
  message.value = ''
}
async function upload(path: string, name: string, size: number) {
  const issue = validateMediaFile(name, size)
  if (issue) {
    message.value = issue
    return
  }
  busy.value = true
  message.value = t('正在上传文件，请稍候…', 'Uploading your file…')
  try {
    const file = await uploadRemoteFile<'video' | 'audio'>(path, name, 'media')
    form.sourceFileId = file.fileId
    form.type = /\.(mp3|wav)$/i.test(name) ? 'audio' : 'short'
    if (form.type === 'audio') form.category = 'recitation'
    fileName.value = file.name || name
    message.value = t(
      '文件上传完成，请核对信息后提交审核。',
      'File uploaded. Check the details and submit for review.',
    )
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : t('上传失败，请重试', 'Upload failed. Please retry.')
  } finally {
    busy.value = false
  }
}
async function useRecording(item: (typeof recitationRecords.value)[number]) {
  const path = localMediaPath(item.id)
  if (!path) {
    message.value = t(
      '本机文件已失效，请重新选择原文件。',
      'The local file is unavailable. Choose the original file again.',
    )
    return
  }
  if (!/\.(mp3|wav)$/i.test(item.fileName)) {
    message.value = t(
      '该录音格式暂不支持上传。服务仅接收 MP3/WAV；浏览器产生的 WebM/M4A/OGG 不会自动转换，请另选符合格式的文件。',
      'This recording format cannot be uploaded. Only MP3/WAV is supported; browser WebM/M4A/OGG recordings are not converted. Choose a supported file.',
    )
    return
  }
  reset()
  opened.value = true
  form.title = item.title
  await upload(path, item.fileName, item.size)
}
function choose() {
  if (!remoteUser.value) {
    notify(t('请先登录后投稿', 'Sign in before submitting'))
    return
  }
  // #ifdef H5
  const picker = document.createElement('input')
  picker.type = 'file'
  picker.accept = '.mp4,.mp3,.wav'
  picker.onchange = async () => {
    const file = picker.files?.[0]
    if (!file) return
    const path = URL.createObjectURL(file)
    try {
      await upload(path, file.name, file.size)
    } finally {
      URL.revokeObjectURL(path)
    }
  }
  picker.click()
  // #endif
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['mp4', 'mp3', 'wav'],
    success: (result) => {
      const file = result.tempFiles[0]
      if (file) void upload(file.path, file.name, file.size)
    },
    fail: (error) => {
      if (!error.errMsg.includes('cancel'))
        message.value = t('选择文件失败，请重试', 'File selection failed. Please retry.')
    },
  })
  // #endif
}
async function submit() {
  if (!form.title.trim() || !form.sourceFileId || busy.value) return
  busy.value = true
  message.value = ''
  try {
    const payload = {
      ...form,
      type: form.type === 'audio' ? 'audio' : form.category === 'lecture' ? 'replay' : 'short',
      title: form.title.trim(),
      region: form.region || remoteUser.value?.regionIds.find((x) => x !== 'all'),
    }
    await command(
      editing.value ? 'media.resubmit' : 'media.submit',
      editing.value?.id,
      payload,
      editing.value?.lockVersion,
    )
    reset()
    opened.value = false
    message.value = t('已提交，等待后台审核。', 'Submitted for review.')
  } catch (error) {
    message.value =
      error instanceof Error
        ? error.message
        : t('提交失败，请重试', 'Submission failed. Please retry.')
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <view class="showcase-panel media-submit-panel">
    <view class="showcase-row-between">
      <text class="showcase-card-title">{{ t('我的媒体投稿', 'My media submissions') }}</text>
      <wd-button size="small" :disabled="busy || !remoteUser" @click="toggleForm">
        {{ t('上传作品', 'Upload a work') }}
      </wd-button>
    </view>
    <text class="showcase-note">
      {{
        t(
          '视频或朗诵音频上传后由运营审核，审核通过后才进入公开展播。支持 MP4 / MP3 / WAV，最大 50 MiB；不提供转码、直播或自动字幕。',
          'Video and recitation uploads require editorial approval before public display. MP4 / MP3 / WAV up to 50 MiB. Transcoding, live streaming and automatic captions are unavailable.',
        )
      }}
    </text>
    <wd-button size="small" variant="plain" @click="recordingTools = !recordingTools">
      {{ t('本机录音与诵读记录', 'Local recording and recitations') }}
    </wd-button>
    <view v-if="recordingTools">
      <AudioRecitationPanel />
      <text class="scope-note">
        {{
          t(
            '本机打卡不自动上传。录音完成后保存本机记录，再选下方“上传这条录音”。浏览器常生成 WebM/M4A，当前服务仅接收 MP3/WAV，不提供格式转换。',
            'Local check-ins are not uploaded automatically. Save a local record, then choose Upload this recording. Browsers often produce WebM/M4A; the server accepts only MP3/WAV without conversion.',
          )
        }}
      </text>
      <view v-for="item in recitationRecords" :key="item.id" class="media-own-item">
        <text>{{ item.title }} · {{ item.fileName }}</text>
        <wd-button
          size="small"
          :disabled="busy || !remoteUser || !localMediaPath(item.id)"
          @click="useRecording(item)"
        >
          {{ t('上传这条录音', 'Upload this recording') }}
        </wd-button>
      </view>
    </view>
    <text v-if="!remoteUser" class="scope-note">
      {{
        t(
          '请在个人中心登录后投稿和查看处理结果。',
          'Sign in through My account to submit and see review results.',
        )
      }}
    </text>
    <view v-if="opened" class="media-submit-form">
      <text>
        {{
          editing ? t('修改重投', 'Revise and resubmit') : t('新媒体投稿', 'New media submission')
        }}
      </text>
      <input
        v-model="form.title"
        :disabled="busy"
        maxlength="100"
        :placeholder="t('作品标题', 'Title')"
        @blur="form.title = readInputValue($event, form.title)"
      />
      <view class="showcase-filter">
        <wd-button
          v-for="language in languages"
          :key="language"
          size="small"
          :variant="form.language === language ? 'base' : 'plain'"
          :disabled="busy"
          @click="form.language = language"
        >
          {{ language === 'zh' ? '中文' : 'English' }}
        </wd-button>
      </view>
      <view class="showcase-filter">
        <wd-button
          v-for="item in choices"
          :key="item.id"
          size="small"
          :variant="(form.region || choices[0]?.id) === item.id ? 'base' : 'plain'"
          :disabled="busy"
          @click="form.region = item.id"
        >
          {{ t(item.label) }}
        </wd-button>
      </view>
      <view class="showcase-filter">
        <wd-button
          v-for="item in [
            { id: 'letter', zh: '家书演绎', en: 'Letters' },
            { id: 'documentary', zh: '日常纪实', en: 'Documentary' },
            { id: 'lecture', zh: '讲堂回放', en: 'Lecture' },
            { id: 'recitation', zh: '家风朗诵', en: 'Recitation' },
          ]"
          :key="item.id"
          size="small"
          :disabled="busy"
          :variant="form.category === item.id ? 'base' : 'plain'"
          @click="form.category = item.id"
        >
          {{ t(item.zh, item.en) }}
        </wd-button>
      </view>
      <textarea
        v-model="form.excerpt"
        :disabled="busy"
        maxlength="1000"
        :placeholder="t('作品简介', 'Description')"
        @blur="form.excerpt = readInputValue($event, form.excerpt)"
      />
      <textarea
        v-model="form.transcript"
        :disabled="busy"
        maxlength="20000"
        :placeholder="t('文字脚本或朗诵内容（可选）', 'Transcript (optional)')"
        @blur="form.transcript = readInputValue($event, form.transcript)"
      />
      <text v-if="fileName" class="showcase-note">{{ fileName }}</text>
      <view class="showcase-actions">
        <wd-button size="small" variant="plain" :disabled="busy" @click="choose">
          {{ t('选择媒体文件', 'Choose media file') }}
        </wd-button>
        <wd-button
          size="small"
          :disabled="busy || !form.sourceFileId || !form.title.trim()"
          @click="submit"
        >
          {{ busy ? t('处理中…', 'Working…') : t('提交审核', 'Submit for review') }}
        </wd-button>
        <wd-button size="small" variant="plain" :disabled="busy" @click="opened = false">
          {{ t('收起', 'Close') }}
        </wd-button>
      </view>
    </view>
    <text v-if="message" class="scope-note" role="status">{{ message }}</text>
    <view v-for="item in myItems" :key="item.id" class="media-own-item">
      <text class="showcase-card-title">{{ item.title[item.language] }}</text>
      <text>{{ item.status }}</text>
      <text v-if="item.reviewNote">
        {{ t('处理意见：', 'Review note: ') }}{{ item.reviewNote }}
      </text>
      <wd-button
        v-if="item.status === '已退回'"
        size="small"
        variant="plain"
        :disabled="busy"
        @click="revise(item)"
      >
        {{ t('修改重投', 'Revise and resubmit') }}
      </wd-button>
    </view>
    <text v-if="remoteUser && !myItems.length" class="showcase-note">
      {{ t('尚无媒体投稿', 'No media submissions yet') }}
    </text>
  </view>
</template>
<style scoped>
.media-submit-form,
.media-own-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 18px;
}
.media-submit-form input,
.media-submit-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--jf-border);
  background: var(--jf-surface);
  font-size: 14px;
}
.media-submit-form input {
  height: 44px;
}
.media-submit-form textarea {
  height: 110px;
}
.media-own-item {
  border-top: 1px solid var(--jf-border);
  padding-top: 14px;
  font-size: 14px;
}
</style>
