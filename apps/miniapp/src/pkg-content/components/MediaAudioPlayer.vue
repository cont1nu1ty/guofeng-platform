<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { t } from '../../composables/useLocale'
const props = defineProps<{ source: string }>()
const state = ref('idle')
const position = ref(0)
const error = ref('')
let audio: UniApp.InnerAudioContext | undefined
function stop() {
  audio?.stop()
  audio?.destroy()
  audio = undefined
  state.value = 'idle'
  position.value = 0
}
function play() {
  error.value = ''
  if (audio) {
    state.value === 'playing' ? audio.pause() : audio.play()
    return
  }
  audio = uni.createInnerAudioContext()
  audio.onPlay(() => {
    state.value = 'playing'
  })
  audio.onPause(() => {
    state.value = 'paused'
  })
  audio.onEnded(stop)
  audio.onTimeUpdate(() => {
    position.value = Math.floor(audio?.currentTime || 0)
  })
  audio.onError(() => {
    stop()
    error.value = t('音频暂不可播放，请重试。', 'Audio could not play. Please retry.')
  })
  audio.src = props.source
  state.value = 'loading'
  audio.play()
}
watch(() => props.source, stop)
onHide(stop)
onBeforeUnmount(stop)
</script>
<template>
  <view class="showcase-panel">
    <text class="showcase-card-title">{{ t('音频朗诵', 'Audio recitation') }}</text>
    <view class="showcase-actions">
      <wd-button size="small" :disabled="!source || state === 'loading'" @click="play">
        {{
          state === 'playing'
            ? t('暂停', 'Pause')
            : state === 'loading'
              ? t('加载中', 'Loading')
              : t('播放', 'Play')
        }}
      </wd-button>
      <wd-button size="small" variant="plain" @click="stop">{{ t('停止', 'Stop') }}</wd-button>
      <text>{{ position }}s</text>
    </view>
    <text v-if="error" class="scope-note">{{ error }}</text>
  </view>
</template>
