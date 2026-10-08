<script setup lang="ts">
import { ref, watch } from 'vue'
import { request, remoteUser, currentSessionEpoch } from '../services/api'
import { t } from '../composables/useLocale'
interface Preferences {
  digest: 'off' | 'daily' | 'weekly'
  draftNotice: boolean
  reports: ('month' | 'quarter' | 'year')[]
}
const form = ref<Preferences>({ digest: 'off', draftNotice: true, reports: [] }),
  busy = ref(false),
  loaded = ref(false),
  error = ref(''),
  saved = ref(false)
let sequence = 0
async function load() {
  const requestId = ++sequence,
    epoch = currentSessionEpoch()
  loaded.value = false
  saved.value = false
  error.value = ''
  busy.value = false
  form.value = { digest: 'off', draftNotice: true, reports: [] }
  if (!remoteUser.value) return
  busy.value = true
  try {
    const response = await request<Preferences>('/me/delivery-preferences')
    if (requestId === sequence && epoch === currentSessionEpoch()) {
      form.value = response.data
      loaded.value = true
    }
  } catch (e) {
    if (requestId === sequence && epoch === currentSessionEpoch())
      error.value =
        e instanceof Error
          ? e.message
          : t('消息设置读取失败。', 'Message settings could not be loaded.')
  } finally {
    if (requestId === sequence) busy.value = false
  }
}
watch(() => remoteUser.value?.id, load, { immediate: true })
async function save() {
  if (!loaded.value || busy.value) return
  const epoch = currentSessionEpoch()
  busy.value = true
  error.value = ''
  saved.value = false
  try {
    const response = await request<Preferences>('/me/delivery-preferences', 'PUT', form.value)
    if (epoch === currentSessionEpoch()) {
      form.value = response.data
      saved.value = true
    }
  } catch (e) {
    if (epoch === currentSessionEpoch())
      error.value =
        e instanceof Error
          ? e.message
          : t('设置未保存，请重试。', 'Settings were not saved. Please retry.')
  } finally {
    if (epoch === currentSessionEpoch()) busy.value = false
  }
}
</script>
<template>
  <view v-if="remoteUser" class="delivery-preferences">
    <text class="section-title">{{ t('消息发送设置', 'Message delivery preferences') }}</text>
    <text>
      {{
        t(
          '摘要发送到站内消息；不会发送微信消息。草稿提醒还受平台总开关控制。',
          'Digests arrive in your inbox here, not through WeChat. Draft reminders also depend on the platform setting.',
        )
      }}
    </text>
    <text v-if="error" role="alert">{{ error }}</text>
    <template v-if="loaded">
      <text>{{ t('消息摘要', 'Message digest') }}</text>
      <wd-radio-group v-model="form.digest" :disabled="busy" @change="saved = false">
        <wd-radio value="off">{{ t('关闭', 'Off') }}</wd-radio>
        <wd-radio value="daily">{{ t('每日', 'Daily') }}</wd-radio>
        <wd-radio value="weekly">{{ t('每周', 'Weekly') }}</wd-radio>
      </wd-radio-group>
      <wd-checkbox v-model="form.draftNotice" :disabled="busy" @change="saved = false">
        {{ t('接收未提交草稿提醒', 'Remind me about unfinished drafts') }}
      </wd-checkbox>
      <wd-button size="small" :loading="busy" @click="save">
        {{ t('保存设置', 'Save preferences') }}
      </wd-button>
      <text v-if="saved" role="status">
        {{ t('消息设置已保存。', 'Message preferences saved.') }}
      </text>
    </template>
    <wd-button v-else size="small" variant="plain" :loading="busy" @click="load">
      {{ t('加载设置', 'Load preferences') }}
    </wd-button>
  </view>
</template>
<style scoped>
.delivery-preferences {
  display: grid;
  gap: 14px;
  padding: 22px;
  border: 1px solid #ded7c9;
  border-radius: 12px;
  margin-bottom: 22px;
  background: #fffdf8;
  font-size: 14px;
  line-height: 1.7;
}
</style>
