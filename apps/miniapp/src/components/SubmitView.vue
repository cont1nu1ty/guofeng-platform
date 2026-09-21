<script setup lang="ts">
import { readInputValue } from '../composables/readInputValue'
import { computed, reactive, ref, watch } from 'vue'
import WritingEditor from './WritingEditor.vue'
import WritingInspiration from './WritingInspiration.vue'
import SubmissionSupport from './SubmissionSupport.vue'
import {
  cleanWritingDelta,
  writingHtml,
  checkPoem,
  type WritingDelta,
} from '../domain/writingTools'
import SectionHeading from './SectionHeading.vue'
import { regionTranslations } from '../domain/regionCatalog'
import { genres, channels, regions, themes } from '../domain/fixtures'
import type { AttachmentMeta, SubmissionDraft, ThemeId, ValidationErrors } from '../domain/types'
import { repo, region, safely, notify, revision, storageUnavailable } from '../composables/useDemo'
import { navigate, useRouteParams } from '../composables/useNavigation'
import { t } from '../composables/useLocale'
import {
  attachmentPreviewPath,
  attachmentSize,
  MAX_ATTACHMENT_COUNT,
  useSubmissionAttachments,
} from '../composables/useSubmissionAttachments'

const params = useRouteParams()
const blank = (): SubmissionDraft => ({
  title: '',
  content: '',
  genre: 'letter',
  channel: 'community',
  region: region.value === 'all' ? 'beijing' : region.value,
  author: '',
  copyrightAccepted: false,
  themes: [],
  attachments: [],
})
const hydrate = (draft: SubmissionDraft): SubmissionDraft => ({
  ...blank(),
  ...draft,
  themes: draft.themes ?? (draft.theme ? [draft.theme] : []),
  attachments: draft.attachments ?? [],
})
const initialDraft = repo.getDraft()
const form = reactive<SubmissionDraft>(hydrate(initialDraft ?? blank()))
const errors = ref<ValidationErrors>({})
const draftState = ref<'restored' | 'ready' | 'saved' | 'error' | 'new'>(
  initialDraft ? 'restored' : 'ready',
)
const draftMessage = computed(
  () =>
    ({
      restored: t('已恢复本机草稿', 'Local draft restored'),
      ready: t('填写后自动保存到本机', 'Your draft is saved on this device'),
      saved: t('已自动保存到本机', 'Automatically saved on this device'),
      error: t('保存失败，请检查设备存储空间', 'Save failed. Check device storage.'),
      new: t('新投稿可重新填写', 'You can start another submission'),
    })[draftState.value],
)
const submittedId = ref('')
const submittedRevision = ref(1)
const showAgreement = ref(false)
const showPreview = ref(false)
const showAttachmentPreview = ref(false)
const previewAttachment = ref<AttachmentMeta | null>(null)
const submitting = ref(false)
const revisionLoadError = ref(false)
const editorKey = ref(0)
const showInspiration = ref(false)
const poemCheck = ref<ReturnType<typeof checkPoem> | null>(null)
const poemSource = ref('')
const previewHtml = computed(() => writingHtml(form.contentDelta, form.content))
function richChange(value: { content: string; contentDelta: WritingDelta }) {
  pauseSave = true
  form.content = value.content
  form.contentDelta = value.contentDelta
  pauseSave = false
  try {
    repo.saveDraft({ ...form })
    draftState.value = 'saved'
  } catch {
    draftState.value = 'error'
  }
}
function appendInspiration(value: string) {
  const next = form.content + (form.content.trim() ? '\n\n' : '') + value
  if ([...next].length > 10000) {
    notify(
      t(
        '追加后超过10000字，请复制所需段落。',
        'This would exceed 10,000 characters. Copy only the passage you need.',
      ),
    )
    return
  }
  const delta = cleanWritingDelta(form.contentDelta, form.content)
  delta.ops.push({ insert: (form.content.trim() ? '\n' : '') + value + '\n' })
  richChange({
    content: delta.ops
      .map((op) => op.insert)
      .join('')
      .replace(/\n$/, ''),
    contentDelta: delta,
  })
  editorKey.value++
  notify(t('已追加到正文末尾，原稿保留。', 'Appended at the end. Your original text is retained.'))
}
function runPoemCheck() {
  poemSource.value = form.content
  poemCheck.value = checkPoem(form.content)
}
const { picking, attachmentErrors, selectAttachments, removeAttachment, markPreviewUnavailable } =
  useSubmissionAttachments()
const selectedThemes = computed(() => form.themes ?? [])
const attachments = computed(() => form.attachments ?? [])
const bodyLength = computed(() => [...form.content].length)
const editingWork = computed(() => {
  revision.value
  return form.editingWorkId ? repo.getWork(form.editingWorkId) : undefined
})
const latestReturn = computed(() =>
  [...(editingWork.value?.reviews ?? [])].reverse().find((item) => item.action === 'return'),
)
const regionOptions = computed(() =>
  regions.slice(1).map((item) => ({ ...item, label: label(item.label) })),
)
const dictionaries: Record<string, string> = {
  党政干部: 'Public-service households',
  校园青少年: 'Students and young people',
  城乡群众: 'Community members',
  特色群体: 'Special-interest groups',
  家风家书: 'Family letters',
  家风纪实散文: 'Family essays',
  家风诗词楹联: 'Poems and couplets',
  红色家风回忆录: 'Red heritage memoirs',
  乡贤家族传记: 'Family biographies',
  家训手记: 'Family principles',
  最美家庭手记: 'Family journals',
  家风文论: 'Family-values commentary',
  清廉家书: 'Integrity',
  清廉家风: 'Integrity',
  孝老爱亲: 'Care for elders and family',
  邻里互助: 'Helping neighbours',
  爱国奉献: 'Public responsibility',
  先贤文脉: 'Classical heritage',
  家族传记: 'Family history',
  北京: 'Beijing',
  浙江: 'Zhejiang',
  四川: 'Sichuan',
  全国: 'National',
}
function label(value: string) {
  return t(value, regionTranslations[value] ?? dictionaries[value] ?? value)
}
function optionLabel(options: { id: string; label: string }[], id: string) {
  return label(options.find((item) => item.id === id)?.label ?? id)
}
function errorText(value?: string) {
  if (!value) return ''
  const english: Record<string, string> = {
    '标题需为 2–50 个字。': 'Enter a title of 2–50 characters.',
    '正文最多填写 10000 个字。': 'Keep the body within 10,000 characters.',
    '正文格式与文字不一致，请重新确认正文。':
      'The formatted and plain text differ. Review the body again.',
    '请填写不超过100字的海外国家与城市。': 'Enter your country and city in at most 100 characters.',
    '正文至少填写 20 个字。': 'Write at least 20 characters.',
    '请阅读并同意演示版权声明。': 'Read and accept the sample copyright notice.',
    '请选择有效的投稿体裁。': 'Choose a valid genre.',
    '请选择有效的投稿通道。': 'Choose a valid submission channel.',
    '请选择有效的所属地区。': 'Choose a valid region.',
  }
  return t(
    value,
    english[value] ??
      (value.includes('主题')
        ? 'Choose up to 3 valid themes.'
        : value.includes('附件')
          ? 'Check attachment types, size and count.'
          : 'Please check this field and try again.'),
  )
}
let pauseSave = false
watch(
  form,
  () => {
    if (pauseSave || revisionLoadError.value) return
    const currentErrors = repo.validateSubmission({ ...form })
    for (const field of Object.keys(errors.value) as (keyof SubmissionDraft)[]) {
      if (!currentErrors[field]) delete errors.value[field]
    }
    try {
      repo.saveDraft({
        ...form,
        themes: [...selectedThemes.value],
        attachments: [...attachments.value],
      })
      draftState.value = 'saved'
    } catch {
      draftState.value = 'error'
    }
  },
  { deep: true, flush: 'sync' },
)
watch(
  () => params.value.id,
  (id) => {
    if (!id) return
    const work = repo.getWork(id)
    if (!work?.isMine || work.status !== 'returned') {
      revisionLoadError.value = true
      return
    }
    try {
      pauseSave = true
      const saved = repo.getDraft()
      const draft = saved?.editingWorkId === id ? saved : repo.prepareRevision(id)
      Object.assign(form, hydrate(draft))
      revisionLoadError.value = false
      draftState.value = 'restored'
    } catch {
      revisionLoadError.value = true
    } finally {
      pauseSave = false
    }
  },
  { immediate: true },
)
function chooseRegion(event: { detail: { value: string | number } }) {
  const choice = regions[Number(event.detail.value) + 1]
  if (choice) form.region = choice.id
}
function toggleTheme(id: ThemeId) {
  if (selectedThemes.value.includes(id))
    form.themes = selectedThemes.value.filter((item) => item !== id)
  else if (selectedThemes.value.length < 3) form.themes = [...selectedThemes.value, id]
  else notify(t('最多选择 3 个主题', 'Choose up to 3 themes'))
  errors.value.themes = undefined
}
async function addAttachments(mode: 'image' | 'document', replaceId?: string) {
  const result = await selectAttachments(mode, attachments.value, replaceId)
  if (result) {
    form.attachments = result
    errors.value.attachments = undefined
  }
}
function removeFile(id: string) {
  form.attachments = removeAttachment(id, attachments.value)
  errors.value.attachments = undefined
}
function previewFile(file: AttachmentMeta) {
  previewAttachment.value = file
  showAttachmentPreview.value = true
}
function fileLabel(file: AttachmentMeta) {
  return file.type === 'image' ? t('图片', 'Image') : file.type === 'pdf' ? 'PDF' : 'Word'
}
function fileIcon(file: AttachmentMeta) {
  return file.type === 'image' ? 'file-image' : file.type === 'pdf' ? 'file-pdf' : 'file'
}
function validate(requireAgreement: boolean) {
  const next = repo.validateSubmission({ ...form })
  if (!requireAgreement) delete next.copyrightAccepted
  errors.value = next
  if (Object.keys(next).length) {
    notify(t('请完善标红的必填信息', 'Please complete the highlighted fields'))
    return false
  }
  return true
}
function preview(requireAgreement = false) {
  if (!revisionLoadError.value && validate(requireAgreement)) showPreview.value = true
}
function submit() {
  if (submitting.value || submittedId.value || revisionLoadError.value || !validate(true)) return
  submitting.value = true
  const result = safely(() =>
    repo.submitWork({
      ...form,
      themes: [...selectedThemes.value],
      attachments: [...attachments.value],
    }),
  )
  if (result) {
    pauseSave = true
    submittedId.value = result.id
    submittedRevision.value = result.revisionNumber ?? 1
    showPreview.value = false
    Object.assign(form, blank(), {
      editingWorkId: undefined,
      theme: undefined,
      contentDelta: undefined,
      overseasLocation: undefined,
    })
    pauseSave = false
    draftState.value = 'new'
  }
  submitting.value = false
}
function openAgreementFromPreview() {
  showPreview.value = false
  showAgreement.value = true
}
function continueWriting() {
  submittedId.value = ''
  navigate('submit')
}
</script>
<template>
  <view class="submission-view">
    <SectionHeading
      :title="t('把家的故事，写给时代', 'Share a family story with the world')"
      :eyebrow="t('家风投稿', 'Contribute your story')"
      :subtitle="
        t(
          '每一种平凡的坚守，都值得被记住。',
          'Every act of care and commitment deserves to be remembered.',
        )
      "
    />
    <view v-if="revisionLoadError" class="submit-revision-error">
      <wd-icon name="info-circle" />
      <text>
        {{
          t(
            '此作品当前不能修改重投，或本机草稿未能读取。只有本机本人名下、状态为“退回修改”的稿件可以重投。',
            'This work cannot currently be revised, or the local draft could not be read. Only your own locally stored works returned for revision can be resubmitted.',
          )
        }}
      </text>
      <wd-button variant="plain" @click="navigate('profile')">
        {{ t('查看我的投稿', 'View my submissions') }}
      </wd-button>
    </view>
    <view v-else-if="submittedId" class="success-panel">
      <view class="success-mark">✓</view>
      <text class="section-title">
        {{
          submittedRevision > 1
            ? t('修改稿已提交，作品编号保持不变', 'Revision submitted with the same work ID')
            : t('作品已提交到本机演示库', 'Your work is saved in the local demo')
        }}
      </text>
      <text class="muted">{{ t('作品编号：', 'Work ID: ') }}{{ submittedId }}</text>
      <text>
        {{
          t(
            '当前状态：待区县初审。此操作不向真实平台投稿。',
            'Status: awaiting initial review in the demo. Nothing is submitted to a real platform.',
          )
        }}
      </text>
      <text class="submit-helper">
        {{
          t(
            '可到评审页查看进度；演示运营端评审后，消息与证书会随状态更新。',
            'View progress on the review page. Demo review actions update messages and certificates.',
          )
        }}
      </text>
      <view class="button-row">
        <wd-button @click="navigate('review', { id: submittedId })">
          {{ t('查看投稿进度', 'View submission progress') }}
        </wd-button>
        <wd-button variant="plain" @click="navigate('profile')">
          {{ t('查看我的投稿', 'My submissions') }}
        </wd-button>
        <wd-button variant="text" @click="continueWriting">
          {{ t('继续创作', 'Write another story') }}
        </wd-button>
      </view>
    </view>
    <view v-else class="form-layout">
      <view class="form-card">
        <view v-if="form.editingWorkId" class="submit-revision-banner">
          <text class="submit-panel-title">
            {{ t('退回修改 · 保留原作品编号', 'Revision requested · keep the original work ID') }}
          </text>
          <text>
            {{ form.editingWorkId }} · {{ t('本次为第', 'Revision ') }}
            {{ (editingWork?.revisionNumber ?? 1) + 1 }} {{ t('版', '') }}
          </text>
          <text v-if="latestReturn">
            {{ t('最近评语：', 'Latest feedback: ') }}{{ latestReturn.comment }}
          </text>
          <wd-button
            variant="text"
            size="small"
            @click="navigate('review', { id: form.editingWorkId })"
          >
            {{ t('查看完整评审意见', 'View all review feedback') }}
          </wd-button>
        </view>
        <view class="form-step">
          <text class="step-badge">01</text>
          <text>{{ t('选择投稿方向', 'Choose your submission details') }}</text>
        </view>
        <text class="field-label">{{ t('投稿通道', 'Submission channel') }}</text>
        <view class="channel-grid">
          <button
            v-for="item in channels"
            :key="item.id"
            :class="['choice-card', { active: form.channel === item.id }]"
            @click="form.channel = item.id"
          >
            {{ label(item.label) }}
          </button>
        </view>
        <text v-if="errors.channel" class="field-error">{{ errorText(errors.channel) }}</text>
        <text class="field-label">{{ t('作品体裁', 'Genre') }}</text>
        <view class="choice-grid">
          <button
            v-for="item in genres"
            :key="item.id"
            :class="['choice-chip', { active: form.genre === item.id }]"
            @click="form.genre = item.id"
          >
            {{ label(item.label) }}
          </button>
        </view>
        <text v-if="errors.genre" class="field-error">{{ errorText(errors.genre) }}</text>
        <view class="submit-field-heading">
          <text class="field-label">{{ t('作品主题（可多选）', 'Themes (multiple choice)') }}</text>
          <text class="submit-helper">{{ selectedThemes.length }} / 3</text>
        </view>
        <view class="choice-grid submit-theme-grid">
          <button
            v-for="item in themes"
            :key="item.id"
            :class="['choice-chip', { active: selectedThemes.includes(item.id) }]"
            @click="toggleTheme(item.id)"
          >
            <text v-if="selectedThemes.includes(item.id)">✓</text>
            {{ label(item.label) }}
          </button>
        </view>
        <text class="submit-helper">
          {{
            t(
              '可选 1–3 个贴近内容的主题，也可暂不选择。',
              'Optionally choose up to 3 themes that match your story.',
            )
          }}
        </text>
        <text v-if="errors.themes" class="field-error">{{ errorText(errors.themes) }}</text>
        <view class="two-fields">
          <view>
            <text class="field-label">{{ t('所属地区', 'Region') }}</text>
            <picker :range="regionOptions" range-key="label" @change="chooseRegion">
              <view class="form-input picker-value">
                {{ optionLabel(regions, form.region) }}
                <text>⌄</text>
              </view>
            </picker>
            <text v-if="errors.region" class="field-error">{{ errorText(errors.region) }}</text>
          </view>
          <view>
            <text class="field-label">{{ t('作者署名（可选）', 'Author name (optional)') }}</text>
            <input
              @blur="form.author = readInputValue($event, form.author)"
              @confirm="form.author = readInputValue($event, form.author)"
              v-model="form.author"
              class="form-input"
              :placeholder="t('仅填写演示署名', 'Use a fictional demo name')"
              maxlength="20"
              :aria-label="t('作者署名', 'Author name')"
            />
          </view>
        </view>
        <view v-if="form.region === 'overseas'">
          <text class="field-label">
            {{ t('国家／地区与城市', 'Country / territory and city') }} *
          </text>
          <input
            v-model="form.overseasLocation"
            @blur="form.overseasLocation = readInputValue($event, form.overseasLocation)"
            @confirm="form.overseasLocation = readInputValue($event, form.overseasLocation)"
            maxlength="100"
            class="form-input"
            :placeholder="
              t('例如：新加坡 · 新加坡市（演示）', 'For example: Singapore · Singapore (demo)')
            "
          />
          <text v-if="errors.overseasLocation" class="field-error">
            {{ errorText(errors.overseasLocation) }}
          </text>
        </view>
        <view class="form-step">
          <text class="step-badge">02</text>
          <text>{{ t('写下你的家风故事', 'Write your family story') }}</text>
        </view>
        <text class="field-label">
          {{ t('作品标题', 'Title') }}
          <text class="required">*</text>
        </text>
        <input
          @blur="form.title = readInputValue($event, form.title)"
          @confirm="form.title = readInputValue($event, form.title)"
          v-model="form.title"
          :class="['form-input', { invalid: errors.title }]"
          :placeholder="
            t('为故事起一个名字（2–50字）', 'Give your story a title (2–50 characters)')
          "
          maxlength="50"
          :aria-label="t('作品标题', 'Story title')"
        />
        <text v-if="errors.title" class="field-error">{{ errorText(errors.title) }}</text>
        <view class="field-label-row">
          <text class="field-label">
            {{ t('作品正文', 'Story text') }}
            <text class="required">*</text>
          </text>
          <button class="text-button" @click="showInspiration = !showInspiration">
            ✦ {{ t('寻找创作灵感', 'Find writing ideas') }}
          </button>
        </view>
        <view :class="['writing-workspace', { 'with-inspiration': showInspiration }]">
          <WritingEditor
            :key="editorKey"
            :text="form.content"
            :delta="form.contentDelta"
            @change="richChange"
          />
          <WritingInspiration
            v-show="showInspiration"
            :draft-title="form.title"
            :draft-text="form.content"
            @close="showInspiration = false"
            @append="appendInspiration"
          />
        </view>
        <view class="editor-meta">
          <text :class="{ 'submit-save-error': draftState === 'error' }">{{ draftMessage }}</text>
          <text>{{ bodyLength }} / 10000</text>
        </view>
        <text v-if="errors.content" class="field-error">{{ errorText(errors.content) }}</text>
        <text class="submit-helper">
          {{
            t(
              '支持加粗、斜体、下划线、小标题和列表。选中文字后操作；草稿和作品预览保留格式，不导入附件中的格式。',
              'Select text to apply bold, italic, underline, headings or lists. Formatting is kept in drafts and previews. Attachment formatting is not imported.',
            )
          }}
        </text>
        <view class="poem-check-panel">
          <wd-button variant="plain" size="small" @click="runPoemCheck">
            {{ t('检查诗词句式', 'Check verse structure') }}
          </wd-button>
          <text class="submit-helper">
            {{
              t(
                '本机按标点和换行计句、计字；不判断平仄、押韵或文学质量。',
                'Counts lines and characters locally using punctuation and line breaks. It does not assess tones, rhyme or literary quality.',
              )
            }}
          </text>
          <view v-if="poemCheck" class="poem-check-result">
            <text v-if="poemSource !== form.content" class="field-error">
              {{ t('正文已修改，请重新检查。', 'The text changed. Run the check again.') }}
            </text>
            <text>
              {{ poemCheck.lines.length }} {{ t('句', 'lines') }} ·
              {{ poemCheck.counts.join(' / ') || '0' }} {{ t('字', 'characters') }}
            </text>
            <text>
              {{
                poemCheck.pattern
                  ? t(
                      '字数句式接近五言或七言的四句／八句结构，不能据此判为合律。',
                      'Counts resemble a four- or eight-line Chinese verse with five or seven characters per line; this does not establish formal validity.',
                    )
                  : t(
                      '未匹配五言／七言四句或八句结构，可按自由诗、散文或其他体裁继续创作。',
                      'No standard five- or seven-character, four- or eight-line pattern matched. You can continue as free verse, prose or another form.',
                    )
              }}
            </text>
            <text v-if="!poemCheck.chinese">
              {{
                t(
                  '包含非汉字，当前字数仅作编辑参考。',
                  'Non-Chinese characters are present; counts are only an editing reference.',
                )
              }}
            </text>
          </view>
        </view>
        <view class="form-step submit-attachment-step">
          <text class="step-badge">03</text>
          <text>{{ t('添加附件与确认', 'Attachments and confirmation') }}</text>
        </view>
        <view class="submit-attachment-area">
          <view class="submit-field-heading">
            <text class="submit-panel-title">
              {{ t('图片 / PDF / Word', 'Images / PDF / Word') }}
            </text>
            <text class="submit-helper">{{ attachments.length }} / {{ MAX_ATTACHMENT_COUNT }}</text>
          </view>
          <text class="submit-helper">
            {{
              t(
                '最多 5 个，每个不超过 10 MB。图片支持 JPG、PNG、WebP、GIF。',
                'Up to 5 files, 10 MB each. Images: JPG, PNG, WebP and GIF.',
              )
            }}
          </text>
          <view class="submit-attachment-buttons">
            <wd-button
              variant="plain"
              size="small"
              icon="image"
              :disabled="picking || attachments.length >= MAX_ATTACHMENT_COUNT"
              @click="addAttachments('image')"
            >
              {{ t('选择图片', 'Choose images') }}
            </wd-button>
            <wd-button
              variant="plain"
              size="small"
              icon="file"
              :disabled="picking || attachments.length >= MAX_ATTACHMENT_COUNT"
              @click="addAttachments('document')"
            >
              {{ t('选择 PDF / Word', 'Choose PDF / Word') }}
            </wd-button>
            <text v-if="picking" class="submit-helper">
              {{ t('等待文件选择…', 'Waiting for file selection…') }}
            </text>
          </view>
          <view v-for="file in attachments" :key="file.id" class="submit-attachment-row">
            <image
              v-if="file.type === 'image' && attachmentPreviewPath(file.id)"
              :src="attachmentPreviewPath(file.id)"
              mode="aspectFill"
              class="submit-file-thumbnail"
              @click="previewFile(file)"
              @error="markPreviewUnavailable(file.id)"
            />
            <view v-else class="submit-file-icon" @click="previewFile(file)">
              <wd-icon :name="fileIcon(file)" />
            </view>
            <view class="submit-file-copy">
              <text class="submit-file-name" @click="previewFile(file)">{{ file.name }}</text>
              <text class="submit-helper">
                {{ fileLabel(file) }} · {{ attachmentSize(file.size) }}
              </text>
              <text class="submit-file-status">
                {{
                  attachmentPreviewPath(file.id)
                    ? t('本机已选择 · 未上传', 'Selected locally · not uploaded')
                    : t(
                        '仅恢复文件信息，预览需重新选择',
                        'Metadata restored; select again to preview',
                      )
                }}
              </text>
            </view>
            <view class="submit-file-actions">
              <wd-button variant="text" size="small" @click="previewFile(file)">
                {{ t('预览', 'Preview') }}
              </wd-button>
              <wd-button
                v-if="!attachmentPreviewPath(file.id)"
                variant="text"
                size="small"
                :disabled="picking"
                @click="addAttachments(file.type === 'image' ? 'image' : 'document', file.id)"
              >
                {{ t('重新选择', 'Select again') }}
              </wd-button>
              <wd-button variant="text" size="small" @click="removeFile(file.id)">
                {{ t('移除', 'Remove') }}
              </wd-button>
            </view>
          </view>
          <view v-if="!attachments.length" class="submit-attachments-empty">
            <wd-icon name="upload" />
            <text>
              {{
                t(
                  '可添加手稿照片、补充图片或文档样例',
                  'Add manuscript photos, supporting images or sample documents',
                )
              }}
            </text>
          </view>
          <text v-for="(message, index) in attachmentErrors" :key="index" class="field-error">
            {{ message }}
          </text>
          <text v-if="errors.attachments" class="field-error">
            {{ errorText(errors.attachments) }}
          </text>
        </view>
        <view class="scope-note">
          {{
            t(
              '附件仅供当前设备临时预览；本机草稿保存文件名、格式和大小，不保存文件正文，不上传云端。刷新或临时路径失效后需重新选择。',
              'Files are only available for temporary local preview. Drafts store names, formats and sizes, not file contents. No files are uploaded. Select again after refresh or when a temporary path expires.',
            )
          }}
        </view>
        <view class="agreement">
          <wd-checkbox v-model="form.copyrightAccepted" checked-color="#C41A1A">
            {{ t('我已阅读并同意', 'I have read and accept') }}
          </wd-checkbox>
          <button class="text-button" @click="showAgreement = true">
            {{ t('《演示投稿须知与版权确认》', 'Sample submission and copyright notice') }}
          </button>
        </view>
        <text v-if="errors.copyrightAccepted" class="field-error">
          {{ errorText(errors.copyrightAccepted) }}
        </text>
        <view class="submit-footer">
          <text class="muted">
            {{ t('仅在本机保存，请使用演示内容', 'Saved locally. Use fictional demo content.') }}
          </text>
          <view class="submit-footer-actions">
            <wd-button variant="plain" :disabled="storageUnavailable" @click="preview(false)">
              {{ t('预览作品', 'Preview') }}
            </wd-button>
            <wd-button :disabled="storageUnavailable" @click="preview(true)">
              {{ t('预览并提交', 'Preview and submit') }} →
            </wd-button>
          </view>
        </view>
        <SubmissionSupport />
      </view>
      <view class="form-aside">
        <text class="eyebrow">{{ t('落笔之前', 'Before you begin') }}</text>
        <text class="aside-title">
          {{ t('家风，藏在\n生活的细节里。', 'Family values live\nin everyday moments.') }}
        </text>
        <text class="aside-copy">
          {{
            t(
              '一顿团圆饭的规矩，\n一次长辈的叮嘱，\n一个代代相传的习惯。\n\n具体的故事，自有力量。',
              'A shared family meal.\nA reminder from an elder.\nA habit passed through generations.\n\nSmall stories carry lasting meaning.',
            )
          }}
        </text>
        <view class="fine-line" />
        <text class="field-label">{{ t('投稿小贴士', 'Writing tips') }}</text>
        <text class="aside-copy">
          {{
            t(
              '01　围绕具体经历展开\n02　保留自己的语言与情感\n03　尊重他人隐私和版权\n04　提交前检查预览',
              '01  Start with a concrete experience\n02  Keep your own voice and feeling\n03  Respect privacy and copyright\n04  Check the preview before submitting',
            )
          }}
        </text>
        <button class="text-button" @click="navigate('review')">
          {{ t('了解评审流程', 'Explore the review process') }} →
        </button>
        <view class="submit-aside-note">
          <text>{{ t('演示流程', 'Demo flow') }}</text>
          <text>
            {{
              t(
                '填写草稿 → 预览确认 → 投稿编号\n评审意见 → 修改重投 → 消息与证书',
                'Draft → preview → work ID\nReview → revision → messages and certificates',
              )
            }}
          </text>
        </view>
      </view>
    </view>
    <wd-popup
      :z-index="100"
      v-model="showPreview"
      position="center"
      closable
      custom-class="content-popup"
      custom-style="width:92%;max-width:760px;"
    >
      <view class="submit-modal">
        <view class="submit-modal-heading">
          <text class="section-title">{{ t('作品预览', 'Submission preview') }}</text>
          <text class="submit-helper">
            {{
              t(
                '请确认内容、主题与附件后再提交',
                'Review the content, themes and attachments before submitting',
              )
            }}
          </text>
        </view>
        <scroll-view scroll-y class="submit-preview-scroll">
          <view class="submit-preview-paper">
            <view class="submit-preview-meta">
              <text>{{ optionLabel(channels, form.channel) }}</text>
              <text>{{ optionLabel(genres, form.genre) }}</text>
              <text>{{ optionLabel(regions, form.region) }}</text>
            </view>
            <text class="submit-preview-title">{{ form.title }}</text>
            <text class="submit-preview-author">
              {{ form.author || t('体验用户（演示署名）', 'Demo user') }}
            </text>
            <view class="submit-preview-themes">
              <text v-for="id in selectedThemes" :key="id">{{ optionLabel(themes, id) }}</text>
            </view>
            <rich-text class="submit-preview-body" :nodes="previewHtml" />
            <text v-if="form.region === 'overseas'" class="submit-helper">
              {{ form.overseasLocation }}
            </text>
            <view v-if="attachments.length" class="submit-preview-attachments">
              <text class="submit-panel-title">
                {{ t('附件清单（仅元信息）', 'Attachment list (metadata only)') }}
              </text>
              <view v-for="file in attachments" :key="file.id">
                <wd-icon :name="fileIcon(file)" />
                <text>{{ file.name }}</text>
                <text>{{ attachmentSize(file.size) }}</text>
              </view>
            </view>
            <text v-if="form.editingWorkId" class="submit-helper">
              {{ t('本次重投保留作品编号：', 'Resubmitting under the same work ID: ')
              }}{{ form.editingWorkId }}
            </text>
          </view>
          <view class="submit-preview-agreement">
            <wd-checkbox v-model="form.copyrightAccepted" checked-color="#C41A1A">
              {{
                t(
                  '我已阅读演示投稿须知与版权确认',
                  'I have read the sample submission and copyright notice',
                )
              }}
            </wd-checkbox>
            <button class="text-button" @click="openAgreementFromPreview">
              {{ t('阅读完整样例', 'Read the full sample') }}
            </button>
            <text v-if="errors.copyrightAccepted" class="field-error">
              {{ errorText(errors.copyrightAccepted) }}
            </text>
            <text class="submit-helper">
              {{
                t(
                  '提交仅保存在本机，不产生正式征集、签章或版权授权。',
                  'Submission is local only and does not create an official entry, signature or copyright licence.',
                )
              }}
            </text>
          </view>
        </scroll-view>
        <view class="submit-modal-footer">
          <wd-button variant="plain" @click="showPreview = false">
            {{ t('返回修改', 'Edit draft') }}
          </wd-button>
          <wd-button :disabled="submitting || storageUnavailable" @click="submit">
            {{
              form.editingWorkId
                ? t('确认修改重投', 'Confirm revision')
                : t('确认提交演示作品', 'Confirm demo submission')
            }}
          </wd-button>
        </view>
      </view>
    </wd-popup>
    <wd-popup
      :z-index="100"
      v-model="showAgreement"
      position="center"
      closable
      custom-class="content-popup"
      custom-style="width:92%;max-width:700px;"
    >
      <view class="submit-modal">
        <view class="submit-modal-heading">
          <text class="section-title">
            {{ t('演示投稿须知与版权确认', 'Sample submission and copyright notice') }}
          </text>
          <text class="submit-helper">
            {{ t('原型条款样例 · 版本 DEMO-2026-01', 'Prototype terms sample · DEMO-2026-01') }}
          </text>
        </view>
        <scroll-view scroll-y class="submit-agreement-scroll">
          <view class="submit-agreement-article">
            <text class="submit-panel-title">
              {{ t('一、体验范围', '1. Scope of this demonstration') }}
            </text>
            <text>
              {{
                t(
                  '本原型用于需求沟通。文字和附件信息保存在当前设备，不向真实征集平台、云端存储或第三方机构发送。请使用虚构人物和您有权使用的演示内容。',
                  'This prototype supports product discussion. Text and attachment metadata remain on this device and are not sent to a real collection platform, cloud storage or third-party institution. Use fictional names and demo content you are entitled to use.',
                )
              }}
            </text>
            <text class="submit-panel-title">
              {{ t('二、内容与署名', '2. Content and author names') }}
            </text>
            <text>
              {{
                t(
                  '提交前检查标题、正文、作者署名与所属地区；不填写身份证号、住址、电话等真实敏感资料。引用、改编或提供他人作品时，正式上线流程需核实来源与使用权限。',
                  'Check the title, text, author name and region. Do not enter real identity numbers, home addresses or phone numbers. Sources and permissions for quoted, adapted or third-party works must be verified in a future production workflow.',
                )
              }}
            </text>
            <text class="submit-panel-title">{{ t('三、附件说明', '3. Attachments') }}</text>
            <text>
              {{
                t(
                  '文件选择不等于文件上传。本演示只保存附件元信息，图片临时预览可能在刷新后失效；PDF 与 Word 展示文件信息，不解析文档正文。',
                  'Selecting a file does not upload it. Only attachment metadata is stored. Temporary image previews may expire after refresh. PDF and Word files show metadata; their contents are not parsed.',
                )
              }}
            </text>
            <text class="submit-panel-title">
              {{ t('四、版权确认样例', '4. Sample copyright acknowledgement') }}
            </text>
            <text>
              {{
                t(
                  '勾选仅用于演示您已阅读本说明的交互，不构成正式电子签名、版权转让、独家授权或发布许可。正式征集的展示、出版、改编、撤回与留存规则尚需另行确认。',
                  'The checkbox demonstrates acknowledgement of this notice. It is not a formal electronic signature, copyright transfer, exclusive licence or publication permission. Production rules for display, publishing, adaptation, withdrawal and retention remain to be agreed.',
                )
              }}
            </text>
            <text class="submit-panel-title">
              {{ t('五、评审与修改', '5. Reviews and revisions') }}
            </text>
            <text>
              {{
                t(
                  '作品编号、评语、入围、获奖、典藏与证书均为模拟状态，不代表实际审批或授奖。退回修改可保留同一编号重投，历史评语用于沟通演示。',
                  'Work IDs, feedback, selections, awards, collections and certificates are simulated. They do not represent real review decisions or awards. Returned works can be revised under the same ID, with review history kept for the demo.',
                )
              }}
            </text>
            <text class="submit-panel-title">{{ t('六、本机记录', '6. Local records') }}</text>
            <text>
              {{
                t(
                  '清理本机存储可能移除草稿、投稿和状态记录。演示无账号同步；正式产品需另行提供账户、隐私、保留期限与撤回渠道。',
                  'Clearing local storage may remove drafts, submissions and status records. The demo has no account synchronisation. A production product will need account, privacy, retention and withdrawal processes.',
                )
              }}
            </text>
          </view>
        </scroll-view>
        <view class="submit-modal-footer">
          <wd-button block @click="showAgreement = false">
            {{ t('我已阅读，返回填写', 'I have read this sample') }}
          </wd-button>
        </view>
      </view>
    </wd-popup>
    <wd-popup
      :z-index="100"
      v-model="showAttachmentPreview"
      position="center"
      closable
      custom-class="content-popup"
      custom-style="width:92%;max-width:650px;"
    >
      <view v-if="previewAttachment" class="submit-modal">
        <view class="submit-modal-heading">
          <text class="section-title">{{ t('附件预览', 'Attachment preview') }}</text>
        </view>
        <scroll-view scroll-y class="submit-file-preview-scroll">
          <image
            v-if="previewAttachment.type === 'image' && attachmentPreviewPath(previewAttachment.id)"
            :src="attachmentPreviewPath(previewAttachment.id)"
            mode="widthFix"
            class="submit-preview-image"
            @error="markPreviewUnavailable(previewAttachment.id)"
          />
          <view v-else class="submit-document-preview">
            <wd-icon :name="fileIcon(previewAttachment)" />
            <text>{{ fileLabel(previewAttachment) }}</text>
          </view>
          <view class="submit-file-preview-copy">
            <text class="submit-file-name">{{ previewAttachment.name }}</text>
            <text>{{ t('文件类型：', 'Type: ') }}{{ fileLabel(previewAttachment) }}</text>
            <text>{{ t('文件大小：', 'Size: ') }}{{ attachmentSize(previewAttachment.size) }}</text>
            <text class="submit-helper">
              {{
                attachmentPreviewPath(previewAttachment.id)
                  ? t('已在本机选择，未上传云端。', 'Selected locally; not uploaded.')
                  : t(
                      '临时预览不可用，请移除或重新选择文件。',
                      'The temporary preview is unavailable. Remove or select the file again.',
                    )
              }}
            </text>
            <text v-if="previewAttachment.type !== 'image'" class="submit-helper">
              {{
                t(
                  '本阶段仅展示文档元信息，不解析 PDF 或 Word 正文。',
                  'This prototype displays document metadata without parsing PDF or Word contents.',
                )
              }}
            </text>
          </view>
        </scroll-view>
        <view class="submit-modal-footer">
          <wd-button block variant="plain" @click="showAttachmentPreview = false">
            {{ t('关闭预览', 'Close preview') }}
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>
<style scoped lang="scss">
.submission-view {
  color: var(--jf-ink, #2c2c2c);
}
.submit-helper {
  display: block;
  color: #646464;
  font-size: 12px;
  line-height: 1.8;
}
.submit-panel-title {
  display: block;
  color: var(--jf-ink, #2c2c2c);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.8;
}
.submit-field-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-top: 20px;
  margin-bottom: 10px;
}
.submit-field-heading .field-label {
  margin: 0;
}
.submit-theme-grid {
  margin-bottom: 9px;
}
.submit-revision-banner {
  border: 1px solid #dbbfa2;
  border-left: 3px solid var(--jf-red, #c41a1a);
  background: #f7eee4;
  padding: 18px;
  margin-bottom: 28px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.8;
}
.submit-revision-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  border: 1px solid #e3c5b7;
  background: #fff6ef;
  padding: 28px;
  line-height: 1.9;
}
.submit-revision-error :deep(.wd-icon) {
  color: var(--jf-red, #c41a1a);
  font-size: 28px;
}
.submit-editor-toolbar {
  display: flex;
  gap: 0;
  flex-wrap: wrap;
  background: #f4ecdf;
  border: 1px solid #ded4c4;
  border-bottom: 0;
  padding: 7px 9px;
  margin-top: 8px;
}
.submit-editor-toolbar :deep(.wd-button) {
  font-size: 12px;
  padding-left: 11px;
  padding-right: 11px;
}
.submission-view .writing-area {
  border-radius: 0 0 3px 3px;
  font-size: 14px;
}
.submit-save-error {
  color: var(--jf-red, #c41a1a);
}
.submit-attachment-step {
  margin-top: 35px;
}
.submit-attachment-area {
  border: 1px solid #ded4c4;
  background: #fbf7f0;
  padding: 20px;
}
.submit-attachment-area .submit-field-heading {
  margin-top: 0;
}
.submit-attachment-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin: 18px 0;
}
.submit-attachments-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  border: 1px dashed #ccb899;
  color: #595959;
  padding: 25px 16px;
  font-size: 12px;
  text-align: center;
  line-height: 1.8;
}
.submit-attachments-empty :deep(.wd-icon) {
  color: var(--jf-gold, #c9a96e);
  font-size: 28px;
}
.submit-attachment-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 0;
  border-top: 1px solid #e2d7c6;
}
.submit-file-thumbnail,
.submit-file-icon {
  width: 48px;
  height: 59px;
  flex-shrink: 0;
  border: 1px solid #d9c8ac;
  background: #f3e8d8;
}
.submit-file-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  color: var(--jf-red, #c41a1a);
  font-size: 24px;
}
.submit-file-copy {
  min-width: 0;
  flex: 1;
}
.submit-file-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--jf-ink, #2c2c2c);
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.submit-file-status {
  display: block;
  font-size: 11px;
  color: #666;
  line-height: 1.8;
}
.submit-file-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.submit-file-actions :deep(.wd-button) {
  min-width: 0;
  padding: 0 4px;
  font-size: 12px;
  height: 27px;
  line-height: 27px;
}
.submission-view .submit-footer {
  align-items: flex-start;
  flex-direction: column;
}
.submit-footer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-self: flex-end;
}
.submission-view .aside-title,
.submission-view .aside-copy {
  white-space: pre-line;
}
.submit-aside-note {
  margin-top: 25px;
  border-top: 1px solid #d2b995;
  padding-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  color: #454545;
  font-size: 12px;
  line-height: 1.9;
  white-space: pre-line;
}
.submit-aside-note > text:first-child {
  font-weight: 700;
  color: var(--jf-red, #c41a1a);
}
.submit-modal {
  padding: 28px 25px 22px;
  color: var(--jf-ink, #2c2c2c);
}
.submit-modal-heading {
  margin-bottom: 18px;
  padding-right: 18px;
}
.submit-modal-heading .section-title {
  font-size: 21px;
  line-height: 1.7;
  display: block;
}
.submit-modal-heading .submit-helper {
  margin-top: 7px;
}
.submit-preview-scroll {
  height: 57vh;
}
.submit-preview-paper {
  background: #fffdf8;
  border: 1px solid #dfd3c0;
  border-top: 3px solid var(--jf-red, #c41a1a);
  padding: 25px;
}
.submit-preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 15px;
  color: #666;
  font-size: 11px;
}
.submit-preview-title {
  display: block;
  font:
    700 25px/1.8 'JiafengSerif',
    serif;
  text-align: center;
  margin: 20px 0 10px;
}
.submit-preview-author {
  display: block;
  font-size: 13px;
  color: #555;
  text-align: center;
}
.submit-preview-themes {
  display: flex;
  gap: 7px;
  justify-content: center;
  flex-wrap: wrap;
  margin: 20px 0;
}
.submit-preview-themes > text {
  background: #f5eee3;
  padding: 4px 9px;
  font-size: 11px;
  color: #505050;
}
.submit-preview-body {
  display: block;
  white-space: pre-wrap;
  font-size: 15px;
  line-height: 2.05;
  color: #333;
  padding: 15px 0;
}
.submit-preview-attachments {
  padding-top: 15px;
  margin-top: 15px;
  border-top: 1px solid #dfd3c0;
}
.submit-preview-attachments > view {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  font-size: 12px;
}
.submit-preview-attachments > view > text:first-of-type {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}
.submit-preview-attachments > view > text:last-child {
  flex-shrink: 0;
  color: #626262;
}
.submit-preview-attachments :deep(.wd-icon) {
  color: var(--jf-red, #c41a1a);
}
.submit-preview-agreement {
  padding-top: 20px;
}
.submit-preview-agreement .text-button {
  display: block;
  margin: 12px 0;
  font-size: 12px;
}
.submit-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
}
.submit-agreement-scroll {
  height: 58vh;
}
.submit-agreement-article {
  font-size: 14px;
  line-height: 1.95;
}
.submit-agreement-article > text {
  display: block;
  margin-bottom: 17px;
}
.submit-agreement-article .submit-panel-title {
  color: var(--jf-red, #c41a1a);
  margin: 22px 0 8px;
}
.submit-agreement-article .submit-panel-title:first-child {
  margin-top: 0;
}
.submit-file-preview-scroll {
  max-height: 58vh;
  height: 58vh;
}
.submit-preview-image {
  width: 100%;
  display: block;
  background: #eee8de;
}
.submit-document-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  gap: 16px;
  background: #f1e7d6;
  color: var(--jf-red, #c41a1a);
  border: 1px solid #dbc8a7;
}
.submit-document-preview :deep(.wd-icon) {
  font-size: 52px;
}
.submit-file-preview-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 22px;
  font-size: 14px;
}
@media (max-width: 640px) {
  .submission-view .form-card {
    padding: 24px 19px;
  }
  .submission-view .field-label {
    font-size: 13px;
  }
  .submission-view .form-step {
    font-size: 16px;
  }
  .submit-field-heading {
    gap: 10px;
  }
  .submit-editor-toolbar {
    padding: 6px;
  }
  .submit-editor-toolbar :deep(.wd-button) {
    font-size: 11px;
    padding-left: 7px;
    padding-right: 7px;
  }
  .submit-attachment-area {
    padding: 15px;
  }
  .submit-attachment-buttons {
    gap: 10px;
  }
  .submit-file-thumbnail,
  .submit-file-icon {
    width: 38px;
    height: 49px;
  }
  .submit-attachment-row {
    gap: 9px;
    align-items: flex-start;
  }
  .submit-file-name {
    font-size: 12px;
  }
  .submit-file-copy .submit-helper,
  .submit-file-status {
    font-size: 10px;
  }
  .submit-file-actions :deep(.wd-button) {
    font-size: 11px;
  }
  .submit-footer-actions {
    align-self: stretch;
    justify-content: flex-end;
    gap: 9px;
  }
  .submit-footer-actions :deep(.wd-button) {
    padding-left: 13px;
    padding-right: 13px;
    font-size: 13px;
  }
  .submission-view .agreement .text-button {
    font-size: 12px;
    text-align: left;
  }
  .submission-view .field-label-row {
    align-items: flex-start;
    gap: 10px;
    flex-wrap: wrap;
  }
  .submit-modal {
    padding: 25px 16px 20px;
  }
  .submit-modal-heading .section-title {
    font-size: 20px;
  }
  .submit-modal-heading .submit-helper {
    font-size: 11px;
  }
  .submit-preview-paper {
    padding: 20px 15px;
  }
  .submit-preview-title {
    font-size: 22px;
  }
  .submit-preview-body {
    font-size: 14px;
  }
  .submit-preview-scroll {
    height: 55vh;
  }
  .submit-modal-footer {
    gap: 9px;
    flex-wrap: wrap;
  }
  .submit-modal-footer :deep(.wd-button) {
    font-size: 13px;
    padding-left: 12px;
    padding-right: 12px;
  }
  .submit-agreement-scroll {
    height: 55vh;
  }
  .submit-file-preview-scroll {
    height: 55vh;
  }
  .submit-revision-banner {
    padding: 15px;
  }
}
</style>

<style scoped>
.writing-workspace {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.writing-workspace.with-inspiration {
  grid-template-columns: minmax(0, 1fr) minmax(240px, 0.8fr);
}
.poem-check-panel {
  margin-top: 18px;
  padding: 14px;
  background: #f5f0e8;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.poem-check-result {
  font-size: 13px;
  line-height: 1.8;
}
.poem-check-result text {
  display: block;
  margin-top: 6px;
}
@media (max-width: 1100px) {
  .writing-workspace.with-inspiration {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
