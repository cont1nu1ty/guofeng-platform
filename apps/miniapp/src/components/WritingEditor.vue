<script setup lang="ts">
import { getCurrentInstance, ref, onUnmounted } from 'vue'
import { cleanWritingDelta, writingText, type WritingDelta } from '../domain/writingTools'
import { t } from '../composables/useLocale'
// #ifdef H5
import '../vendor/quill-1.3.7.js'
// #endif
const props = defineProps<{ text: string; delta?: WritingDelta }>()
const emit = defineEmits<{ change: [value: { content: string; contentDelta: WritingDelta }] }>()
const instance = getCurrentInstance()
type WritingContext = Omit<UniApp.EditorContext, 'format'> & {
  format: (name: string, value: string | number | boolean) => void
}
let context: WritingContext | undefined
let active = true
const ready = ref(false)
const failed = ref(false)
const status = ref<Record<string, unknown>>({})
const fallback = ref(props.text)
const tooLong = ref(false)
let acceptedDelta = cleanWritingDelta(props.delta, props.text)
const timeout = setTimeout(() => {
  if (!ready.value) failed.value = true
}, 5000)
onUnmounted(() => {
  active = false
  clearTimeout(timeout)
})
function accept(event: unknown) {
  if (!active) return
  const detail = (event as { detail?: { delta?: unknown; text?: string } })?.detail
  if (!detail?.delta) return
  if (typeof detail.text === 'string' && [...detail.text.replace(/\n$/, '')].length > 10000) {
    tooLong.value = true
    context?.setContents({ delta: acceptedDelta })
    return
  }
  tooLong.value = false
  const contentDelta = cleanWritingDelta(detail.delta)
  acceptedDelta = contentDelta
  fallback.value = writingText(contentDelta)
  emit('change', { content: writingText(contentDelta), contentDelta })
}
function initialize() {
  uni
    .createSelectorQuery()
    .in(instance?.proxy)
    .select('#contribution-editor')
    .context((result) => {
      if (!active || Array.isArray(result) || !result.context) return
      context = result.context as WritingContext
      context.setContents({
        delta: cleanWritingDelta(props.delta, props.text),
        success: () => {
          ready.value = true
          failed.value = false
        },
      })
    })
    .exec()
}
function format(name: string, value: string | number | boolean = true) {
  context?.format(name, status.value[name] === value ? false : value)
}
function syncStatus(event: unknown) {
  status.value = (event as { detail?: Record<string, unknown> })?.detail ?? {}
}
function plainInput(event: unknown) {
  const value = (event as { detail?: { value?: string } })?.detail?.value
  if (typeof value !== 'string') return
  fallback.value = value
  emit('change', { content: value, contentDelta: cleanWritingDelta(undefined, value) })
}
</script>
<template>
  <view class="writing-rich-shell">
    <view class="writing-rich-toolbar" @touchend.stop>
      <button
        class="writing-format-button"
        :class="{ active: status.bold }"
        :disabled="!ready"
        @click="format('bold')"
      >
        {{ t('加粗', 'Bold') }}
      </button>
      <button
        class="writing-format-button"
        :class="{ active: status.italic }"
        :disabled="!ready"
        @click="format('italic')"
      >
        {{ t('斜体', 'Italic') }}
      </button>
      <button
        class="writing-format-button"
        :class="{ active: status.underline }"
        :disabled="!ready"
        @click="format('underline')"
      >
        {{ t('下划线', 'Underline') }}
      </button>
      <button
        class="writing-format-button"
        :class="{ active: status.header }"
        :disabled="!ready"
        @click="format('header', 2)"
      >
        {{ t('小标题', 'Heading') }}
      </button>
      <button
        class="writing-format-button"
        :class="{ active: status.list }"
        :disabled="!ready"
        @click="format('list', 'bullet')"
      >
        {{ t('列表', 'List') }}
      </button>
      <button class="writing-format-button" :disabled="!ready" @click="context?.undo({})">
        {{ t('撤销', 'Undo') }}
      </button>
      <button class="writing-format-button" :disabled="!ready" @click="context?.removeFormat({})">
        {{ t('清除格式', 'Clear format') }}
      </button>
    </view>
    <text v-if="tooLong" class="writing-limit-error">
      {{
        t(
          '正文已达10000字，超长输入未添加；已保留此前内容。',
          'The body is limited to 10,000 characters. The oversized input was not added; previous content is retained.',
        )
      }}
    </text>
    <editor
      v-if="!failed"
      id="contribution-editor"
      class="contribution-rich-editor"
      :placeholder="
        t(
          '从一段回忆、一句家训或一封家书开始……',
          'Begin with a memory, family principle or letter…',
        )
      "
      @ready="initialize"
      @input="accept"
      @blur="accept"
      @statuschange="syncStatus"
    />
    <view v-else class="writing-editor-fallback">
      <text class="writing-fallback-copy">
        {{
          t(
            '富文本暂不可用，可继续使用纯文本编辑，原稿仍保留。',
            'Rich text is unavailable. Continue in plain text; your draft is retained.',
          )
        }}
      </text>
      <textarea
        class="writing-fallback-input"
        :value="fallback"
        :maxlength="10000"
        @input="plainInput"
        @blur="plainInput"
      />
    </view>
  </view>
</template>
<style scoped>
.writing-rich-shell {
  border: 1px solid #c9a96e;
  border-radius: 8px;
  overflow: hidden;
  min-width: 0;
  background: #fffdfa;
}
.writing-rich-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 9px;
  border-bottom: 1px solid #e6dbc6;
}
.writing-rich-toolbar .writing-format-button {
  margin: 0;
  padding: 5px 9px;
  font-size: 12px;
  line-height: 1.7;
  background: #f5f0e8;
  color: #2c2c2c;
}
.writing-rich-toolbar .writing-format-button.active {
  background: #c41a1a;
  color: #fff;
}
.contribution-rich-editor {
  box-sizing: border-box;
  min-height: 310px;
  padding: 16px;
  font-size: 16px;
  font-family: inherit;
  line-height: 1.9;
  color: #2c2c2c;
}
.writing-limit-error {
  display: block;
  padding: 10px 14px;
  font-size: 12px;
  color: #c41a1a;
  line-height: 1.7;
}
.writing-editor-fallback {
  padding: 14px;
}
.writing-editor-fallback .writing-fallback-copy {
  font-size: 13px;
  line-height: 1.6;
}
.writing-editor-fallback .writing-fallback-input {
  width: 100%;
  height: 310px;
  margin-top: 10px;
}
</style>
