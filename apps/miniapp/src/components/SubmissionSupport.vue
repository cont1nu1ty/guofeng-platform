<script setup lang="ts">
import { computed, ref } from 'vue'
import { t } from '../composables/useLocale'
import { readInputValue } from '../composables/readInputValue'
const open = ref(false)
const input = ref('')
const questionVersion = ref(0)
const questionEditors = computed(() => [{ version: questionVersion.value }])
function questionInput(event: unknown, version: number) {
  if (version === questionVersion.value) input.value = readInputValue(event, input.value)
}
function questionBlur(event: unknown, version: number) {
  if (version !== questionVersion.value) return
  questionInput(event, version)
  questionVersion.value++
}
function questionConfirm(event: unknown, version: number) {
  questionBlur(event, version)
  send()
}
const messages = ref<{ question: string; zh: string; en: string }[]>([])
const handoff = ref(false)
const handoffNote = ref('')
const queued = ref(false)
const faq = [
  {
    zh: '怎样保存和找回草稿？',
    en: 'How do I save and restore a draft?',
    answer:
      '正文和选项会自动保存到当前设备。再次进入投稿可恢复。附件只保留信息，重新打开时需要重新选择文件。',
    answerEn:
      'Text and choices save automatically on this device. Return to Contribute to restore them. Attachments retain metadata only; select files again after reopening.',
  },
  {
    zh: '退回后如何修改重投？',
    en: 'How do I revise a returned work?',
    answer:
      '在个人中心打开退回修改的作品，点击修改重投。原作品编号和评审意见会保留，提交后版本增加。',
    answerEn:
      'Open a returned work in My account and select Revise and resubmit. Its ID and review history remain, and the revision number increases.',
  },
  {
    zh: '投稿会上传到真实平台吗？',
    en: 'Will this be submitted to a real platform?',
    answer: '当前是前端演示，投稿、附件和此客服对话均不会发往真实平台。请使用虚构署名和演示材料。',
    answerEn:
      'This is a frontend demo. Submissions, files and this conversation are not sent to a real platform. Use fictional names and sample materials.',
  },
]
function ask(index: number) {
  const item = faq[index]!
  messages.value.push({ question: t(item.zh, item.en), zh: item.answer, en: item.answerEn })
}
function send() {
  const question = input.value.trim()
  if (!question) return
  const index = /草稿|draft|save/i.test(question)
    ? 0
    : /退回|重投|return|revis/i.test(question)
      ? 1
      : /上传|平台|upload|real|platform/i.test(question)
        ? 2
        : -1
  const answer = index >= 0 ? faq[index] : undefined
  messages.value.push({
    question,
    zh:
      answer?.answer ??
      '本机帮助暂没有匹配的回答。可选择上方常见问题，或填写转人工演示单，查看后续处理界面。',
    en:
      answer?.answerEn ??
      'No matching local answer is available. Choose a question above or open the handoff sample to preview the support process.',
  })
  questionVersion.value++
  input.value = ''
}
function requestHandoff() {
  if (handoffNote.value.trim().length >= 5) queued.value = true
}
</script>
<template>
  <view class="submission-support">
    <button class="text-button" @click="open = !open">
      {{ t('投稿客服与常见问题', 'Submission support and FAQs') }} {{ open ? '−' : '+' }}
    </button>
    <view v-if="open" class="support-content">
      <text class="support-notice">
        {{
          t(
            '本机会话 · 根据关键词匹配帮助条目，不是实时 AI 或人工客服。离开页面后会话不保存。',
            'Local conversation · Help is matched by keyword, not live AI or a support agent. The conversation is not saved after leaving.',
          )
        }}
      </text>
      <view class="support-questions">
        <button v-for="(item, index) in faq" :key="index" @click="ask(index)">
          {{ t(item.zh, item.en) }}
        </button>
      </view>
      <view v-for="(item, index) in messages" :key="index" class="support-exchange">
        <text class="support-question">{{ item.question }}</text>
        <text>{{ t(item.zh, item.en) }}</text>
      </view>
      <input
        v-for="editor in questionEditors"
        :key="editor.version"
        :value="input"
        @input="questionInput($event, editor.version)"
        maxlength="300"
        :placeholder="
          t('输入草稿、退回或投稿相关问题', 'Ask about drafts, revisions or submissions')
        "
        @blur="questionBlur($event, editor.version)"
        @confirm="questionConfirm($event, editor.version)"
      />
      <view class="support-actions">
        <wd-button size="small" :disabled="!input.trim()" @click="send">
          {{ t('查看本机答复', 'Get a local answer') }}
        </wd-button>
        <wd-button variant="plain" size="small" @click="handoff = !handoff">
          {{ t('转人工演示', 'Preview agent handoff') }}
        </wd-button>
      </view>
      <view v-if="handoff" class="support-handoff">
        <text>
          {{
            t(
              '填写问题，预览转人工申请状态。没有客服人员接单，也不会实际发送。',
              'Describe your issue to preview a handoff status. No agent receives this request and nothing is sent.',
            )
          }}
        </text>
        <textarea
          v-if="!queued"
          v-model="handoffNote"
          :maxlength="500"
          @blur="handoffNote = readInputValue($event, handoffNote)"
          :placeholder="
            t(
              '至少5字的问题说明，请勿填写电话等私人信息',
              'Describe the issue in at least 5 characters. Do not enter private contact details.',
            )
          "
        />
        <wd-button
          v-if="!queued"
          size="small"
          :disabled="handoffNote.trim().length < 5"
          @click="requestHandoff"
        >
          {{ t('预览申请结果', 'Preview request result') }}
        </wd-button>
        <view v-else class="support-queued">
          <text>
            {{
              t(
                '演示申请已生成 · 待人工处理（示例状态）',
                'Sample request created · Awaiting agent (sample state)',
              )
            }}
          </text>
          <text>{{ handoffNote }}</text>
          <button class="text-button" @click="queued = false">
            {{ t('修改说明', 'Edit description') }}
          </button>
          <button class="text-button" @click="handoff = false">
            {{ t('收起申请', 'Close request') }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>
<style scoped>
.submission-support {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #c9a96e;
}
.support-content {
  margin-top: 12px;
  min-width: 0;
}
.support-notice {
  display: block;
  font-size: 12px;
  color: #525252;
  line-height: 1.8;
}
.support-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.support-questions button {
  margin: 0;
  font-size: 12px;
  padding: 5px 9px;
  line-height: 1.7;
  color: #c41a1a;
  background: #f5f0e8;
}
.support-exchange {
  margin: 14px 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 14px;
  line-height: 1.8;
}
.support-question {
  background: #f5f0e8;
  padding: 8px;
  font-weight: 600;
}
.support-content input {
  height: 44px;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid #c9a96e;
  border-radius: 4px;
  font-size: 14px;
}
.support-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
.support-handoff {
  margin-top: 18px;
  padding: 12px;
  background: #f5f0e8;
  font-size: 13px;
  line-height: 1.8;
}
.support-handoff textarea {
  width: 100%;
  height: 95px;
  margin: 12px 0;
  background: #fffdfa;
  padding: 8px;
  box-sizing: border-box;
}
.support-queued text {
  display: block;
  margin: 10px 0;
}
</style>
