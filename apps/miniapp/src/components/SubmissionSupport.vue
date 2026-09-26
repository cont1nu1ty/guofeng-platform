<script setup lang="ts">
import { isHttpMode } from '../config/dataMode'
import { command, remoteWorkspace, remoteUser } from '../services/api'
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
const demoFaq = [
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
const busy = ref(false)
const error = ref('')
const ticketCategory = ref('submission')
const faq = computed(() =>
  isHttpMode
    ? [
        {
          ...demoFaq[0]!,
          answer:
            '登录后正文与选项保存到账号云草稿；上传成功的附件保留 fileId。跨设备冲突会提示重新加载，不会静默覆盖。',
          answerEn:
            'Signed-in drafts are saved to your account. Uploaded attachments retain their file IDs. Conflicts require reloading rather than silent overwrites.',
        },
        demoFaq[1]!,
        {
          ...demoFaq[2]!,
          answer: '当前连接真实后台，投稿与附件会保存。版权确认只记录确认行为，不是正式电子签章。',
          answerEn:
            'This mode saves submissions and files to the backend. Copyright confirmation records your acknowledgement; it is not a formal electronic signature.',
        },
      ]
    : demoFaq,
)
function ask(index: number) {
  const item = faq.value[index]!
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
  const answer = index >= 0 ? faq.value[index] : undefined
  messages.value.push({
    question,
    zh:
      answer?.answer ??
      (isHttpMode
        ? '本机帮助暂没有匹配的回答。可以提交问题单，由运营在后台处理。'
        : '本机帮助暂没有匹配的回答。可选择上方常见问题，或填写转人工演示单，查看后续处理界面。'),
    en:
      answer?.answerEn ??
      (isHttpMode
        ? 'No matching local answer is available. Submit a support ticket for an editor to respond.'
        : 'No matching local answer is available. Choose a question above or open the handoff sample to preview the support process.'),
  })
  questionVersion.value++
  input.value = ''
}
async function requestHandoff() {
  if (handoffNote.value.trim().length < 5 || busy.value) return
  if (!isHttpMode) {
    queued.value = true
    return
  }
  busy.value = true
  error.value = ''
  try {
    if (!remoteUser.value)
      throw new Error(t('请先登录后提交问题。', 'Sign in to submit a question.'))
    await command('support.create', undefined, {
      subject: handoffNote.value.trim().slice(0, 80),
      body: handoffNote.value.trim(),
      category: ticketCategory.value,
    })
    handoffNote.value = ''
    handoff.value = false
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : t('提交失败，请重试', 'Request failed. Please retry.')
  } finally {
    busy.value = false
  }
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
        <button
          class="support-question-option"
          v-for="(item, index) in faq"
          :key="index"
          @click="ask(index)"
        >
          {{ t(item.zh, item.en) }}
        </button>
      </view>
      <view v-for="(item, index) in messages" :key="index" class="support-exchange">
        <text class="support-question">{{ item.question }}</text>
        <text>{{ t(item.zh, item.en) }}</text>
      </view>
      <input
        class="support-question-input"
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
          {{
            isHttpMode
              ? t('提交问题单', 'Contact support')
              : t('转人工演示', 'Preview agent handoff')
          }}
        </wd-button>
      </view>
      <view v-if="handoff" class="support-handoff">
        <text>
          {{
            isHttpMode
              ? t(
                  '问题单将保存到当前账号，由区域运营处理；回复可在此处查看，不通过邮件发送。',
                  'Tickets are saved to your account for regional editors. Responses appear here; no email is sent.',
                )
              : t(
                  '填写问题，预览转人工申请状态。没有客服人员接单，也不会实际发送。',
                  'Describe your issue to preview a handoff status. No agent receives this request and nothing is sent.',
                )
          }}
        </text>
        <view v-if="isHttpMode" class="support-questions">
          <wd-button
            v-for="item in [
              { id: 'submission', zh: '投稿', en: 'Submission' },
              { id: 'review', zh: '评审', en: 'Review' },
              { id: 'activity', zh: '活动', en: 'Activity' },
              { id: 'other', zh: '其他', en: 'Other' },
            ]"
            :key="item.id"
            size="small"
            :variant="ticketCategory === item.id ? 'base' : 'plain'"
            @click="ticketCategory = item.id"
          >
            {{ t(item.zh, item.en) }}
          </wd-button>
        </view>
        <textarea
          class="support-handoff-input"
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
          :disabled="busy || handoffNote.trim().length < 5"
          @click="requestHandoff"
        >
          {{
            isHttpMode
              ? busy
                ? t('提交中…', 'Submitting…')
                : t('提交问题', 'Submit ticket')
              : t('预览申请结果', 'Preview request result')
          }}
        </wd-button>
        <view v-else class="support-queued">
          <text class="support-queued-copy">
            {{
              t(
                '演示申请已生成 · 待人工处理（示例状态）',
                'Sample request created · Awaiting agent (sample state)',
              )
            }}
          </text>
          <text class="support-queued-copy">{{ handoffNote }}</text>
          <button class="text-button" @click="queued = false">
            {{ t('修改说明', 'Edit description') }}
          </button>
          <button class="text-button" @click="handoff = false">
            {{ t('收起申请', 'Close request') }}
          </button>
        </view>
      </view>
      <text v-if="error" class="scope-note">{{ error }}</text>
      <view v-if="isHttpMode" class="support-tickets">
        <text class="section-title">{{ t('我的问题与回复', 'My tickets and replies') }}</text>
        <text v-if="!remoteWorkspace.supportTickets.length" class="scope-note">
          {{ t('暂无问题单', 'No tickets yet') }}
        </text>
        <view
          v-for="ticket in remoteWorkspace.supportTickets"
          :key="ticket.id"
          class="support-exchange"
        >
          <text class="support-question">{{ ticket.subject }} · {{ ticket.status }}</text>
          <text>{{ ticket.body }}</text>
          <text v-if="ticket.reply">
            {{ t('运营回复：', 'Editor response: ') }}{{ ticket.reply }}
          </text>
          <text v-else>{{ t('等待处理', 'Awaiting response') }}</text>
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
.support-questions .support-question-option {
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
.support-content .support-question-input {
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
.support-handoff .support-handoff-input {
  width: 100%;
  height: 95px;
  margin: 12px 0;
  background: #fffdfa;
  padding: 8px;
  box-sizing: border-box;
}
.support-queued .support-queued-copy {
  display: block;
  margin: 10px 0;
}
</style>
