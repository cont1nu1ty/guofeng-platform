<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, reactive, ref, watch } from 'vue'
import { t, locale } from '../composables/useLocale'
import { largeText } from '../composables/useDemo'
import { readInputValue } from '../composables/readInputValue'
import { getAssistantTool } from '../domain/assistantExamples'
import type { AssistantMode } from '../domain/personalArchive'
import {
  conversationSuggestions,
  replyToConversation,
  MAX_CHAT_INPUT,
  MAX_CONVERSATION_TURNS,
  type ConversationMessage,
  type ConversationReply,
} from '../domain/localConversation'
const props = withDefaults(
  defineProps<{
    mode: AssistantMode
    compact?: boolean
    append?: boolean
    draftTitle?: string
    draftText?: string
  }>(),
  { compact: false, append: false },
)
const emit = defineEmits<{ use: [reply: ConversationReply] }>()
interface Session {
  messages: ConversationMessage[]
  input: string
  version: number
  error: string
}
const sessions = reactive<Partial<Record<AssistantMode, Session>>>({})
function session(mode: AssistantMode): Session {
  return sessions[mode] ?? (sessions[mode] = { messages: [], input: '', version: 0, error: '' })
}
const current = computed(() => session(props.mode))
const instance = getCurrentInstance()
const prefix = `chat-${instance?.uid ?? 'local'}`
const inputId = `${prefix}-input`
const tailId = computed(() => `${prefix}-${props.mode}-tail`)
const scrollTo = ref('')
const clearing = ref(false)
const pendingUse = ref('')
const copying = ref('')
const copied = ref('')
const copyError = ref('')
const used = ref('')
let sequence = 0
const bindings = computed(() => [
  {
    owner: props.mode,
    version: current.value.version,
    key: `${props.mode}-${current.value.version}`,
  },
])
const hasReply = computed(() => current.value.messages.some((item) => !!item.reply?.content))
const suggestions = computed(() =>
  conversationSuggestions(props.mode, locale.value, hasReply.value),
)
const tool = computed(() => getAssistantTool(props.mode))
async function scrollLatest() {
  scrollTo.value = ''
  await nextTick()
  scrollTo.value = tailId.value
}
function updateInput(event: unknown, binding: { owner: AssistantMode; version: number }) {
  const owner = session(binding.owner)
  if (owner.version !== binding.version) return
  owner.input = readInputValue(event, owner.input)
  owner.error = ''
}
function finishInput(event: unknown, binding: { owner: AssistantMode; version: number }) {
  if (session(binding.owner).version !== binding.version) return
  updateInput(event, binding)
  session(binding.owner).version++
}
function readLatestInput() {
  // Uni H5 throttles model input events; reading the visible control avoids losing the final keystrokes.
  // #ifdef H5
  const control = document.getElementById(inputId)?.querySelector('textarea')
  if (control) current.value.input = control.value
  // #endif
}
function send(exampleId?: string, prompt?: string) {
  readLatestInput()
  const owner = current.value
  const input = (prompt ?? owner.input).trim()
  if (!input) {
    owner.error = t(
      '请先写一句想法或选择快捷问题。',
      'Write an idea or choose a quick question first.',
    )
    return
  }
  if (
    owner.messages.filter((message) => message.role === 'user').length >= MAX_CONVERSATION_TURNS
  ) {
    owner.error = t(
      '当前对话已满20轮，请先复制或使用需要的内容，再开始新对话。',
      'This conversation has reached 20 turns. Copy or use the passages you need, then start a new conversation.',
    )
    return
  }
  try {
    const reply = replyToConversation({
      mode: props.mode,
      input,
      language: locale.value,
      history: owner.messages,
      exampleId,
      draftTitle: props.draftTitle,
      draftText: props.draftText,
    })
    owner.messages.push(
      { id: `${prefix}-user-${++sequence}`, role: 'user', text: input },
      { id: `${prefix}-assistant-${++sequence}`, role: 'assistant', text: reply.text, reply },
    )
    owner.version++
    if (prompt === undefined) owner.input = ''
    owner.error = ''
    pendingUse.value = ''
    clearing.value = false
    void scrollLatest()
  } catch {
    owner.error = t(
      '内容超过2000字，请精简后发送。',
      'Please keep the message within 2,000 characters.',
    )
  }
}
function confirmInput(event: unknown, binding: { owner: AssistantMode; version: number }) {
  if (binding.owner !== props.mode || session(binding.owner).version !== binding.version) return
  updateInput(event, binding)
  send()
}
function copyMessage(message: ConversationMessage) {
  if (copying.value) return
  const content = message.reply?.content ?? message.text
  copying.value = message.id
  copyError.value = ''
  copied.value = ''
  try {
    uni.setClipboardData({
      data: content,
      showToast: false,
      success: () => {
        copied.value = message.id
      },
      fail: () => {
        copyError.value = message.id
      },
      complete: () => {
        copying.value = ''
      },
    })
  } catch {
    copying.value = ''
    copyError.value = message.id
  }
}
function useMessage(message: ConversationMessage) {
  if (!message.reply?.content) return
  emit('use', message.reply)
  pendingUse.value = ''
  used.value = message.id
}
function clearConversation() {
  const owner = current.value
  owner.version++
  owner.messages = []
  owner.input = ''
  owner.error = ''
  clearing.value = false
  pendingUse.value = ''
  used.value = ''
  copied.value = ''
  copyError.value = ''
  void scrollLatest()
}
watch(
  () => props.mode,
  (next, previous) => {
    session(previous).version++
    session(next).version++
    clearing.value = false
    pendingUse.value = ''
    void scrollLatest()
  },
)
watch(locale, () => {
  current.value.error = ''
  clearing.value = false
})
</script>
<template>
  <view :class="['conversation-panel', { compact, 'conversation-large': largeText }]">
    <view class="conversation-heading">
      <view>
        <text class="conversation-title">
          {{ t('家风助手对话', 'Family-values conversation') }}
        </text>
        <text class="conversation-mode">{{ t(tool.label.zh, tool.label.en) }}</text>
      </view>
      <button class="conversation-reset" @click="clearing = !clearing">
        {{ t('新对话', 'New conversation') }}
      </button>
    </view>
    <text class="conversation-disclosure">
      {{
        t(
          '本地对话演示 · 未连接AI模型；消息只保留在本次页面会话。',
          'Local conversation demo · No AI model. Messages remain only in this page session.',
        )
      }}
    </text>
    <view v-if="clearing" class="conversation-clear-confirm">
      <text>
        {{
          t(
            '清空当前模式的对话与输入？已存档内容和投稿草稿不会改动。',
            'Clear this tool’s messages and input? Saved samples and contribution drafts stay unchanged.',
          )
        }}
      </text>
      <view>
        <wd-button size="small" @click="clearConversation">
          {{ t('确认开始新对话', 'Start a new conversation') }}
        </wd-button>
        <wd-button variant="text" size="small" @click="clearing = false">
          {{ t('继续当前对话', 'Keep this conversation') }}
        </wd-button>
      </view>
    </view>
    <scroll-view
      scroll-y
      :scroll-into-view="scrollTo"
      class="conversation-history"
      aria-live="polite"
    >
      <view v-if="!current.messages.length" class="conversation-message assistant">
        <text class="conversation-speaker">{{ t('家风助手', 'Assistant') }}</text>
        <view class="conversation-bubble">
          <text>
            {{
              t(
                '你好，想从哪一件家里的小事聊起？你可以直接输入想法，也可以选下方问题。',
                'Hello. Which everyday family moment would you like to talk about? Write an idea or choose a question below.',
              )
            }}
          </text>
        </view>
      </view>
      <view
        v-for="message in current.messages"
        :key="message.id"
        :class="['conversation-message', message.role]"
        :data-role="message.role"
      >
        <text class="conversation-speaker">
          {{ message.role === 'user' ? t('我', 'You') : t('家风助手', 'Assistant') }}
        </text>
        <view class="conversation-bubble">
          <text selectable>{{ message.text }}</text>
          <view v-if="message.role === 'assistant'" class="conversation-message-actions">
            <button @click="copyMessage(message)">
              {{
                copied === message.id
                  ? t('已复制', 'Copied')
                  : copying === message.id
                    ? t('复制中…', 'Copying…')
                    : t('复制', 'Copy')
              }}
            </button>
            <button
              v-if="message.reply?.content"
              @click="pendingUse = pendingUse === message.id ? '' : message.id"
            >
              {{
                append ? t('追加到正文', 'Append to draft') : t('使用这段内容', 'Use this passage')
              }}
            </button>
          </view>
          <text v-if="copyError === message.id" class="conversation-feedback">
            {{
              t(
                '复制失败，可长按选择文字后手动复制。',
                'Copy failed. Select the text to copy it manually.',
              )
            }}
          </text>
          <view v-if="pendingUse === message.id" class="conversation-use-confirm">
            <text>
              {{
                append
                  ? t(
                      '把这段内容追加到正文末尾，保留原稿与格式。',
                      'Append this passage at the end, retaining your original text and formatting.',
                    )
                  : t(
                      '将这段内容送到下方编辑区；如已有编辑内容，会替换编辑区，不改动投稿草稿。',
                      'Send this passage to the work area below. It replaces that area’s text, but does not change your contribution draft.',
                    )
              }}
            </text>
            <view>
              <wd-button size="small" @click="useMessage(message)">
                {{
                  append
                    ? t('确认追加，保留原稿', 'Confirm append, keep original')
                    : t('确认使用', 'Confirm use')
                }}
              </wd-button>
              <wd-button variant="text" size="small" @click="pendingUse = ''">
                {{ t('取消', 'Cancel') }}
              </wd-button>
            </view>
          </view>
          <text v-if="used === message.id && !pendingUse" class="conversation-feedback">
            {{
              append
                ? t(
                    '已将追加请求交给正文编辑区，请查看页面提示。',
                    'The append request was sent to the editor. Check the page feedback.',
                  )
                : t(
                    '已放入下方编辑区，可编辑、存档或复制。',
                    'Ready in the work area below to edit, save or copy.',
                  )
            }}
          </text>
        </view>
      </view>
      <view :id="tailId" class="conversation-tail" />
    </scroll-view>
    <view class="conversation-quick-questions">
      <button
        v-for="(item, index) in suggestions"
        :key="index"
        @click="send(item.exampleId, item.prompt)"
      >
        {{ item.label }}
      </button>
      <button
        v-if="append"
        @click="
          send(
            undefined,
            t('结合我的当前稿件，给一点写作灵感', 'Use my current draft to suggest a writing idea'),
          )
        "
      >
        {{ t('参考当前稿件', 'Use current draft') }}
      </button>
    </view>
    <view class="conversation-composer">
      <textarea
        v-for="binding in bindings"
        :id="inputId"
        :key="binding.key"
        :value="current.input"
        :maxlength="MAX_CHAT_INPUT"
        :aria-label="t('对话输入', 'Conversation input')"
        :placeholder="
          t(
            '例如：想给爸爸写封关于守信的家书',
            'For example: a letter to Dad about keeping promises',
          )
        "
        confirm-type="send"
        @input="updateInput($event, binding)"
        @blur="finishInput($event, binding)"
        @confirm="confirmInput($event, binding)"
      />
      <view class="conversation-send-row">
        <text>{{ current.input.length }} / {{ MAX_CHAT_INPUT }}</text>
        <wd-button size="small" @click="send()">{{ t('发送', 'Send') }} ↑</wd-button>
      </view>
      <text v-if="current.error" class="conversation-error" role="alert">{{ current.error }}</text>
    </view>
  </view>
</template>
<style scoped>
.conversation-panel {
  min-width: 0;
  border: 1px solid var(--jf-border, #dfd2bd);
  border-radius: 12px;
  background: var(--jf-surface, #fffdfa);
  overflow: hidden;
}
.conversation-heading {
  padding: 20px 22px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.conversation-heading > view {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 12px;
}
.conversation-title {
  font-size: 20px;
  font-family: JiafengSerif, serif;
  font-weight: 600;
  color: #2c2c2c;
}
.conversation-mode {
  font-size: 12px;
  color: #c41a1a;
}
.conversation-reset {
  margin: 0;
  flex-shrink: 0;
  padding: 6px 9px;
  font-size: 12px;
  line-height: 1.8;
  color: #c41a1a;
  background: transparent;
}
.conversation-disclosure {
  display: block;
  padding: 0 22px 14px;
  font-size: 12px;
  line-height: 1.7;
  color: #65615a;
}
.conversation-history {
  height: 450px;
  background: #f5f0e8;
  border-top: 1px solid #e5daca;
  border-bottom: 1px solid #e5daca;
}
.conversation-message {
  padding: 18px 22px 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
.conversation-message.user {
  align-items: flex-end;
}
.conversation-speaker {
  margin-bottom: 6px;
  font-size: 11px;
  color: #65615a;
}
.conversation-bubble {
  max-width: 88%;
  box-sizing: border-box;
  padding: 15px 17px;
  border: 1px solid #e5daca;
  border-radius: 2px 12px 12px 12px;
  background: #fffdfa;
  color: #2c2c2c;
  font-size: 15px;
  line-height: 1.9;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.conversation-bubble > text {
  white-space: pre-wrap;
}
.user .conversation-bubble {
  background: #c41a1a;
  color: #fff;
  border-color: #c41a1a;
  border-radius: 12px 2px 12px 12px;
}
.conversation-message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 13px;
  border-top: 1px solid #ede2d2;
  padding-top: 10px;
}
.conversation-message-actions button {
  margin: 0;
  padding: 2px 8px;
  font-size: 12px;
  line-height: 1.8;
  color: #c41a1a;
  background: transparent;
}
.conversation-feedback,
.conversation-error {
  display: block;
  margin-top: 10px;
  color: #c41a1a;
  font-size: 12px;
  line-height: 1.7;
}
.conversation-tail {
  height: 18px;
}
.conversation-use-confirm,
.conversation-clear-confirm {
  font-size: 13px;
  line-height: 1.8;
  padding: 12px;
  margin-top: 10px;
  border: 1px solid #c9a96e;
  border-radius: 6px;
  background: #f5f0e8;
}
.conversation-use-confirm > view,
.conversation-clear-confirm > view {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.conversation-clear-confirm {
  margin: 0 18px 15px;
}
.conversation-use-confirm :deep(.wd-button),
.conversation-clear-confirm :deep(.wd-button) {
  max-width: 100%;
  height: auto;
  min-height: 32px;
  padding: 6px 12px;
  line-height: 1.5;
}
.conversation-use-confirm :deep(.wd-button__content),
.conversation-clear-confirm :deep(.wd-button__content),
.conversation-use-confirm :deep(.wd-button__text),
.conversation-clear-confirm :deep(.wd-button__text) {
  min-width: 0;
  white-space: normal;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.conversation-quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 14px 22px 8px;
}
.conversation-quick-questions button {
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 6px 10px;
  color: #5b4432;
  background: #f5f0e8;
  border: 1px solid #e0d4be;
  border-radius: 20px;
  font-size: 12px;
  line-height: 1.7;
  text-align: left;
  overflow-wrap: anywhere;
}
.conversation-composer {
  padding: 7px 22px 20px;
}
.conversation-composer textarea {
  width: 100%;
  height: 88px;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #c9a96e;
  border-radius: 8px;
  background: #fffdfa;
  color: #2c2c2c;
  font-size: 15px;
  line-height: 1.7;
}
.conversation-send-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  gap: 14px;
}
.conversation-send-row > text {
  font-size: 11px;
  color: #65615a;
}
.compact .conversation-heading {
  padding: 14px 12px 8px;
  align-items: flex-start;
}
.compact .conversation-title {
  font-size: 16px;
}
.compact .conversation-disclosure {
  padding: 0 12px 12px;
  font-size: 11px;
}
.compact .conversation-history {
  height: 340px;
}
.compact .conversation-message {
  padding: 13px 10px 0;
}
.compact .conversation-bubble {
  max-width: 100%;
  padding: 11px;
  font-size: 13px;
}
.compact .conversation-quick-questions {
  padding: 12px 10px 6px;
}
.compact .conversation-quick-questions button {
  padding: 4px 8px;
  font-size: 11px;
}
.compact .conversation-composer {
  padding: 6px 10px 13px;
}
.compact .conversation-composer textarea {
  font-size: 13px;
  height: 90px;
}
.conversation-large .conversation-bubble,
.conversation-large .conversation-composer textarea {
  font-size: 19px;
}
.conversation-large .conversation-composer textarea {
  height: 126px;
}
.conversation-large .conversation-quick-questions button {
  font-size: 15px;
}
@media (max-width: 600px) {
  .conversation-heading {
    padding: 15px 12px 8px;
    align-items: flex-start;
  }
  .conversation-title {
    font-size: 17px;
  }
  .conversation-disclosure {
    padding: 0 12px 12px;
  }
  .conversation-message {
    padding: 14px 10px 0;
  }
  .conversation-bubble {
    max-width: 100%;
    padding: 12px;
  }
  .conversation-quick-questions {
    padding: 12px 10px 6px;
  }
  .conversation-composer {
    padding: 6px 10px 14px;
  }
  .conversation-history {
    height: 420px;
  }
}
</style>
