<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { t, locale } from '../composables/useLocale'
import { readInputValue } from '../composables/readInputValue'
import { remoteUser, uploadRemoteFile } from '../services/api'
import { recitationUrl } from '../services/cloudRecords'
import {
  createAiOperation,
  getAiStatus,
  listAiTasks,
  readAiTask,
  resumeAiTask,
  runAiTask,
  type AiOperation,
} from '../services/ai'
import { validateManuscript, type AiTask, type AiStatus } from '../domain/aiTasks'
import type { ConversationReply } from '../domain/localConversation'

const emit = defineEmits<{ use: [reply: ConversationReply] }>()
const file = ref<{ name: string; size: number; path: string; fileId?: string } | null>(null)
const status = ref<AiStatus | null>(null)
const busy = ref(false)
const progress = ref('')
const error = ref('')
const result = ref('')
const sourceUrl = ref('')
const task = ref<AiTask | null>(null)
const history = ref<AiTask[]>([])
const historyOpen = ref(false)
const historyBusy = ref(false)
let operation: AiOperation | undefined
let historyOperation: AiOperation | undefined
let previewOperation: AiOperation | undefined
let selectionGeneration = 0
async function loadStatus() {
  try {
    status.value = await getAiStatus()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法读取 AI 服务状态'
  }
}
void loadStatus()
function releasePreview() {
  // #ifdef H5
  if (file.value?.path.startsWith('blob:')) URL.revokeObjectURL(file.value.path)
  // #endif
  sourceUrl.value = ''
}
function acceptFile(next: { name: string; size: number; path: string }) {
  try {
    validateManuscript(next.name, next.size)
    if (!next.path)
      throw new Error(t('无法读取文件，请重新选择。', 'File cannot be read. Select again.'))
    releasePreview()
    file.value = next
    sourceUrl.value = next.name.toLowerCase().endsWith('.pdf') ? '' : next.path
    result.value = ''
    task.value = null
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '文件不可用'
  }
}
function chooseFile(kind: 'image' | 'pdf') {
  if (busy.value) return
  const generation = ++selectionGeneration
  const account = remoteUser.value?.id
  const active = () => selectionGeneration === generation && remoteUser.value?.id === account
  const failed = (e: { errMsg?: string }) => {
    if (active() && !e.errMsg?.includes('cancel'))
      error.value = t('选择失败，请重试。', 'Selection failed. Try again.')
  }
  if (kind === 'image') {
    uni.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success(value) {
        if (!active()) return
        const item = (Array.isArray(value.tempFiles)
          ? value.tempFiles[0]
          : undefined) as unknown as
          | { name?: string; size: number; path: string; type?: string }
          | undefined
        if (item) {
          const extension = item.type === 'image/png' || /\.png$/i.test(item.path) ? '.png' : '.jpg'
          acceptFile({ ...item, name: item.name || '手稿图片' + extension })
        }
      },
      fail: failed,
    })
    return
  }
  // #ifdef H5
  uni.chooseFile({
    count: 1,
    type: 'all',
    extension: ['.pdf'],
    success(value) {
      if (!active()) return
      const item = (Array.isArray(value.tempFiles) ? value.tempFiles[0] : undefined) as unknown as
        | { name: string; size: number; path: string }
        | undefined
      if (item) acceptFile(item)
    },
    fail: failed,
  })
  // #endif
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['pdf'],
    success(value) {
      if (active() && value.tempFiles[0]) acceptFile(value.tempFiles[0])
    },
    fail: failed,
  })
  // #endif
}
async function recognize() {
  if (busy.value || !file.value) return
  if (!remoteUser.value) {
    error.value = t('请先登录，再上传手稿。', 'Sign in before uploading a manuscript.')
    return
  }
  const chosen = file.value
  operation?.cancel()
  const job = createAiOperation()
  operation = job
  busy.value = true
  error.value = ''
  progress.value = t('上传手稿…', 'Uploading manuscript…')
  try {
    if (!chosen.fileId) {
      const uploaded = await uploadRemoteFile(chosen.path, chosen.name, 'manuscript')
      if (!job.active()) return
      chosen.fileId = uploaded.fileId
    }
    const completed = await runAiTask(
      {
        mode: 'ocr',
        prompt: t(
          '逐行识别手稿，保留原有段落，无法辨认的字标记待校。',
          'Transcribe the manuscript line by line, preserving paragraphs and marking uncertain characters.',
        ),
        fileId: chosen.fileId,
        language: locale.value,
      },
      job,
      (value) => {
        progress.value =
          value.status === 'queued' ? t('任务排队中…', 'Queued…') : t('正在识别…', 'Recognizing…')
      },
    )
    if (!job.active()) return
    task.value = completed
    result.value = completed.result || ''
  } catch (e) {
    if (job.active())
      error.value =
        e instanceof Error
          ? e.message
          : t(
              '识别失败，文件已保留，可重试。',
              'Recognition failed. The file is retained for retry.',
            )
  } finally {
    if (job.active()) {
      busy.value = false
      progress.value = ''
    }
  }
}
function stop() {
  operation?.cancel()
  busy.value = false
  progress.value = ''
  error.value = t(
    '已停止等待；手稿保留，任务可从本人历史继续查看。',
    'Stopped waiting. Your manuscript remains; resume from history.',
  )
}
async function refreshHistory() {
  if (!remoteUser.value) {
    error.value = t('请先登录查看本人历史。', 'Sign in to see your history.')
    return
  }
  historyOpen.value = true
  historyOperation?.cancel()
  const job = createAiOperation()
  historyOperation = job
  historyBusy.value = true
  error.value = ''
  try {
    history.value = (await listAiTasks(job)).filter((value) => value.mode === 'ocr')
  } catch (e) {
    if (job.active()) error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    if (job.active()) historyBusy.value = false
  }
}
async function restore(value: AiTask) {
  if (busy.value) return
  operation?.cancel()
  const job = createAiOperation()
  operation = job
  busy.value = true
  error.value = ''
  try {
    const completed = await resumeAiTask(await readAiTask(value.id, job), job, (value) => {
      progress.value = value.status
    })
    if (!job.active()) return
    releasePreview()
    file.value = completed.fileId
      ? { name: t('历史手稿', 'Saved manuscript'), size: 0, path: '', fileId: completed.fileId }
      : null
    task.value = completed
    result.value = completed.result || ''
    historyOpen.value = false
  } catch (e) {
    if (job.active()) error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    if (job.active()) {
      busy.value = false
      progress.value = ''
    }
  }
}
async function previewOriginal() {
  if (!file.value?.fileId) return
  previewOperation?.cancel()
  const job = createAiOperation()
  previewOperation = job
  try {
    const url = await recitationUrl(file.value.fileId)
    if (!job.active()) return
    // H5 opens either the original image or PDF with a newly authorized URL.
    // #ifdef H5
    window.open(url, '_blank', 'noopener,noreferrer')
    // #endif
    // #ifndef H5
    uni.downloadFile({
      url,
      success(value) {
        if (!job.active()) return
        if (value.statusCode !== 200) {
          error.value = t('链接已失效，请重新打开。', 'The link expired. Open it again.')
          return
        }
        if (
          /\.pdf(?:[?#]|$)/i.test(url) ||
          /\.pdf$/i.test(file.value?.name || '') ||
          (file.value?.name === t('历史手稿', 'Saved manuscript') &&
            !/\.(png|jpe?g)(?:[?#]|$)/i.test(url))
        )
          uni.openDocument({
            filePath: value.tempFilePath,
            showMenu: true,
            fail: () => {
              error.value = t('无法打开文档，请重试。', 'Unable to open document. Retry.')
            },
          })
        else uni.previewImage({ urls: [value.tempFilePath] })
      },
      fail: () => {
        if (job.active())
          error.value = t('原件下载失败，请重试。', 'Original download failed. Retry.')
      },
    })
    // #endif
  } catch (e) {
    if (job.active()) error.value = e instanceof Error ? e.message : '原件暂不可用'
  }
}
function useResult() {
  // #ifdef H5
  const control = document.getElementById('ocr-proofread-text')?.querySelector('textarea')
  if (control) result.value = control.value
  // #endif
  if (!result.value.trim() || !task.value) return
  emit('use', {
    mode: 'ocr',
    source: 'model',
    language: locale.value,
    prompt: file.value?.name || t('手稿识别', 'Manuscript OCR'),
    text: result.value,
    content: result.value,
    context: {},
    taskId: task.value.id,
    model: task.value.model,
  })
}
function cleanup() {
  selectionGeneration++
  operation?.cancel()
  historyOperation?.cancel()
  previewOperation?.cancel()
  releasePreview()
}
watch(
  () => remoteUser.value?.id,
  () => {
    cleanup()
    file.value = null
    result.value = ''
    task.value = null
    history.value = []
    historyOpen.value = false
    busy.value = false
    historyBusy.value = false
    error.value = ''
    progress.value = ''
  },
)
onBeforeUnmount(cleanup)
</script>
<template>
  <view class="ocr-workbench">
    <text class="section-title">
      {{ t('手稿识别与人工校对', 'Manuscript recognition and proofreading') }}
    </text>
    <text class="ocr-note">
      {{
        t(
          '支持 JPG、PNG、PDF，单个不超过 10 MiB。识别结果须由你校对确认后采用；不会自动替换投稿草稿。',
          'JPG, PNG or PDF, up to 10 MiB. Proofread and confirm the result before using it; your contribution draft is not replaced automatically.',
        )
      }}
    </text>
    <text v-if="status?.external" class="ocr-note">
      {{
        t(
          '开发 API 模式：手稿将发送到配置的外部识别模型。',
          'Development API: manuscripts are sent to the configured external recognition model.',
        )
      }}
    </text>
    <text v-if="status && !status.ocrEnabled" class="field-error">
      {{ t('OCR 服务未启用。', 'OCR is unavailable.') }}
    </text>
    <wd-button v-if="status && !status.ocrEnabled" size="small" variant="text" @click="loadStatus">
      {{ t('重新检查服务', 'Check again') }}
    </wd-button>
    <view class="ocr-actions">
      <wd-button size="small" variant="plain" :disabled="busy" @click="chooseFile('image')">
        {{ t('选择图片 / 拍照', 'Choose image / camera') }}
      </wd-button>
      <wd-button size="small" variant="plain" :disabled="busy" @click="chooseFile('pdf')">
        {{ t('选择 PDF', 'Choose PDF') }}
      </wd-button>
      <wd-button size="small" variant="text" @click="refreshHistory">
        {{ t('本人识别历史', 'My OCR history') }}
      </wd-button>
    </view>
    <view v-if="historyOpen" class="ocr-history">
      <text v-if="historyBusy">{{ t('加载中…', 'Loading…') }}</text>
      <text v-else-if="!history.length">{{ t('暂无识别记录', 'No recognition records') }}</text>
      <button
        v-for="item in history"
        :key="item.id"
        class="ocr-history-item"
        :disabled="busy"
        @click="restore(item)"
      >
        {{ item.createdAt }} ·
        {{
          item.status === 'succeeded'
            ? t('已完成', 'Completed')
            : item.status === 'failed'
              ? t('失败', 'Failed')
              : t('处理中', 'Processing')
        }}
      </button>
    </view>
    <view v-if="file" class="ocr-file">
      <text>
        {{ file.name }}
        <text v-if="file.size">· {{ (file.size / 1024).toFixed(0) }} KiB</text>
      </text>
      <image
        v-if="sourceUrl"
        class="ocr-original"
        :src="sourceUrl"
        mode="widthFix"
        @error="sourceUrl = ''"
      />
      <view class="ocr-actions">
        <wd-button
          v-if="file.path"
          size="small"
          :loading="busy"
          :disabled="busy || (status !== null && !status.ocrEnabled)"
          @click="recognize"
        >
          {{ t('上传并识别', 'Upload and recognize') }}
        </wd-button>
        <wd-button v-if="file.fileId" size="small" variant="plain" @click="previewOriginal">
          {{ t('打开原件（刷新链接）', 'Open original (fresh link)') }}
        </wd-button>
        <wd-button v-if="busy" size="small" variant="text" @click="stop">
          {{ t('停止等待', 'Stop waiting') }}
        </wd-button>
      </view>
    </view>
    <text v-if="progress" class="ocr-note" aria-live="polite">{{ progress }}</text>
    <text v-if="error" class="field-error" role="alert">{{ error }}</text>
    <view v-if="task" class="ocr-proofread">
      <text class="field-label">
        {{
          t(
            '识别稿：请对照原件修改不确定的文字',
            'Recognition result: correct uncertain text against the original',
          )
        }}
      </text>
      <textarea
        id="ocr-proofread-text"
        class="ocr-result"
        :value="result"
        :maxlength="10000"
        @input="result = readInputValue($event, result)"
        @blur="result = readInputValue($event, result)"
      />
      <wd-button :disabled="busy || !result.trim()" @click="useResult">
        {{ t('确认采用校对稿，进入编辑区', 'Use proofread text in the editor') }}
      </wd-button>
    </view>
  </view>
</template>
<style scoped>
.ocr-workbench {
  padding: 24px;
  border: 1px solid var(--jf-border);
  background: var(--jf-surface);
  min-width: 0;
}
.ocr-note {
  display: block;
  margin: 12px 0;
  font-size: 13px;
  color: var(--jf-muted);
  line-height: 1.9;
}
.ocr-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.ocr-file {
  padding: 14px;
  background: var(--jf-paper);
  overflow-wrap: anywhere;
}
.ocr-original {
  display: block;
  max-width: 100%;
  width: 420px;
  margin-top: 14px;
}
.ocr-result {
  box-sizing: border-box;
  width: 100%;
  min-height: 290px;
  height: 360px;
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--jf-border);
  font-size: 15px;
  line-height: 1.9;
}
.ocr-proofread {
  margin-top: 20px;
}
.ocr-history-item {
  font-size: 12px;
  line-height: 1.8;
  margin: 8px 0;
  text-align: left;
}
@media (max-width: 480px) {
  .ocr-workbench {
    padding: 16px;
  }
}
</style>
