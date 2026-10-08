<script setup lang="ts">
import { ref, watch } from 'vue'
import { request, currentSessionEpoch, remoteUser } from '../../services/api'
import { t } from '../../composables/useLocale'
const props = defineProps<{ claimId: string; cancelled: boolean }>()
interface FollowUp {
  id: string
  stage: string
  note: string
  quoteAmount: number | null
  quoteDescription: string
  createdAt: string
}
const events = ref<FollowUp[]>([]),
  stage = ref('pending'),
  error = ref(''),
  busy = ref(false),
  open = ref(false)
let sequence = 0
const label = (value: string) =>
  ({
    pending: t('待受理', 'Awaiting review'),
    accepted: t('已受理', 'Accepted'),
    discussion: t('沟通中', 'In discussion'),
    quoted: t('已报价', 'Quoted'),
    closed: t('已结束', 'Closed'),
  })[value] || value
async function load() {
  const serial = ++sequence,
    epoch = currentSessionEpoch()
  busy.value = true
  error.value = ''
  events.value = []
  stage.value = 'pending'
  try {
    const result = await request<{ events: FollowUp[]; stage: string }>(
      `/me/consultations/${encodeURIComponent(props.claimId)}`,
    )
    if (serial === sequence && epoch === currentSessionEpoch()) {
      events.value = result.data.events
      stage.value = result.data.stage
    }
  } catch (e) {
    if (serial === sequence && epoch === currentSessionEpoch())
      error.value =
        e instanceof Error ? e.message : t('咨询记录加载失败', 'Unable to load inquiry records')
  } finally {
    if (serial === sequence) busy.value = false
  }
}
watch(
  () => [props.claimId, remoteUser.value?.id],
  () => {
    ++sequence
    events.value = []
    stage.value = 'pending'
    open.value = false
    error.value = ''
  },
)
function toggle() {
  open.value = !open.value
  if (open.value) void load()
}
</script>
<template>
  <view class="consultation-history">
    <wd-button size="small" variant="plain" @click="toggle">
      {{
        open ? t('收起咨询跟进', 'Hide inquiry history') : t('查看咨询跟进', 'View inquiry history')
      }}
    </wd-button>
    <view v-if="open" class="consultation-events">
      <text v-if="busy" role="status">{{ t('正在读取…', 'Loading…') }}</text>
      <view v-else-if="error" role="alert">
        <text>{{ error }}</text>
        <wd-button size="small" variant="plain" @click="load">{{ t('重试', 'Retry') }}</wd-button>
      </view>
      <template v-else>
        <text>{{ cancelled ? t('已取消', 'Cancelled') : label(stage) }}</text>
        <text v-if="!events.length" class="showcase-note">
          {{ t('暂无跟进记录。', 'No follow-up has been recorded.') }}
        </text>
        <view v-for="event in events" :key="event.id" class="consultation-event">
          <text>
            {{ label(event.stage) }} · {{ event.createdAt.slice(0, 16).replace('T', ' ') }}
          </text>
          <text class="consultation-copy">{{ event.note }}</text>
          <template v-if="event.quoteAmount !== null">
            <text>
              {{ t('参考报价：人民币 ', 'Reference quote: CNY ')
              }}{{ Number(event.quoteAmount).toFixed(2) }}
            </text>
            <text class="consultation-copy">{{ event.quoteDescription }}</text>
          </template>
        </view>
        <text class="showcase-note">
          {{
            t(
              '报价用于沟通，付款、合同和物流须另行确认。',
              'Quotes are for discussion. Payment, contracts and delivery require separate agreement.',
            )
          }}
        </text>
      </template>
    </view>
  </view>
</template>
<style scoped>
.consultation-events,
.consultation-event {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.consultation-event {
  border-top: 1px solid var(--line, #e7e1d7);
  padding-top: 12px;
}
.consultation-copy {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
