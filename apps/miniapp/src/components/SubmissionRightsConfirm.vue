<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { remoteUser } from '../services/api'
import { getAgreement, confirmationRequest } from '../services/credentials'
import type { Agreement } from '../domain/credentials'
import { t } from '../composables/useLocale'
const props = defineProps<{ submissionId: string; revisionId: string; version: number; required: boolean }>()
const emit = defineEmits<{ confirmed: [] }>()
const agreement = ref<Agreement>(), accepted = ref(false), busy = ref(false), error = ref('')
let generation = 0, pending: ReturnType<typeof confirmationRequest> | undefined
watch(() => [props.submissionId, props.revisionId, props.version, remoteUser.value?.id], async () => {
  const current = ++generation; agreement.value = undefined; accepted.value = false; error.value = ''; pending = undefined; busy.value = false
  if (!props.required || !remoteUser.value) return
  try { const value = await getAgreement(); if (generation === current) agreement.value = value }
  catch (failure) { if (generation === current) error.value = failure instanceof Error ? failure.message : t('须知加载失败，请刷新页面', 'Failed to load the terms. Refresh this page.') }
}, { immediate: true })
onBeforeUnmount(() => generation++)
async function confirm() {
  if (!accepted.value || !agreement.value || busy.value) return
  const current = generation; busy.value = true; error.value = ''
  pending ??= confirmationRequest(props.submissionId, { revisionId: props.revisionId, version: props.version, agreementVersion: agreement.value.version, accepted: true })
  try { await pending(); if (current === generation) emit('confirmed') }
  catch (failure) { if (current === generation) error.value = failure instanceof Error ? failure.message : t('确认失败，请重试', 'Confirmation failed. Retry.') }
  finally { if (current === generation) busy.value = false }
}
</script>
<template>
  <view v-if="required" class="rights-confirm">
    <text class="rights-title">{{ t('归集稿件待本人确认', 'Imported submission: author confirmation required') }}</text>
    <text>{{ t('请先阅读本次归集的正文与附件。确认将绑定当前修订版本，并记录须知全文与时间。', 'Read the imported text and attachments first. Your confirmation is recorded for this revision with the full terms and time.') }}</text>
    <text v-if="agreement" class="rights-terms">{{ agreement.text }}</text>
    <text class="muted">{{ t('这是投稿须知确认记录，不是正式电子签章或版权登记。', 'This records acceptance of the submission terms. It is not an electronic signature or copyright registration.') }}</text>
    <wd-checkbox v-if="agreement" v-model="accepted" :disabled="busy">{{ t('我已核对当前正文、附件及投稿须知', 'I have checked this text, its attachments and the terms') }}</wd-checkbox>
    <text v-if="error" role="alert" class="rights-error">{{ error }}</text>
    <wd-button :loading="busy" :disabled="!accepted || !agreement || !revisionId" @click="confirm">{{ t('确认并进入评审', 'Confirm for review') }}</wd-button>
  </view>
</template>
<style scoped>
.rights-confirm{display:flex;flex-direction:column;gap:14px;padding:24px;background:#fff8ed;border:1px solid #d8c7a7;border-radius:12px;line-height:1.8}.rights-title{font-weight:700}.rights-terms{white-space:pre-wrap}.rights-error{color:#a6382c}
</style>
