<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { request } from '../../services/api'
import { t } from '../../composables/useLocale'
import { activeCaption, type MediaAccessibility } from '../domain/mediaAccessibility'
import MediaAudioPlayer from './MediaAudioPlayer.vue'
const props = defineProps<{ mediaId: string; currentTime: number }>()
const track = ref<MediaAccessibility>({ cues: [], narrationUrl: '' }),
  error = ref(''),
  loading = ref(false),
  showTranscript = ref(false)
const caption = computed(() => activeCaption(track.value.cues, props.currentTime))
let serial = 0
async function load() {
  const version = ++serial
  track.value = { cues: [], narrationUrl: '' }
  error.value = ''
  loading.value = true
  try {
    const response = await request<MediaAccessibility>(
      `/media/${encodeURIComponent(props.mediaId)}/accessibility`,
    )
    if (serial === version) track.value = response.data
  } catch (e) {
    if (serial === version)
      error.value =
        e instanceof Error
          ? e.message
          : t('字幕读取失败，请重试。', 'Captions could not be loaded. Please retry.')
  } finally {
    if (serial === version) loading.value = false
  }
}
watch(() => props.mediaId, load, { immediate: true })
</script>
<template>
  <view
    v-if="track.cues.length || track.narrationUrl || error || loading"
    class="showcase-panel media-accessibility"
  >
    <text class="showcase-card-title">
      {{ t('人工字幕与朗读', 'Edited captions and recorded narration') }}
    </text>
    <view v-if="error" role="alert">
      <text>{{ error }}</text>
      <wd-button size="small" variant="plain" @click="load">
        {{ t('重新加载', 'Reload') }}
      </wd-button>
    </view>
    <text v-if="loading" role="status">{{ t('正在读取…', 'Loading…') }}</text>
    <template v-if="track.cues.length">
      <text class="caption-line" aria-live="off">
        {{ caption || t('字幕将随视频播放显示。', 'Captions follow video playback.') }}
      </text>
      <wd-button size="small" variant="plain" @click="showTranscript = !showTranscript">
        {{
          showTranscript
            ? t('收起完整字幕', 'Hide transcript')
            : t('阅读完整字幕', 'Read transcript')
        }}
      </wd-button>
      <view v-if="showTranscript" class="caption-transcript">
        <text v-for="cue in track.cues" :key="cue.startMs">{{ cue.text }}</text>
      </view>
    </template>
    <template v-if="track.narrationUrl">
      <text>
        {{
          t(
            '独立朗读录音，请暂停视频后播放。',
            'Pause the video before playing the recorded narration.',
          )
        }}
      </text>
      <MediaAudioPlayer :source="track.narrationUrl" />
    </template>
  </view>
</template>
<style scoped>
.media-accessibility {
  display: grid;
  gap: 12px;
}
.caption-line {
  display: block;
  min-height: 3em;
  padding: 14px;
  border-radius: 8px;
  color: #fff;
  background: #2b2622;
  line-height: 1.7;
}
.caption-transcript {
  display: grid;
  gap: 12px;
  line-height: 1.8;
}
</style>
