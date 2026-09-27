<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { remoteUser, remoteWorkspace } from '../services/api'
import { recitationUrl, removeRecitation } from '../services/cloudRecords'
import type { CloudRecitation } from '../domain/cloudRecords'
import { navigate } from '../composables/useNavigation'
import { t } from '../composables/useLocale'
const playing = ref('')
const busy = ref('')
const message = ref('')
let player: UniApp.InnerAudioContext | undefined
let generation = 0
function stop() {
  generation++
  player?.stop()
  player?.destroy()
  player = undefined
  playing.value = ''
  busy.value = ''
}
async function play(item: CloudRecitation) {
  if (playing.value === item.id) {
    stop()
    return
  }
  stop()
  const current = generation
  busy.value = item.id
  message.value = ''
  try {
    const url = await recitationUrl(item.fileId)
    if (generation !== current) return
    const audio = uni.createInnerAudioContext()
    player = audio
    playing.value = item.id
    audio.onEnded(() => {
      if (player === audio) stop()
    })
    audio.onError(() => {
      if (player !== audio) return
      stop()
      message.value = t(
        '播放失败。点击播放可重新取得授权链接并重试。',
        'Playback failed. Press play to get a new authorized link and retry.',
      )
    })
    audio.src = url
    audio.play()
  } catch (error) {
    if (generation === current)
      message.value = error instanceof Error ? error.message : t('播放失败', 'Playback failed')
  } finally {
    if (generation === current) busy.value = ''
  }
}
async function remove(item: CloudRecitation) {
  stop()
  const current = generation
  busy.value = item.id
  message.value = ''
  try {
    await removeRecitation(item)
    if (generation === current)
      message.value = t(
        '私人记录已删除，已投稿的媒体保留。',
        'Private record deleted. Submitted media is preserved.',
      )
  } catch (error) {
    if (generation === current)
      message.value = error instanceof Error ? error.message : t('删除失败', 'Deletion failed')
  } finally {
    if (generation === current) busy.value = ''
  }
}
watch(remoteUser, () => {
  stop()
  message.value = ''
})
onHide(stop)
onBeforeUnmount(stop)
</script>
<template>
  <view class="cloud-recitations">
    <text class="record-heading">
      {{ t('我的云端诵读', 'My saved recitations') }} · {{ remoteWorkspace.recitations.length }}
    </text>
    <text class="record-note">
      {{
        t(
          '仅本人可读；主动投稿后才会交给运营审核。',
          'Only you can access these recordings. Submit one explicitly to request editorial review.',
        )
      }}
    </text>
    <view v-for="item in remoteWorkspace.recitations" :key="item.id" class="cloud-record">
      <text class="record-title">{{ item.title }}</text>
      <text class="record-note">
        {{ item.createdAt.slice(0, 10) }} · {{ Math.ceil(item.duration) }} {{ t('秒', 'sec') }} ·
        {{ item.fileName }}
      </text>
      <view class="record-actions">
        <wd-button size="small" variant="plain" :disabled="!!busy" @click="play(item)">
          {{ playing === item.id ? t('停止', 'Stop') : t('播放录音', 'Play recording') }}
        </wd-button>
        <wd-button
          size="small"
          variant="plain"
          :disabled="!!busy"
          @click="navigate('media', { tab: 'submit', recitation: item.id })"
        >
          {{ t('投稿这条录音', 'Submit this recording') }}
        </wd-button>
        <wd-button size="small" variant="plain" :disabled="!!busy" @click="remove(item)">
          {{ t('删除记录', 'Delete record') }}
        </wd-button>
      </view>
    </view>
    <text v-if="!remoteWorkspace.recitations.length" class="record-note">
      {{
        remoteUser
          ? t('尚未保存云端诵读。', 'No saved recitations yet.')
          : t('登录后查看本人诵读记录。', 'Sign in to see your recordings.')
      }}
    </text>
    <text v-if="busy" class="record-note">{{ t('处理中…', 'Working…') }}</text>
    <text v-if="message" class="record-note" role="status">{{ message }}</text>
  </view>
</template>
<style scoped>
.cloud-recitations {
  margin: 24px 0;
  min-width: 0;
}
.record-heading,
.record-title {
  display: block;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 10px;
  overflow-wrap: anywhere;
}
.record-note {
  display: block;
  font-size: 14px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.cloud-record {
  border-top: 1px solid var(--jf-border);
  margin-top: 16px;
  padding-top: 16px;
}
.record-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}
</style>
