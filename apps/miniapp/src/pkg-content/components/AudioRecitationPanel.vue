<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { locale, t } from '../../composables/useLocale'
import { assetUrl } from '../composables/useAssetUrl'
import { readInputValue } from '../../composables/readInputValue'
import { audioStories } from '../domain/audioStories'
import { isHttpMode } from '../../config/dataMode'
import { currentSessionEpoch, remoteUser, uploadRemoteFile } from '../../services/api'
import { saveRecitation } from '../../services/cloudRecords'
import { mediaCatalog } from '../../domain/showcaseCatalog'
import { region } from '../../composables/useDemo'
import CloudRecitationRecords from '../../components/CloudRecitationRecords.vue'
import { validateMediaFile, type LocalMediaFile } from '../../domain/localMedia'
import {
  localMediaError,
  recitationRecords,
  saveLocalMedia,
  removeLocalMedia,
  localMediaPath,
} from '../../composables/useLocalMedia'
const tab = ref('stories')
const selected = ref(0)
const stories = computed(() =>
  isHttpMode
    ? mediaCatalog
        .filter(
          (item) =>
            item.type === 'audio' &&
            item.category === 'recitation' &&
            (region.value === 'all' || item.region === 'all' || item.region === region.value),
        )
        .map((item) => ({
          id: item.id,
          title: item.title,
          text: {
            zh: item.transcript.map((line) => line.zh).join('\n'),
            en: item.transcript.map((line) => line.en).join('\n'),
          },
          source: item.source,
        }))
    : audioStories.map((item) => ({
        ...item,
        source: `/pkg-content/static/audio/${item.id}-${locale.value}.mp3`,
      })),
)
const story = computed(() => stories.value[selected.value] || stories.value[0])
const busy = ref(false)
const showLegacy = ref(false)
let uploadedFileId = ''
const playerState = ref<'idle' | 'loading' | 'playing' | 'paused'>('idle')
const time = ref(0)
const duration = ref(0)
const playingKey = ref('')
const message = ref('')
const title = ref('')
const file = ref<LocalMediaFile | null>(null)
const recording = ref(false)
const requesting = ref(false)
const consent = ref(false)
const recordSeconds = ref(0)
let player: UniApp.InnerAudioContext | undefined
let nativeRecorder:
  | (UniApp.RecorderManager & {
      offStart?: (callback: () => void) => void
      offError?: (callback: () => void) => void
      offStop?: (callback: (result: NativeRecording) => void) => void
    })
  | undefined
interface NativeRecording {
  fileSize: number
  tempFilePath: string
  duration: number
}
let recordTimer: ReturnType<typeof setInterval> | undefined
let disposed = false
// #ifdef H5
let recorder: MediaRecorder | undefined
let stream: MediaStream | undefined
// #endif
function clock(value: number) {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}
function stopAudio() {
  player?.stop()
  player?.destroy()
  player = undefined
  playerState.value = 'idle'
  playingKey.value = ''
  time.value = 0
}
function play(path: string, key: string) {
  if (playingKey.value === key && player) {
    if (playerState.value === 'playing') player.pause()
    else player.play()
    return
  }
  stopAudio()
  message.value = ''
  try {
    player = uni.createInnerAudioContext()
    const current = player
    playingKey.value = key
    playerState.value = 'loading'
    current.onPlay(() => {
      playerState.value = 'playing'
    })
    current.onPause(() => {
      playerState.value = 'paused'
    })
    current.onTimeUpdate(() => {
      time.value = current.currentTime
      duration.value = current.duration
    })
    current.onEnded(() => {
      playerState.value = 'idle'
      time.value = 0
      playingKey.value = ''
    })
    current.onError(() => {
      stopAudio()
      message.value = t(
        '音频未能播放，请重选文件或重试。',
        'Audio could not play. Select the file again or retry.',
      )
    })
    current.src = path
    current.play()
  } catch {
    stopAudio()
    message.value = t('本端无法启动播放器。', 'The audio player could not start.')
  }
}
function playStory() {
  if (story.value) play(assetUrl(story.value.source), story.value.id)
}
function acceptFile(next: LocalMediaFile) {
  const error = validateMediaFile(next, 'recitation')
  if (error) {
    message.value =
      error === 'format'
        ? t(
            '请选择 MP3、WAV、M4A、AAC、OGG 或 WebM 音频。',
            'Choose MP3, WAV, M4A, AAC, OGG or WebM audio.',
          )
        : error === 'size'
          ? t(
              '音频须大于 0 且不超过 10MB。',
              'Audio must be larger than zero and no more than 10MB.',
            )
          : t('诵读音频最长 3 分钟。', 'Recitations may be up to 3 minutes.')
    return
  }
  stopAudio()
  uploadedFileId = ''
  file.value = next
  message.value = ''
  consent.value = false
}
function chooseAudio() {
  message.value = ''
  // #ifdef H5
  uni.chooseFile({
    count: 1,
    type: 'all',
    extension: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm'],
    success(result) {
      const item = Array.isArray(result.tempFiles) ? result.tempFiles[0] : undefined
      if (item) {
        const chosen = item as unknown as { name?: string; size: number; path?: string }
        acceptFile({
          name: chosen.name ?? 'audio.mp3',
          size: chosen.size,
          path: chosen.path ?? result.tempFilePaths[0]!,
        })
      }
    },
    fail(error) {
      if (!error.errMsg?.includes('cancel'))
        message.value = t('选取失败，请重试。', 'File selection failed. Please retry.')
    },
  })
  // #endif
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'],
    success(result) {
      const item = result.tempFiles[0]
      if (item) acceptFile({ name: item.name, size: item.size, path: item.path })
    },
    fail(error) {
      if (!error.errMsg?.includes('cancel'))
        message.value = t(
          '选取失败，请从聊天文件中选择音频。',
          'Selection failed. Choose an audio file from chat files.',
        )
    },
  })
  // #endif
}
function clearTimer() {
  if (recordTimer) clearInterval(recordTimer)
  recordTimer = undefined
}
function onRecording() {
  if (disposed) {
    nativeRecorder?.stop()
    return
  }
  requesting.value = false
  recording.value = true
  recordSeconds.value = 0
  clearTimer()
  recordTimer = setInterval(() => {
    recordSeconds.value++
    if (recordSeconds.value >= 180) stopRecording()
  }, 1000)
}
function recordFailure() {
  requesting.value = false
  recording.value = false
  clearTimer()
  message.value = t(
    '未取得麦克风、没有录音设备或本端不支持录音。可改用“选取音频文件”。',
    'Microphone access, a recording device or recording support is unavailable. Use Choose audio file instead.',
  )
}
async function startRecording() {
  stopAudio()
  message.value = ''
  requesting.value = true
  disposed = false
  // #ifdef H5
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      throw new Error('unsupported')
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (disposed) {
      stream.getTracks().forEach((track) => track.stop())
      requesting.value = false
      return
    }
    recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }
    recorder.onerror = () => {
      stream?.getTracks().forEach((track) => track.stop())
      recordFailure()
    }
    recorder.onstop = () => {
      stream?.getTracks().forEach((track) => track.stop())
      clearTimer()
      recording.value = false
      if (disposed) return
      const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })
      const url = URL.createObjectURL(blob)
      const extension = blob.type.includes('mp4')
        ? 'm4a'
        : blob.type.includes('ogg')
          ? 'ogg'
          : 'webm'
      acceptFile({
        name: `recitation-${Date.now()}.${extension}`,
        size: blob.size,
        path: url,
        duration: recordSeconds.value,
      })
    }
    recorder.start()
    onRecording()
  } catch {
    stream?.getTracks().forEach((track) => track.stop())
    recordFailure()
  }
  return
  // #endif
  // #ifdef MP-WEIXIN
  try {
    const manager = (nativeRecorder ?? uni.getRecorderManager()) as UniApp.RecorderManager
    if (!manager) throw new Error('unsupported')
    if (!nativeRecorder) {
      nativeRecorder = manager
      manager.onStart(onRecording)
      manager.onError(recordFailure)
      manager.onStop(onNativeStop)
    }
    manager.start({
      duration: 180000,
      format: 'mp3',
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
    })
  } catch {
    recordFailure()
  }
  // #endif
  // #ifndef H5
  // #ifndef MP-WEIXIN
  recordFailure()
  // #endif
  // #endif
}
function onNativeStop(result: NativeRecording) {
  clearTimer()
  recording.value = false
  requesting.value = false
  if (!disposed)
    acceptFile({
      name: `recitation-${Date.now()}.mp3`,
      size: result.fileSize,
      path: result.tempFilePath,
      duration: result.duration / 1000,
    })
}
function stopRecording() {
  clearTimer()
  // #ifdef H5
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  // #endif
  // #ifdef MP-WEIXIN
  nativeRecorder?.stop()
  // #endif
  recording.value = false
}
async function save() {
  if (busy.value) return
  if (isHttpMode && !remoteUser.value) {
    message.value = t('请先在个人中心登录。', 'Sign in through My account first.')
    return
  }
  if (!file.value || title.value.trim().length < 2 || !consent.value) {
    message.value = t(
      '请填写至少 2 字标题、选择音频，并确认保存约定。',
      'Enter a title of at least 2 characters, select audio and confirm the saving agreement.',
    )
    return
  }
  const epoch = currentSessionEpoch()
  busy.value = true
  try {
    if (isHttpMode) {
      message.value = t('正在上传并处理音频，请稍候…', 'Uploading and processing audio…')
      if (!uploadedFileId) {
        const uploaded = await uploadRemoteFile(file.value.path, file.value.name, 'recitation')
        uploadedFileId = uploaded.fileId
      }
      await saveRecitation(title.value, uploadedFileId)
      if (epoch !== currentSessionEpoch()) return
    } else
      saveLocalMedia(
        {
          kind: 'recitation',
          title: title.value.trim(),
          category: 'reading',
          fileName: file.value.name,
          size: file.value.size,
          duration: file.value.duration ?? 0,
        },
        file.value.path,
      )
    uploadedFileId = ''
    file.value = null
    title.value = ''
    consent.value = false
    message.value = isHttpMode
      ? t(
          '诵读已保存到当前账号，仅本人可读。主动投稿后才进入后台审核。',
          'Recording saved privately to your account. Submit it explicitly to request editorial review.',
        )
      : t(
          '诵读打卡已保存到本机，仅保存文件信息；未上传作品。',
          'Recitation check-in saved locally as file metadata. No work was uploaded.',
        )
  } catch (error) {
    if (epoch === currentSessionEpoch())
      message.value =
        error instanceof Error
          ? error.message
          : t(
              '保存失败，所选音频和文字已保留，请重试。',
              'Save failed. Your audio and title are preserved. Please retry.',
            )
  } finally {
    if (epoch === currentSessionEpoch()) busy.value = false
  }
}
function prepareLegacy(item: (typeof recitationRecords.value)[number]) {
  const path = localMediaPath(item.id)
  title.value = item.title
  uploadedFileId = ''
  file.value = path ? { name: item.fileName, size: item.size, path, duration: item.duration } : null
  consent.value = false
  message.value = path
    ? t(
        '已选取旧录音，核对账号并勾选约定后保存才会上传。',
        'Old recording selected. Check your account and confirm before saving to upload it.',
      )
    : t(
        '旧记录只有文件信息，请重新选择原音频。不会把空文件信息当作云端记录。',
        'Only metadata remains. Reselect the original audio before saving a cloud record.',
      )
}
function remove(id: string) {
  try {
    removeLocalMedia(id)
    if (playingKey.value === id) stopAudio()
    message.value = t('已删除本机记录。', 'Local record deleted.')
  } catch {
    message.value = t('删除失败，记录仍保留。', 'Deletion failed. The record is unchanged.')
  }
}
function leave() {
  disposed = true
  stopAudio()
  stopRecording()
  requesting.value = false
}
watch([selected, locale, tab, stories], () => stopAudio())
watch(remoteUser, () => {
  if (!isHttpMode) return
  leave()
  file.value = null
  uploadedFileId = ''
  title.value = ''
  consent.value = false
  busy.value = false
  message.value = ''
})
onHide(leave)
onBeforeUnmount(() => {
  leave()
  nativeRecorder?.offStart?.(onRecording)
  nativeRecorder?.offError?.(recordFailure)
  nativeRecorder?.offStop?.(onNativeStop)
})
</script>
<template>
  <view class="audio-workshop">
    <text class="audio-heading">{{ t('听家风 · 读家书', 'Listen and read together') }}</text>
    <view class="audio-actions">
      <wd-button
        size="small"
        :variant="tab === 'stories' ? 'base' : 'plain'"
        @click="tab = 'stories'"
      >
        {{ t('音频故事库', 'Audio stories') }}
      </wd-button>
      <wd-button
        size="small"
        :variant="tab === 'recite' ? 'base' : 'plain'"
        @click="tab = 'recite'"
      >
        {{ t('诵读与打卡', 'Recite and check in') }}
      </wd-button>
    </view>
    <view v-if="tab === 'stories'" class="audio-grid">
      <view class="audio-story-list">
        <button
          v-for="(item, index) in stories"
          :key="item.id"
          :class="['audio-story', { selected: selected === index }]"
          @click="selected = index"
        >
          <text>0{{ index + 1 }}</text>
          <text>{{ item.title[locale] }}</text>
        </button>
      </view>
      <view v-if="story" class="audio-sheet">
        <text class="audio-title">{{ story.title[locale] }}</text>
        <text class="audio-prose">{{ story.text[locale] }}</text>
        <view class="audio-actions">
          <wd-button size="small" @click="playStory">
            {{
              playingKey === story.id && playerState === 'playing'
                ? t('暂停', 'Pause')
                : playingKey === story.id && playerState === 'paused'
                  ? t('继续播放', 'Resume')
                  : t('播放故事', 'Play story')
            }}
          </wd-button>
          <wd-button size="small" variant="plain" :disabled="!playingKey" @click="stopAudio">
            {{ t('停止', 'Stop') }}
          </wd-button>
          <text>{{ clock(time) }} / {{ clock(duration) }}</text>
        </view>
        <text class="audio-note">
          {{
            isHttpMode
              ? t(
                  '音频故事与文字由后台按当前语言发布。',
                  'Audio stories and transcripts are published by editors in the selected language.',
                )
              : t(
                  '原创示例故事 · 离线合成语音，非真人录音或史实录音。切换语言可播放对应音源。',
                  'Original sample stories with offline synthetic speech, not human or historical recordings. Each language has its own audio.',
                )
          }}
        </text>
      </view>
      <text v-if="!stories.length" class="audio-note">
        {{
          t(
            '当前地区和语言暂无已发布的音频故事。',
            'No audio stories are published for this region and language.',
          )
        }}
      </text>
    </view>
    <view v-else class="audio-sheet">
      <text class="audio-title">{{ t('留下今天的诵读', 'Record today’s reading') }}</text>
      <text class="audio-note">
        {{
          isHttpMode
            ? t(
                '录音保存到当前账号，仅本人可读。可跨设备回放，每次保存独立计次。音频限 10MB / 3 分钟，服务器校验并转换为 MP3。',
                'Recordings are private to your account and playable across devices. Each save is one check-in. Audio is limited to 10MB / 3 minutes and checked and converted to MP3 on the server.',
              )
            : t(
                '可读上方故事或自己的家书。文件不上传；刷新后保留打卡信息，试听需要重新选取文件。文件限 10MB，录音最长 3 分钟。',
                'Read a story or your own letter. Files stay local. After refresh, check-in metadata remains; select the file again to listen. Files: up to 10MB. Recording: up to 3 minutes.',
              )
        }}
      </text>
      <text class="audio-label">{{ t('诵读标题', 'Reading title') }}</text>
      <input
        v-model="title"
        :disabled="busy"
        @blur="title = readInputValue($event, title)"
        :maxlength="60"
        class="audio-input"
        :placeholder="t('例如：给家人的一封信', 'For example: A letter to my family')"
      />
      <view class="audio-actions">
        <wd-button size="small" :disabled="busy || requesting || recording" @click="startRecording">
          {{
            requesting
              ? t('等待麦克风许可…', 'Waiting for microphone…')
              : t('开始录音', 'Start recording')
          }}
        </wd-button>
        <wd-button v-if="recording" size="small" variant="plain" @click="stopRecording">
          {{ t('结束录音', 'Finish recording') }} {{ clock(recordSeconds) }}
        </wd-button>
        <wd-button
          size="small"
          variant="plain"
          :disabled="busy || recording || requesting"
          @click="chooseAudio"
        >
          {{ t('选取音频文件', 'Choose audio file') }}
        </wd-button>
      </view>
      <view v-if="file" class="audio-file">
        <text>{{ file.name }} · {{ Math.ceil(file.size / 1024) }} KB</text>
        <wd-button size="small" variant="plain" @click="play(file.path, 'preview')">
          {{
            playingKey === 'preview' && playerState === 'playing'
              ? t('暂停试听', 'Pause preview')
              : t('试听', 'Preview audio')
          }}
        </wd-button>
      </view>
      <checkbox-group @change="consent = !consent">
        <label class="audio-agreement">
          <checkbox :checked="consent" color="#C41A1A" />
          {{
            isHttpMode
              ? t(
                  '这是我有权使用的音频，同意保存到当前账号的私人记录中。',
                  'I may use this audio and agree to save it privately in my current account.',
                )
              : t(
                  '这是我有权使用的音频，仅保存本机演示记录。',
                  'I may use this audio and agree to save a local demo record only.',
                )
          }}
        </label>
      </checkbox-group>
      <wd-button
        size="small"
        :disabled="busy || recording || requesting || !file || (isHttpMode && !remoteUser)"
        @click="save"
      >
        {{ busy ? t('上传处理中…', 'Uploading…') : t('保存诵读打卡', 'Save recitation check-in') }}
      </wd-button>
      <CloudRecitationRecords v-if="isHttpMode" />
      <wd-button
        v-if="isHttpMode && recitationRecords.length"
        size="small"
        variant="plain"
        @click="showLegacy = !showLegacy"
      >
        {{ t('查看旧设备记录（未归入账号）', 'Old device records (not linked to your account)') }}
      </wd-button>
      <template v-if="!isHttpMode || showLegacy">
        <text class="audio-title audio-record-heading">
          {{ t('我的诵读记录', 'My recitation records') }} · {{ recitationRecords.length }}
        </text>
        <view v-for="item in recitationRecords" :key="item.id" class="audio-record">
          <text class="audio-title">{{ item.title }}</text>
          <text class="audio-note">
            {{ item.fileName }} · {{ item.createdAt.slice(0, 10) }} ·
            {{ Math.ceil(item.size / 1024) }} KB
          </text>
          <text v-if="!localMediaPath(item.id)" class="audio-note">
            {{
              t(
                '文件需重新选择；打卡信息仍在本机。',
                'Select the original file again to listen. Check-in metadata remains.',
              )
            }}
          </text>
          <view class="audio-actions">
            <wd-button
              v-if="isHttpMode"
              size="small"
              variant="plain"
              :disabled="busy || !remoteUser"
              @click="prepareLegacy(item)"
            >
              {{ t('选取后另存到当前账号', 'Select to save to current account') }}
            </wd-button>
            <wd-button
              v-if="localMediaPath(item.id)"
              size="small"
              variant="plain"
              @click="play(localMediaPath(item.id), item.id)"
            >
              {{ t('试听记录', 'Play recording') }}
            </wd-button>
            <wd-button size="small" variant="plain" @click="remove(item.id)">
              {{ t('删除记录', 'Delete record') }}
            </wd-button>
          </view>
        </view>
        <text v-if="!recitationRecords.length" class="audio-note">
          {{
            t(
              '还没有诵读记录。选择音频并保存第一条打卡。',
              'No recitations yet. Select audio and save your first check-in.',
            )
          }}
        </text>
      </template>
    </view>
    <text v-if="playerState === 'loading'" class="audio-note">
      {{ t('正在加载真实音频…', 'Loading audio…') }}
    </text>
    <text v-if="message" class="audio-message" role="status">{{ message }}</text>
    <text v-if="localMediaError" class="audio-message">
      {{
        t(
          '本机记录无法读取，现有数据不会被覆盖。',
          'Local records could not be read. Existing data will not be overwritten.',
        )
      }}
    </text>
  </view>
</template>
<style scoped>
.audio-workshop {
  margin: 28px 0;
  padding: 24px;
  border: 1px solid #c9a96e;
  background: #fffaf1;
  color: #2c2c2c;
  min-width: 0;
}
.audio-heading {
  display: block;
  font-family: 'JiafengSerif', serif;
  font-size: 25px;
  font-weight: 600;
  margin-bottom: 18px;
}
.audio-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.audio-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 22px;
}
.audio-sheet {
  min-width: 0;
  padding: 20px;
  background: #f5f0e8;
}
.audio-title {
  display: block;
  font-size: 18px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.audio-prose {
  display: block;
  line-height: 1.9;
  margin: 18px 0;
}
.audio-note {
  display: block;
  line-height: 1.7;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.audio-story {
  display: flex;
  width: 100%;
  gap: 14px;
  padding: 18px 12px;
  background: transparent;
  border-bottom: 1px solid #c9a96e;
  border-radius: 0;
  text-align: left;
  font-size: 16px;
  line-height: 1.6;
}
.audio-story::after {
  border: 0;
}
.audio-story.selected {
  color: #c41a1a;
  background: #f5f0e8;
}
.audio-label {
  display: block;
  margin: 18px 0 8px;
}
.audio-input {
  height: 44px;
  border: 1px solid #c9a96e;
  background: #fffaf1;
  padding: 0 12px;
  font-size: 16px;
}
.audio-file {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin: 15px 0;
  overflow-wrap: anywhere;
}
.audio-agreement {
  display: flex;
  gap: 10px;
  align-items: center;
  line-height: 1.7;
  font-size: 14px;
  margin: 18px 0;
}
.audio-record-heading {
  margin-top: 30px;
}
.audio-record {
  border-top: 1px solid #c9a96e;
  padding-top: 16px;
  margin-top: 16px;
}
.audio-message {
  display: block;
  padding: 14px;
  margin-top: 16px;
  border-left: 3px solid #c41a1a;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
@media (max-width: 650px) {
  .audio-grid {
    grid-template-columns: 1fr;
  }
  .audio-workshop {
    padding: 16px;
  }
  .audio-sheet {
    padding: 14px;
  }
  .audio-heading {
    font-size: 22px;
  }
}
</style>
