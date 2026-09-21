<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import SectionHeading from './SectionHeading.vue'
import ConversationPanel from './ConversationPanel.vue'
import type { ConversationReply } from '../domain/localConversation'
import { t, locale } from '../composables/useLocale'
import { useRouteParams } from '../composables/useNavigation'
import { repo, region, safely, notify, navigate } from '../composables/useDemo'
import { aiArchives, archiveError, saveAiArchive } from '../composables/usePersonalArchive'
import {
  assistantTools,
  getAssistantTool,
  getAssistantExample,
  createAssistantDraft,
  transferAssistantDraft,
} from '../domain/assistantExamples'
import type { LocalizedText } from '../domain/assistantExamples'
import type { AssistantMode } from '../domain/personalArchive'
import type { SubmissionDraft } from '../domain/types'
interface ModeState {
  exampleId: string
  prompt: string
  result: string
  resultPrompt: string
  resultLanguage: 'zh' | 'en'
  restoredId: string
  savedError: boolean
  source: 'preset' | 'rules'
}
const local = (value: LocalizedText) => t(value.zh, value.en)
const params = useRouteParams()
const mode = ref<AssistantMode>('letter')
const editorExpanded = ref(false)
const forms = reactive(
  Object.fromEntries(
    assistantTools.map((tool) => {
      const example = tool.examples[0]!
      return [
        tool.id,
        {
          exampleId: example.id,
          prompt: local(example.input),
          result: '',
          resultPrompt: '',
          resultLanguage: locale.value,
          restoredId: '',
          savedError: false,
          source: 'preset',
        },
      ]
    }),
  ) as Record<AssistantMode, ModeState>,
)
type EditorField = 'prompt' | 'result'
interface EditorBinding {
  owner: AssistantMode
  field: EditorField
  version: number
  key: string
}
interface EditorEvent {
  detail?: { value?: unknown }
}
const editorVersions = reactive(
  Object.fromEntries(assistantTools.map((item) => [item.id, { prompt: 0, result: 0 }])) as Record<
    AssistantMode,
    Record<EditorField, number>
  >,
)
function resetEditors(owner: AssistantMode, fields: EditorField[] = ['prompt', 'result']) {
  for (const field of fields) editorVersions[owner][field]++
}
function bindEditor(field: EditorField): EditorBinding[] {
  const owner = mode.value
  const version = editorVersions[owner][field]
  return [{ owner, field, version, key: `${owner}-${field}-${version}` }]
}
const resultEditors = computed(() => bindEditor('result'))
function syncEditor(event: unknown, editor: EditorBinding) {
  const value = (event as EditorEvent | undefined)?.detail?.value
  if (editorVersions[editor.owner][editor.field] !== editor.version || typeof value !== 'string')
    return
  forms[editor.owner][editor.field] = value
}
function finishEditor(event: unknown, editor: EditorBinding) {
  const value = (event as EditorEvent | undefined)?.detail?.value
  if (editorVersions[editor.owner][editor.field] !== editor.version || typeof value !== 'string')
    return
  syncEditor(event, editor)
  // A pending throttled event from the old control cannot overwrite the blur value.
  resetEditors(editor.owner, [editor.field])
}
const tool = computed(() => getAssistantTool(mode.value))
const current = computed(() => forms[mode.value])
const example = computed(() => getAssistantExample(mode.value, current.value.exampleId))
const hasResult = computed(() => !!current.value.resultPrompt)
const isReference = computed(() => ['help', 'knowledge', 'compliance'].includes(mode.value))
const storyboardFrames = computed(() =>
  current.value.result.split(/\n\s*\n/).filter((part) => part.trim()),
)
const canUseResult = computed(() => !!current.value.result.trim())
const manuscriptText = computed(
  () =>
    example.value.source?.[
      current.value.resultPrompt ? current.value.resultLanguage : locale.value
    ] ?? '',
)
const alreadySaved = computed(
  () =>
    canUseResult.value &&
    aiArchives.value.some(
      (item) =>
        item.mode === mode.value &&
        item.prompt === current.value.resultPrompt &&
        item.result === current.value.result,
    ),
)
const restoredMissing = ref(false)
const copying = ref(false)
const copyFailed = ref(false)
const conflictVisible = ref(false)
const existingDraft = ref<SubmissionDraft | null>(null)
const candidateDraft = ref<SubmissionDraft | null>(null)
const transferFailed = ref(false)
const revisionProtected = computed(() => !!existingDraft.value?.editingWorkId)
const resultCount = computed(() => [...current.value.result].length)
function chooseMode(value: AssistantMode) {
  resetEditors(value)
  mode.value = value
  editorExpanded.value = Boolean(forms[value].resultPrompt)
  copyFailed.value = false
  transferFailed.value = false
}
function useConversationReply(reply: ConversationReply) {
  if (!reply.content) return
  const chosen = getAssistantExample(reply.mode, reply.exampleId)
  resetEditors(reply.mode)
  mode.value = reply.mode
  Object.assign(forms[reply.mode], {
    exampleId: chosen.id,
    prompt: reply.prompt,
    result: reply.content,
    resultPrompt:
      reply.source === 'preset'
        ? chosen.input[reply.language]
        : (reply.language === 'zh' ? '本机对话：' : 'Local conversation: ') + reply.prompt,
    resultLanguage: reply.language,
    restoredId: '',
    savedError: false,
    source: reply.source === 'preset' ? 'preset' : 'rules',
  })
  copyFailed.value = false
  transferFailed.value = false
  editorExpanded.value = true
}
function useProofreadExample() {
  if (!example.value.corrected) return
  resetEditors(mode.value, ['result'])
  current.value.result = example.value.corrected[current.value.resultLanguage]
  current.value.savedError = false
}
function copyResult() {
  if (!canUseResult.value || copying.value) return
  copying.value = true
  copyFailed.value = false
  try {
    uni.setClipboardData({
      data: current.value.result,
      showToast: false,
      success: () => notify(t('示例内容已复制', 'Sample copied')),
      fail: () => {
        copyFailed.value = true
      },
      complete: () => {
        copying.value = false
      },
    })
  } catch {
    copying.value = false
    copyFailed.value = true
  }
}
function saveResult(message?: string): boolean {
  if (!canUseResult.value) return false
  const result = saveAiArchive({
    mode: mode.value,
    prompt: current.value.resultPrompt,
    result: current.value.result,
  })
  current.value.savedError = !result
  if (result) {
    notify(message ?? t('示例已存档，可在个人中心查看。', 'Sample saved. Find it in My account.'))
    return true
  }
  return false
}
function keepAndArchive() {
  if (
    saveResult(
      t('示例已另存，原投稿草稿未改动。', 'Sample archived. Your contribution draft is unchanged.'),
    )
  )
    conflictVisible.value = false
}
function attemptTransfer(replace = false) {
  if (!candidateDraft.value) return
  transferFailed.value = false
  const result = safely(() => transferAssistantDraft(repo, candidateDraft.value!, replace))
  if (!result) {
    transferFailed.value = true
    return
  }
  if (result.status === 'saved') {
    conflictVisible.value = false
    notify(
      t(
        '已保存为新投稿草稿，请继续编辑并确认版权。',
        'Saved as a new draft. Review it and confirm the copyright notice.',
      ),
    )
    navigate('submit')
    return
  }
  existingDraft.value = result.existing
  candidateDraft.value = result.candidate
  conflictVisible.value = true
}
function startTransfer() {
  if (!canUseResult.value || isReference.value) return
  const candidate = safely(() =>
    createAssistantDraft(mode.value, current.value.result, region.value, locale.value),
  )
  if (!candidate) return
  candidateDraft.value = candidate
  attemptTransfer()
}
function replaceDraft() {
  attemptTransfer(true)
}
function keepDraft() {
  conflictVisible.value = false
}
watch(
  () => params.value.archive,
  (id) => {
    if (!id) return
    const saved = aiArchives.value.find((item) => item.id === id)
    restoredMissing.value = !saved
    if (!saved) return
    resetEditors(saved.mode)
    mode.value = saved.mode
    editorExpanded.value = true
    const match = getAssistantTool(saved.mode).examples.find(
      (item) => item.input.zh === saved.prompt || item.input.en === saved.prompt,
    )
    const language = saved.prompt === match?.input.en ? 'en' : 'zh'
    Object.assign(forms[saved.mode], {
      exampleId: match?.id ?? getAssistantTool(saved.mode).examples[0]!.id,
      prompt: saved.prompt,
      result: saved.result,
      resultPrompt: saved.prompt,
      resultLanguage: language,
      restoredId: saved.id,
      savedError: false,
      source: match ? 'preset' : 'rules',
    })
  },
  { immediate: true },
)
watch(
  () => params.value.mode,
  (value) => {
    if (!params.value.archive && assistantTools.some((item) => item.id === value))
      chooseMode(value as AssistantMode)
  },
  { immediate: true },
)
</script>
<template>
  <view class="assistant-workbench">
    <SectionHeading
      :title="t('让灵感，落在笔尖', 'Turn inspiration into words')"
      :eyebrow="t('AI 家风助手 · 对话体验', 'FAMILY-VALUES ASSISTANT · CONVERSATION')"
      :subtitle="
        t(
          '聊一件家里的小事，把想法慢慢写清楚。',
          'Talk about an everyday family moment and shape it into words.',
        )
      "
    />
    <view v-if="restoredMissing" class="scope-note">
      {{
        t(
          '未找到该存档，可能已移除或来自另一台设备。你仍可浏览下方预设样例。',
          'This archive was not found. It may have been removed or saved on another device. You can still explore the presets below.',
        )
      }}
    </view>
    <view v-if="archiveError" class="scope-note">
      {{
        t(
          '本机示例存档不可用，原有记录未被覆盖。当前可查看和复制结果。',
          'The local archive is unavailable. Existing records have not been overwritten. You can still view and copy results.',
        )
      }}
    </view>
    <view class="assistant-mode-tabs">
      <button
        v-for="item in assistantTools"
        :key="item.id"
        :class="['assistant-mode-button', { active: mode === item.id }]"
        @click="chooseMode(item.id)"
      >
        <text class="assistant-mode-symbol">{{ item.symbol }}</text>
        <text>{{ local(item.label) }}</text>
      </button>
    </view>
    <view class="assistant-layout assistant-chat-layout">
      <view class="assistant-chat-primary">
        <ConversationPanel :mode="mode" @use="useConversationReply" />
      </view>
      <view v-if="hasResult" class="assistant-editor-toggle">
        <view>
          <text>{{ t('这段内容的后续操作', 'Work with this passage') }}</text>
          <text>
            {{
              t(
                '编辑、复制、存档，或安全转入投稿',
                'Edit, copy, save, or safely transfer to Contribute',
              )
            }}
          </text>
        </view>
        <wd-button variant="plain" size="small" @click="editorExpanded = !editorExpanded">
          {{
            editorExpanded
              ? t('收起编辑区', 'Collapse work area')
              : t('打开编辑区', 'Open work area')
          }}
        </wd-button>
      </view>
      <view v-if="hasResult && editorExpanded" class="assistant-result-panel">
        <view class="assistant-step-heading">
          <text class="assistant-step">02</text>
          <text class="section-title">{{ t('阅读、改写与带走', 'Read, adapt and keep') }}</text>
        </view>
        <view v-if="!hasResult" class="assistant-result-empty">
          <text class="assistant-empty-mark">文</text>
          <text class="section-title">
            {{ t('好表达，从细节开始', 'Good writing starts with detail') }}
          </text>
          <text>
            {{
              t(
                '选一个样例，查看它的结构、对照或校对思路。八个工具会展示不同的预设内容。',
                'Choose a sample to explore its structure, comparison or proofreading notes. Each tool offers different preset content.',
              )
            }}
          </text>
        </view>
        <template v-else>
          <view class="assistant-result-meta">
            <text class="tag">
              {{
                current.restoredId
                  ? t('已恢复存档 · 保留原文', 'Archive restored · Original text retained')
                  : current.source === 'preset'
                    ? t('预设样例', 'Prepared example')
                    : t('本机规则式写作框架／节选', 'Local writing frame / excerpt')
              }}
            </text>
            <text>{{ resultCount }} {{ t('字', 'characters') }}</text>
          </view>
          <view v-if="mode === 'ocr' && current.source === 'preset'" class="assistant-manuscript">
            <text class="assistant-manuscript-label">
              {{ t('原创排版手稿样卡 · 非上传图片', 'Original text card · Not an uploaded image') }}
            </text>
            <text class="assistant-manuscript-text">{{ manuscriptText }}</text>
          </view>
          <view
            v-if="mode === 'polish' && current.source === 'preset'"
            class="assistant-comparison-original"
          >
            <text class="field-label">
              {{ t('对照原文（所选样例）', 'Original passage (selected preset)') }}
            </text>
            <text>{{ current.resultPrompt }}</text>
          </view>
          <text class="field-label">
            {{
              mode === 'polish'
                ? t('润色示例，可继续改写', 'Polished sample — editable')
                : mode === 'ocr'
                  ? t('待校文本，可手动更正', 'Text to proofread — editable')
                  : isReference
                    ? t('预设参考资料', 'Preset reference material')
                    : t('示例正文，可继续改写', 'Sample text — editable')
            }}
          </text>
          <text v-if="isReference" class="assistant-help-answer">{{ current.result }}</text>
          <template v-else>
            <textarea
              v-for="editor in resultEditors"
              :key="editor.key"
              :value="forms[editor.owner].result"
              @input="syncEditor($event, editor)"
              @blur="finishEditor($event, editor)"
              @confirm="finishEditor($event, editor)"
              class="assistant-result-field"
              :maxlength="10000"
              :aria-label="t('助手示例结果', 'Assistant sample result')"
            />
          </template>
          <view v-if="mode === 'storyboard'" class="storyboard-preview">
            <text class="field-label">
              {{ t('分镜卡片 · 与上方文本同步', 'Scene cards · Synced with the text above') }}
            </text>
            <view v-for="(frame, index) in storyboardFrames" :key="index" class="storyboard-frame">
              <view class="storyboard-visual">
                <text>{{ String(index + 1).padStart(2, '0') }}</text>
                <text>{{ t('画面文字示意', 'Text-only visual sketch') }}</text>
              </view>
              <text selectable>{{ frame }}</text>
            </view>
          </view>
          <view v-if="mode === 'compliance'" class="assistant-compliance-status">
            <text>{{ t('待人工复核 · 样例报告', 'Human review needed · Sample report') }}</text>
            <text>
              {{
                t(
                  '仅供查看审核交互。没有实际审查或放行你的输入。',
                  'Demonstrates the review interface. Your input has not been assessed or approved.',
                )
              }}
            </text>
          </view>
          <view
            v-if="current.source === 'preset' && (!current.restoredId || mode === 'ocr')"
            class="assistant-review-notes"
          >
            <text class="field-label">
              {{
                mode === 'ocr'
                  ? t('校对提示', 'Proofreading notes')
                  : isReference
                    ? t('来源与参考说明', 'Sources and reference notes')
                    : t('这个样例的写法', 'What this sample demonstrates')
              }}
            </text>
            <text v-for="(note, index) in example.notes" :key="index">
              {{ String(index + 1).padStart(2, '0') }}　{{ local(note) }}
            </text>
            <button
              v-if="mode === 'ocr' && example.corrected"
              class="text-button"
              @click="useProofreadExample"
            >
              {{
                t('使用完整校对示例（替换右侧文本）', 'Use the corrected preset (replace result)')
              }}
              ↗
            </button>
          </view>
          <view class="assistant-result-actions">
            <wd-button
              variant="plain"
              :loading="copying"
              :disabled="copying || !canUseResult"
              @click="copyResult"
            >
              {{ t('复制文本', 'Copy text') }}
            </wd-button>
            <wd-button
              variant="plain"
              :disabled="alreadySaved || archiveError || !canUseResult"
              @click="saveResult()"
            >
              {{ alreadySaved ? t('已存档', 'Saved') : t('保存示例', 'Save sample') }}
            </wd-button>
            <wd-button v-if="!isReference" :disabled="!canUseResult" @click="startTransfer">
              {{ t('转入新投稿草稿', 'Use as a new contribution draft') }} →
            </wd-button>
          </view>
          <view v-if="mode === 'help'" class="assistant-help-links">
            <button class="text-button" @click="navigate('submit')">
              {{ t('前往投稿', 'Open Contribute') }} →
            </button>
            <button class="text-button" @click="navigate('review')">
              {{ t('查询评审进度', 'Track a review') }} →
            </button>
          </view>
          <text v-if="copyFailed" class="field-error">
            {{
              t(
                '剪贴板写入失败，可重试或在结果中长按选择复制。',
                'Clipboard access failed. Retry, or select text in the result and copy it manually.',
              )
            }}
          </text>
          <text v-if="current.savedError" class="field-error">
            {{
              t(
                '示例未保存，请检查本机存储后重试；结果仍保留在当前页面。',
                'The sample was not saved. Check local storage and retry; the result remains on this page.',
              )
            }}
          </text>
          <text v-if="transferFailed" class="field-error">
            {{
              t(
                '新草稿未保存，原草稿没有被更改。请检查存储后重试。',
                'The new draft was not saved. The original draft is unchanged. Check storage and retry.',
              )
            }}
          </text>
          <text class="assistant-small-note">
            {{
              t(
                '存档保存来源问题与当前编辑结果。转入投稿不会自动勾选版权，也不会直接提交作品。',
                'Archiving saves the source question and current edited result. Transferring to Contribute does not accept copyright terms or submit the work.',
              )
            }}
          </text>
        </template>
      </view>
    </view>
    <view class="assistant-bottom-note">
      <text>
        {{
          t(
            '先有自己的故事，再借一点表达的帮助。',
            'Start with your own story. Use the samples as writing support.',
          )
        }}
      </text>
      <button class="text-button" @click="navigate('profile', { tab: 'archive' })">
        {{ t('查看我的示例存档', 'View my saved samples') }} ↗
      </button>
    </view>
    <wd-popup
      v-model="conflictVisible"
      :z-index="100"
      position="center"
      closable
      custom-class="content-popup"
    >
      <view class="dialog-body assistant-transfer-dialog">
        <text class="eyebrow">{{ t('草稿保护', 'DRAFT PROTECTION') }}</text>
        <text class="section-title">
          {{
            revisionProtected
              ? t('保留当前退回修改草稿', 'Keep your current revision draft')
              : t('当前已经有一份投稿草稿', 'A contribution draft already exists')
          }}
        </text>
        <text class="assistant-description">
          {{
            revisionProtected
              ? t(
                  '助手不会覆盖带原作品编号的修改草稿。你可以保留它，并将本次示例单独存档。',
                  'The assistant will not overwrite a revision draft tied to an existing work ID. Keep it and archive this sample separately.',
                )
              : t(
                  '默认保留原稿。只有明确选择“替换为新稿”，才会替换本机这一份草稿。',
                  'The original draft is kept by default. It is replaced only if you explicitly choose Replace with new draft.',
                )
          }}
        </text>
        <view class="assistant-draft-comparison">
          <view>
            <text class="field-label">{{ t('现有草稿', 'Existing draft') }}</text>
            <text>{{ existingDraft?.title || t('未命名草稿', 'Untitled draft') }}</text>
            <text class="muted">
              {{ existingDraft?.content.length ?? 0 }} {{ t('字', 'characters') }} ·
              {{ existingDraft?.attachments?.length ?? 0 }} {{ t('个附件', 'attachments') }}
            </text>
            <text v-if="existingDraft?.editingWorkId" class="muted">
              {{ existingDraft.editingWorkId }}
            </text>
          </view>
          <view>
            <text class="field-label">{{ t('拟创建的新稿', 'Proposed new draft') }}</text>
            <text>{{ candidateDraft?.title }}</text>
            <text class="muted">
              {{ candidateDraft?.content.length ?? 0 }}
              {{ t('字 · 不带原作品编号', 'characters · No existing work ID') }}
            </text>
          </view>
        </view>
        <text v-if="transferFailed" class="field-error">
          {{
            t(
              '保存失败，原稿未更改，可以重试。',
              'Save failed. Your original draft is unchanged. You can retry.',
            )
          }}
        </text>
        <view class="assistant-transfer-actions">
          <wd-button block @click="keepDraft">
            {{ t('保留原稿，返回查看', 'Keep original and return') }}
          </wd-button>
          <wd-button block variant="plain" :disabled="archiveError" @click="keepAndArchive">
            {{ t('保留原稿，仅存档本次示例', 'Keep original and archive this sample') }}
          </wd-button>
          <button
            v-if="!revisionProtected"
            class="text-button assistant-replace-action"
            @click="replaceDraft"
          >
            {{
              t(
                '明确替换为新稿（原草稿将被替换）',
                'Replace with new draft (overwrites the current draft)',
              )
            }}
          </button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>
<style scoped>
.assistant-workbench {
  color: var(--jf-ink);
  min-width: 0;
}
.assistant-demo-note {
  display: flex;
  gap: 18px;
  background: var(--jf-paper);
  border: 1px solid var(--jf-border);
  border-left: 3px solid var(--jf-gold);
  padding: 22px 26px;
  margin: 22px 0 28px;
  line-height: 1.8;
  font-size: 14px;
}
.assistant-demo-mark {
  font-size: 32px;
  color: var(--jf-red);
  flex-shrink: 0;
}
.assistant-note-title {
  display: block;
  font-weight: 600;
  margin-bottom: 4px;
}
.assistant-mode-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 24px;
}
.assistant-mode-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 0;
  background: transparent;
  border: 1px solid var(--jf-border);
  border-radius: 0;
  margin: 0;
  padding: 18px 12px;
  line-height: 1.45;
  font-size: 14px;
  color: var(--jf-ink);
}
.assistant-mode-button::after,
.assistant-example-button::after {
  border: 0;
}
.assistant-mode-button.active {
  border-color: var(--jf-red);
  color: var(--jf-red);
  background: var(--jf-surface);
}
.assistant-mode-symbol {
  font-family: JiafengSerif, serif;
  font-size: 23px;
  color: var(--jf-red);
}
.assistant-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  align-items: start;
  gap: 24px;
}
.assistant-input-panel,
.assistant-result-panel {
  min-width: 0;
  padding: 28px;
  background: var(--jf-surface);
  border: 1px solid var(--jf-border);
}
.assistant-step-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.assistant-step-heading .section-title {
  font-size: 23px;
  min-width: 0;
}
.assistant-step {
  color: var(--jf-gold);
  font-size: 14px;
  letter-spacing: 1px;
}
.assistant-description {
  display: block;
  font-size: 14px;
  line-height: 1.85;
  color: var(--jf-muted);
  margin-bottom: 22px;
}
.assistant-example-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 22px;
}
.assistant-example-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: transparent;
  border: 1px solid var(--jf-border);
  border-radius: 0;
  margin: 0;
  padding: 12px 14px;
  font-size: 14px;
  text-align: left;
  line-height: 1.65;
  color: var(--jf-ink);
}
.assistant-example-button.selected {
  border-color: var(--jf-gold);
  background: var(--jf-paper);
}
.assistant-example-button > text {
  flex-shrink: 0;
  color: var(--jf-red);
}
.assistant-prompt-field {
  width: 100%;
  box-sizing: border-box;
  min-height: 140px;
  height: 160px;
  padding: 16px;
  border: 1px solid var(--jf-border);
  font-size: 15px;
  line-height: 1.85;
  background: var(--jf-surface);
}
.assistant-input-count {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--jf-muted);
  margin: 9px 0 18px;
}
.assistant-input-count > text:last-child {
  white-space: nowrap;
}
.assistant-input-warning {
  border-left: 2px solid var(--jf-gold);
  background: var(--jf-paper);
  font-size: 12px;
  line-height: 1.9;
  padding: 12px;
  margin-bottom: 18px;
}
.assistant-small-note {
  display: block;
  font-size: 12px;
  color: var(--jf-muted);
  line-height: 1.9;
  margin-top: 16px;
}
.assistant-result-empty {
  min-height: 440px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 20px;
  padding: 24px;
  box-sizing: border-box;
}
.assistant-result-empty > text:last-child {
  font-size: 14px;
  color: var(--jf-muted);
  line-height: 1.95;
  max-width: 320px;
}
.assistant-empty-mark {
  border: 1px solid var(--jf-gold);
  color: var(--jf-gold);
  font-family: JiafengSerif, serif;
  font-size: 48px;
  padding: 12px 20px;
}
.assistant-result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--jf-muted);
  margin-bottom: 20px;
}
.assistant-result-field {
  width: 100%;
  height: 420px;
  min-height: 260px;
  box-sizing: border-box;
  padding: 18px;
  border: 1px solid var(--jf-border);
  font-size: 16px;
  line-height: 2;
  background: var(--jf-surface);
  color: var(--jf-ink);
}
.assistant-help-answer {
  display: block;
  white-space: pre-wrap;
  line-height: 2;
  font-size: 15px;
  padding: 16px 0;
}
.assistant-comparison-original {
  padding: 18px;
  background: var(--jf-paper);
  border-left: 2px solid var(--jf-gold);
  line-height: 1.95;
  font-size: 14px;
  white-space: pre-wrap;
  margin-bottom: 22px;
}
.assistant-review-notes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--jf-border);
  padding-top: 18px;
  margin-top: 24px;
  font-size: 13px;
  line-height: 1.9;
  color: var(--jf-muted);
}
.assistant-review-notes .field-label {
  margin: 0;
  color: var(--jf-ink);
}
.assistant-review-notes .text-button {
  text-align: left;
  white-space: normal;
}
.assistant-result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}
.assistant-help-links {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.assistant-bottom-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-top: 1px solid var(--jf-border);
  padding-top: 24px;
  margin-top: 32px;
  font-size: 14px;
  line-height: 1.8;
}
.assistant-manuscript {
  position: relative;
  margin: 24px 0;
  padding: 22px;
  background:
    repeating-linear-gradient(transparent, transparent 35px, #ded6c8 35px, #ded6c8 36px),
    var(--jf-paper);
  border: 1px solid var(--jf-gold);
}
.assistant-manuscript-label {
  display: block;
  background: var(--jf-paper);
  font-size: 10px;
  color: var(--jf-muted);
  line-height: 1.7;
  margin-bottom: 18px;
}
.assistant-manuscript-text {
  display: block;
  font-family: JiafengSerif, serif;
  font-size: 20px;
  line-height: 36px;
  white-space: pre-wrap;
  letter-spacing: 1px;
}
.assistant-manuscript-seal {
  display: block;
  width: fit-content;
  border: 1px solid var(--jf-red);
  color: var(--jf-red);
  font-size: 11px;
  letter-spacing: 2px;
  margin: 18px 0 0 auto;
  padding: 3px 8px;
  background: var(--jf-paper);
}
.assistant-transfer-dialog {
  max-height: 78vh;
  overflow-y: auto;
  box-sizing: border-box;
}
.assistant-draft-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 22px 0;
}
.assistant-draft-comparison > view {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--jf-border);
  background: var(--jf-paper);
  min-width: 0;
  font-size: 14px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}
.assistant-draft-comparison .field-label {
  margin: 0;
}
.assistant-transfer-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.assistant-replace-action {
  white-space: normal;
  text-align: center;
  line-height: 1.8;
  padding: 10px;
  font-size: 12px;
}
.assistant-result-panel .field-error {
  display: block;
  line-height: 1.8;
  margin-top: 16px;
}
@media (max-width: 850px) {
  .assistant-layout {
    grid-template-columns: 1fr;
  }
  .assistant-mode-tabs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .assistant-mode-button {
    padding: 14px 8px;
  }
  .assistant-input-panel,
  .assistant-result-panel {
    padding: 22px;
  }
  .assistant-result-empty {
    min-height: 280px;
  }
  .assistant-bottom-note {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}
@media (max-width: 480px) {
  .assistant-mode-tabs {
    gap: 8px;
  }
  .assistant-mode-button {
    flex-direction: column;
    gap: 5px;
    font-size: 12px;
    padding: 12px 6px;
  }
  .assistant-mode-symbol {
    font-size: 21px;
  }
  .assistant-input-panel,
  .assistant-result-panel {
    padding: 18px;
  }
  .assistant-step-heading .section-title {
    font-size: 21px;
  }
  .assistant-demo-note {
    padding: 16px;
    gap: 12px;
    font-size: 12px;
  }
  .assistant-demo-mark {
    font-size: 25px;
  }
  .assistant-result-field {
    height: 440px;
    font-size: 15px;
  }
  .assistant-result-actions {
    gap: 10px;
  }
  .assistant-result-actions :deep(.wd-button) {
    max-width: 100%;
  }
  .assistant-draft-comparison {
    grid-template-columns: 1fr;
  }
  .assistant-input-count {
    font-size: 10px;
  }
  .assistant-manuscript-text {
    font-size: 18px;
  }
}
</style>

<style scoped>
.storyboard-preview {
  margin: 20px 0;
}
.storyboard-frame {
  display: grid;
  grid-template-columns: 105px minmax(0, 1fr);
  gap: 12px;
  padding: 12px;
  margin: 12px 0;
  border: 1px solid #c9a96e;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
}
.storyboard-visual {
  min-height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  align-items: center;
  background: #f5f0e8;
  text-align: center;
  font-size: 11px;
}
.storyboard-visual text:first-child {
  font-size: 32px;
  font-weight: 600;
  color: #c41a1a;
}
.assistant-compliance-status {
  padding: 14px;
  background: #f5f0e8;
  border-left: 3px solid #c41a1a;
  font-size: 13px;
  line-height: 1.8;
  margin: 18px 0;
}
.assistant-compliance-status text {
  display: block;
}
@media (max-width: 420px) {
  .storyboard-frame {
    grid-template-columns: minmax(0, 1fr);
  }
  .storyboard-visual {
    min-height: 70px;
  }
}
</style>

<style scoped>
.assistant-layout.assistant-chat-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.assistant-chat-primary {
  min-width: 0;
}
.assistant-editor-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 20px;
  background: #f5f0e8;
  border: 1px solid #dfd2bd;
}
.assistant-editor-toggle > view {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 15px;
  font-weight: 600;
}
.assistant-editor-toggle > view text + text {
  font-size: 12px;
  font-weight: 400;
  color: #65615a;
}
.assistant-chat-layout .assistant-result-panel {
  border: 1px solid #dfd2bd;
  background: #fffdfa;
}
</style>
