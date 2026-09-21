<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { locale, t } from '../../composables/useLocale'
import { assetUrl } from '../../composables/useAssetUrl'
import type { HallPerson } from '../../domain/showcaseCatalog'
import { hallNarration, hallQuestions } from '../../domain/hallExperience'
const props = defineProps<{ person: HallPerson }>()
const instance = getCurrentInstance()
const tab = ref('panorama')
const offset = ref(0)
const viewport = ref(600)
const question = ref(-1)
const voiceState = ref('idle')
const voiceTime = ref(0)
const voiceDuration = ref(0)
const message = ref('')
const preview = ref('')
const drawing = ref(false)
const strokes = ref(0)
const busy = ref(false)
const canvasId = `heritage-trace-${props.person.id}`
let context: UniApp.CanvasContext | undefined
let canvasRect = { left: 0, top: 0, width: 300, height: 200 }
let audio: UniApp.InnerAudioContext | undefined
const narration = computed(() => hallNarration[props.person.id]?.[locale.value] ?? '')
const traceText = computed(() => (props.person.id === 'zhuge-liang' ? '静俭' : '勤学'))
function clock(value: number) {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}
function stopVoice() {
  audio?.stop()
  audio?.destroy()
  audio = undefined
  voiceState.value = 'idle'
  voiceTime.value = 0
}
function playVoice() {
  message.value = ''
  if (audio) {
    voiceState.value === 'playing' ? audio.pause() : audio.play()
    return
  }
  try {
    audio = uni.createInnerAudioContext()
    const current = audio
    current.onPlay(() => {
      voiceState.value = 'playing'
    })
    current.onPause(() => {
      voiceState.value = 'paused'
    })
    current.onEnded(() => {
      stopVoice()
    })
    current.onTimeUpdate(() => {
      voiceTime.value = current.currentTime
      voiceDuration.value = current.duration
    })
    current.onError(() => {
      stopVoice()
      message.value = t(
        '讲解音频播放失败，可继续阅读文字。',
        'Narration could not play. You can still read the text.',
      )
    })
    current.src = assetUrl(`/pkg-content/static/audio/${props.person.id}-${locale.value}.mp3`)
    voiceState.value = 'loading'
    current.play()
  } catch {
    stopVoice()
    message.value = t('本端无法播放讲解音频。', 'Audio narration is unavailable on this platform.')
  }
}
function move(amount: number) {
  offset.value = Math.max(viewport.value - 1200, Math.min(0, offset.value + amount))
}
function moved(event: unknown) {
  const x = (event as { detail?: { x?: number } }).detail?.x
  if (typeof x === 'number') offset.value = x
}
function measure() {
  uni
    .createSelectorQuery()
    .in(instance?.proxy)
    .select('.hall-panorama-window')
    .boundingClientRect((result) => {
      const value = result as UniApp.NodeInfo
      if (value?.width) viewport.value = value.width
    })
    .exec()
}
async function initCanvas() {
  await nextTick()
  uni
    .createSelectorQuery()
    .in(instance?.proxy)
    .select('.hall-trace-canvas')
    .boundingClientRect((result) => {
      const value = result as UniApp.NodeInfo
      if (!value || !value.width) return
      canvasRect = {
        left: value.left ?? 0,
        top: value.top ?? 0,
        width: value.width,
        height: value.height ?? 220,
      }
      context = uni.createCanvasContext(canvasId, instance?.proxy)
      clearDrawing()
    })
    .exec()
}
function clearDrawing() {
  if (!context) return
  context.setFillStyle('#F5F0E8')
  context.fillRect(0, 0, canvasRect.width, canvasRect.height)
  context.setStrokeStyle('#C9A96E')
  context.setLineWidth(1)
  context.beginPath()
  context.moveTo(canvasRect.width / 2, 0)
  context.lineTo(canvasRect.width / 2, canvasRect.height)
  context.moveTo(0, canvasRect.height / 2)
  context.lineTo(canvasRect.width, canvasRect.height / 2)
  context.stroke()
  context.setFontSize(Math.min(canvasRect.width / 3, 92))
  context.setTextAlign('center')
  context.setTextBaseline('middle')
  context.setFillStyle('#CCB99A')
  context.fillText(traceText.value[0]!, canvasRect.width / 4, canvasRect.height / 2)
  context.fillText(traceText.value[1]!, (canvasRect.width * 3) / 4, canvasRect.height / 2)
  context.draw()
  preview.value = ''
  strokes.value = 0
  drawing.value = false
}
function point(event: unknown) {
  // #ifdef H5
  const surface = (event as { currentTarget?: HTMLElement }).currentTarget
  if (surface?.getBoundingClientRect) {
    const rect = surface.getBoundingClientRect()
    canvasRect.left = rect.left
    canvasRect.top = rect.top
  }
  // #endif
  const value = event as {
    touches?: { x?: number; y?: number; clientX?: number; clientY?: number }[]
    clientX?: number
    clientY?: number
  }
  const input = value.touches?.[0] ?? value
  return {
    x:
      'x' in input && typeof input.x === 'number'
        ? input.x
        : (input.clientX ?? 0) - canvasRect.left,
    y:
      'y' in input && typeof input.y === 'number' ? input.y : (input.clientY ?? 0) - canvasRect.top,
  }
}
function startStroke(event: unknown) {
  if (!context) return
  // Re-read the bounding box on each stroke because the page may have scrolled.
  uni
    .createSelectorQuery()
    .in(instance?.proxy)
    .select('.hall-trace-canvas')
    .boundingClientRect((result) => {
      const rect = result as UniApp.NodeInfo
      if (rect) {
        canvasRect.left = rect.left ?? 0
        canvasRect.top = rect.top ?? 0
      }
    })
    .exec()
  const p = point(event)
  drawing.value = true
  strokes.value++
  preview.value = ''
  context.setStrokeStyle('#C41A1A')
  context.setLineWidth(4)
  context.setLineCap('round')
  context.setLineJoin('round')
  context.beginPath()
  context.moveTo(p.x, p.y)
}
function continueStroke(event: unknown) {
  if (!drawing.value || !context) return
  const p = point(event)
  context.lineTo(p.x, p.y)
  context.stroke()
  context.draw(true)
  context.beginPath()
  context.moveTo(p.x, p.y)
}
function finishStroke() {
  drawing.value = false
}
function saveDrawing() {
  if (!strokes.value || busy.value) return
  finishStroke()
  busy.value = true
  message.value = ''
  uni.canvasToTempFilePath(
    {
      canvasId,
      fileType: 'png',
      success(result) {
        preview.value = result.tempFilePath
        message.value = t(
          '已生成描摹预览，仅保留在当前页面。',
          'Tracing preview generated for this page only.',
        )
      },
      fail() {
        message.value = t(
          '描摹预览生成失败，请重试。',
          'Could not generate the tracing preview. Please retry.',
        )
      },
      complete() {
        busy.value = false
      },
    },
    instance?.proxy,
  )
}
function downloadDrawing() {
  if (!preview.value) return
  // #ifdef H5
  try {
    const link = document.createElement('a')
    link.href = preview.value
    link.download = `family-precept-${props.person.id}.png`
    link.click()
    message.value = t(
      '已请求下载图片，请查看浏览器下载列表。',
      'Image download requested. Check browser downloads.',
    )
  } catch {
    message.value = t('图片下载未能启动。', 'Image download could not start.')
  }
  return
  // #endif
  // #ifdef MP-WEIXIN
  uni.saveImageToPhotosAlbum({
    filePath: preview.value,
    success() {
      message.value = t('描摹图片已保存到相册。', 'Tracing image saved to Photos.')
    },
    fail() {
      message.value = t(
        '图片未保存，请检查相册权限；预览仍可查看。',
        'Image was not saved. Check Photos permission; the preview remains available.',
      )
    },
  })
  // #endif
}
watch(tab, async (value) => {
  stopVoice()
  if (value === 'trace') await initCanvas()
  if (value === 'panorama') await nextTick().then(measure)
})
watch(
  () => props.person.id,
  () => {
    stopVoice()
    preview.value = ''
    question.value = -1
    offset.value = 0
    if (tab.value === 'trace') initCanvas()
  },
)
watch(locale, stopVoice)
onMounted(measure)
onHide(stopVoice)
onBeforeUnmount(stopVoice)
</script>
<template>
  <view class="hall-experience">
    <text class="experience-heading">{{ t('文脉体验室', 'Heritage experience studio') }}</text>
    <view class="experience-actions">
      <wd-button
        v-for="item in [
          { id: 'panorama', label: t('拖动全景示意', 'Panorama concept') },
          { id: 'trace', label: t('家训描摹', 'Trace a precept') },
          { id: 'guide', label: t('讲解与问答', 'Narration and questions') },
        ]"
        :key="item.id"
        size="small"
        :variant="tab === item.id ? 'base' : 'plain'"
        @click="tab = item.id"
      >
        {{ item.label }}
      </wd-button>
    </view>
    <view v-if="tab === 'panorama'">
      <text class="experience-note">
        {{
          t(
            '横向拖动探索原创空间示意，不是真实场馆、720°实景或文物扫描。',
            'Drag horizontally through an original spatial illustration, not a real venue, 720-degree panorama or artefact scan.',
          )
        }}
      </text>
      <movable-area class="hall-panorama-window">
        <movable-view
          class="hall-panorama-scene"
          direction="horizontal"
          :x="offset"
          :inertia="true"
          :out-of-bounds="false"
          @change="moved"
        >
          <view
            v-for="(label, index) in [
              t('序厅', 'Entrance'),
              t('家训展墙', 'Precept wall'),
              t('书斋', 'Study'),
              t('传习庭院', 'Practice courtyard'),
            ]"
            :key="index"
            class="panorama-room"
          >
            <view class="panorama-roof" />
            <view class="panorama-column panorama-column-left" />
            <view class="panorama-column panorama-column-right" />
            <view class="panorama-scroll">
              <text>{{ index % 2 ? person.book.zh : person.quote.zh }}</text>
            </view>
            <view class="panorama-desk" />
            <text class="panorama-label">0{{ index + 1 }} · {{ label }}</text>
          </view>
        </movable-view>
      </movable-area>
      <view class="experience-actions">
        <wd-button size="small" variant="plain" :disabled="offset >= 0" @click="move(240)">
          {{ t('向左看', 'Look left') }}
        </wd-button>
        <wd-button
          size="small"
          variant="plain"
          :disabled="offset <= viewport - 1200"
          @click="move(-240)"
        >
          {{ t('向右看', 'Look right') }}
        </wd-button>
        <wd-button size="small" variant="plain" @click="offset = 0">
          {{ t('回到入口', 'Return to entrance') }}
        </wd-button>
      </view>
    </view>
    <view v-if="tab === 'trace'">
      <text class="experience-note">
        {{
          t(
            '沿底字自由描摹，可用手指或鼠标。此处不进行书法评分。',
            'Trace the guide characters with a finger or mouse. No handwriting score is generated.',
          )
        }}
      </text>
      <canvas
        :canvas-id="canvasId"
        :id="canvasId"
        class="hall-trace-canvas"
        :disable-scroll="true"
        @touchstart="startStroke"
        @touchmove.stop.prevent="continueStroke"
        @touchend="finishStroke"
        @touchcancel="finishStroke"
        @mousedown="startStroke"
        @mousemove="continueStroke"
        @mouseup="finishStroke"
        @mouseleave="finishStroke"
      />
      <view class="experience-actions">
        <wd-button size="small" variant="plain" @click="clearDrawing">
          {{ t('清除重写', 'Clear and restart') }}
        </wd-button>
        <wd-button size="small" :disabled="!strokes || busy" @click="saveDrawing">
          {{ busy ? t('生成中…', 'Preparing…') : t('保存描摹预览', 'Save tracing preview') }}
        </wd-button>
      </view>
      <view v-if="preview" class="tracing-preview">
        <text class="experience-subtitle">{{ t('我的描摹', 'My tracing') }}</text>
        <image class="tracing-preview-image" :src="preview" mode="widthFix" />
        <wd-button size="small" variant="plain" @click="downloadDrawing">
          {{ t('保存图片', 'Save image') }}
        </wd-button>
      </view>
    </view>
    <view v-if="tab === 'guide'">
      <text class="experience-subtitle">
        {{ t('听一段展厅讲解', 'Listen to the gallery narration') }}
      </text>
      <text class="experience-prose">{{ narration }}</text>
      <view class="experience-actions">
        <wd-button size="small" @click="playVoice">
          {{
            voiceState === 'playing'
              ? t('暂停讲解', 'Pause narration')
              : voiceState === 'paused'
                ? t('继续讲解', 'Resume narration')
                : t('播放讲解', 'Play narration')
          }}
        </wd-button>
        <wd-button
          size="small"
          variant="plain"
          :disabled="voiceState === 'idle'"
          @click="stopVoice"
        >
          {{ t('停止', 'Stop') }}
        </wd-button>
        <text>{{ clock(voiceTime) }} / {{ clock(voiceDuration) }}</text>
      </view>
      <text class="experience-note">
        {{
          t(
            '原创导览稿与离线合成音源，不是实时AI讲解。',
            'Original narration with offline synthetic speech, not live AI narration.',
          )
        }}
      </text>
      <text class="experience-subtitle experience-gap">
        {{ t('馆内常见问答', 'Gallery questions') }}
      </text>
      <text class="experience-note">
        {{
          t(
            '以下为编辑预设问答，不分析自由输入。',
            'These are prepared questions and answers, without free-form input analysis.',
          )
        }}
      </text>
      <view v-for="(item, index) in hallQuestions" :key="index" class="hall-question">
        <button class="hall-question-toggle" @click="question = question === index ? -1 : index">
          {{ item.question[locale] }} {{ question === index ? '−' : '+' }}
        </button>
        <text v-if="question === index" class="experience-prose">{{ item.answer[locale] }}</text>
      </view>
    </view>
    <text v-if="voiceState === 'loading'" class="experience-note">
      {{ t('正在加载音频…', 'Loading audio…') }}
    </text>
    <text v-if="message" class="experience-message" role="status">{{ message }}</text>
  </view>
</template>
<style scoped>
.hall-experience {
  padding: 24px;
  border: 1px solid #c9a96e;
  background: #fffaf1;
  margin: 26px 0;
  color: #2c2c2c;
  min-width: 0;
}
.experience-heading {
  display: block;
  font-family: 'JiafengSerif', serif;
  font-size: 24px;
  font-weight: 600;
}
.experience-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin: 18px 0;
}
.experience-note {
  display: block;
  font-size: 13px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.experience-subtitle {
  display: block;
  font-size: 18px;
  font-weight: 600;
}
.experience-prose {
  display: block;
  line-height: 1.9;
  margin: 14px 0;
  overflow-wrap: anywhere;
}
.experience-gap {
  margin-top: 28px;
}
.hall-panorama-window {
  width: 100%;
  height: 270px;
  overflow: hidden;
  background: #e9ddc9;
  margin-top: 18px;
  touch-action: pan-y;
}
.hall-panorama-scene {
  width: 1200px;
  height: 270px;
  display: flex;
  background: linear-gradient(#eee5d6 75%, #dbcbb1 75%);
  cursor: grab;
}
.panorama-room {
  position: relative;
  width: 300px;
  flex: 0 0 300px;
  height: 270px;
  border-right: 1px solid #c9a96e;
  box-sizing: border-box;
}
.panorama-roof {
  height: 24px;
  position: absolute;
  left: 8px;
  right: 8px;
  top: 0;
  background: #c41a1a;
  border-bottom: 5px solid #c9a96e;
}
.panorama-column {
  position: absolute;
  top: 22px;
  width: 10px;
  height: 196px;
  background: #c41a1a;
}
.panorama-column-left {
  left: 12px;
}
.panorama-column-right {
  right: 12px;
}
.panorama-scroll {
  position: absolute;
  left: 79px;
  top: 48px;
  width: 142px;
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 5px solid #c9a96e;
  background: #f5f0e8;
  box-sizing: border-box;
  padding: 15px;
  font-family: 'JiafengSerif', serif;
  font-size: 22px;
  line-height: 1.7;
  text-align: center;
}
.panorama-desk {
  position: absolute;
  left: 62px;
  right: 62px;
  top: 186px;
  height: 14px;
  background: #2c2c2c;
  border-bottom: 4px solid #c9a96e;
}
.panorama-label {
  position: absolute;
  bottom: 12px;
  left: 22px;
  font-size: 14px;
  font-weight: 600;
}
.hall-trace-canvas {
  width: 100%;
  height: 220px;
  border: 1px solid #c9a96e;
  box-sizing: border-box;
  margin-top: 18px;
  touch-action: none;
}
.tracing-preview {
  padding: 16px;
  background: #f5f0e8;
}
.tracing-preview .tracing-preview-image {
  display: block;
  width: 100%;
  margin: 16px 0;
}
.hall-question {
  border-top: 1px solid #c9a96e;
  margin-top: 16px;
  padding-top: 12px;
}
.hall-question .hall-question-toggle {
  padding: 8px 0;
  background: transparent;
  text-align: left;
  font-size: 16px;
  line-height: 1.7;
  white-space: normal;
}
.hall-question .hall-question-toggle::after {
  border: 0;
}
.experience-message {
  display: block;
  line-height: 1.8;
  border-left: 3px solid #c41a1a;
  padding: 12px;
  margin-top: 18px;
}
@media (max-width: 650px) {
  .hall-experience {
    padding: 16px;
  }
  .experience-heading {
    font-size: 22px;
  }
}
</style>
