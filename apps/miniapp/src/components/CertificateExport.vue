<script setup lang="ts">
import { getCurrentInstance, nextTick, ref, watch } from 'vue'
import { t, locale } from '../composables/useLocale'
import {
  certificateFilename,
  wrapCertificateText,
  type CertificateData,
} from '../domain/certificateLayout'
const props = defineProps<{ certificate: CertificateData }>()
const busy = ref(false)
const message = ref('')
const failed = ref(false)
const permissionDenied = ref(false)
const canvasHeight = ref(900)
const instance = getCurrentInstance()
const canvasId = `certificate-${instance?.uid ?? 'sample'}`
interface Painter {
  fill(color: string): void
  stroke(color: string): void
  font(size: number, bold?: boolean): void
  rect(x: number, y: number, width: number, height: number): void
  frame(x: number, y: number, width: number, height: number, line: number): void
  text(value: string, x: number, y: number): void
  measure(value: string): number
}
function paint(p: Painter, data: CertificateData) {
  const lang = locale.value
  const en = lang === 'en'
  p.font(42, true)
  const titleLines = wrapCertificateText(data.title, 790, p.measure)
  p.font(34)
  const recipientLines = wrapCertificateText(data.recipient, 790, p.measure)
  p.font(30)
  const subjectLines = wrapCertificateText(data.subject, 770, p.measure)
  p.font(18)
  const idLines = wrapCertificateText(data.id, 790, p.measure)
  const height = Math.max(
    900,
    700 +
      titleLines.length * 60 +
      recipientLines.length * 48 +
      subjectLines.length * 44 +
      idLines.length * 28,
  )
  return {
    height,
    render: () => {
      p.fill('#F5F0E8')
      p.rect(0, 0, 1000, height)
      p.stroke('#C9A96E')
      p.frame(28, 28, 944, height - 56, 4)
      p.frame(44, 44, 912, height - 88, 1)
      p.fill('#C41A1A')
      p.rect(44, 44, 912, 14)
      p.font(28, true)
      p.text(en ? 'FAMILY HERITAGE' : '家风中华行', 500, 110)
      let y = 190
      p.fill('#2C2C2C')
      p.font(42, true)
      for (const line of titleLines) {
        p.text(line, 500, y)
        y += 60
      }
      y += 4
      p.fill('#C41A1A')
      p.font(19)
      p.text(
        en ? 'DEMONSTRATION SAMPLE · NOT A CREDENTIAL' : '演示样张 · 不具有正式认证效力',
        500,
        y,
      )
      y += 70
      p.fill('#2C2C2C')
      p.font(34)
      for (const line of recipientLines) {
        p.text(line, 500, y)
        y += 48
      }
      y += 18
      p.font(30)
      for (const line of subjectLines) {
        p.text(line, 500, y)
        y += 44
      }
      y += 28
      p.font(21)
      p.text((en ? 'Recorded: ' : '记录日期：') + (data.date.slice(0, 10) || '—'), 500, y)
      y += 35
      p.font(18)
      for (const line of idLines) {
        p.text(line, 500, y)
        y += 28
      }
      p.stroke('#C41A1A')
      p.frame(434, height - 195, 132, 64, 3)
      p.fill('#C41A1A')
      p.font(25, true)
      p.text(en ? 'DEMO' : '演示样张', 500, height - 153)
      p.fill('#2C2C2C')
      p.font(17)
      p.text(
        en
          ? 'Created on this device · No authentic seal or accredited hours'
          : '本机生成 · 无真实签章 · 不计正式培训学时',
        500,
        height - 88,
      )
    },
  }
}
function failSave(error: unknown) {
  const detail =
    typeof error === 'object' && error && 'errMsg' in error ? String(error.errMsg) : String(error)
  permissionDenied.value = /auth|deny|denied|permission/i.test(detail)
  failed.value = true
  message.value = permissionDenied.value
    ? t(
        '未获得相册权限，图片未保存。可在设置中允许后重试。',
        'Album access was not granted. The image was not saved. Allow access in settings and retry.',
      )
    : t('图片生成或保存失败，请重试。', 'Image creation or saving failed. Please retry.')
}
async function save() {
  if (busy.value) return
  busy.value = true
  message.value = ''
  failed.value = false
  permissionDenied.value = false
  const data = { ...props.certificate }
  try {
    // #ifdef H5
    {
      const canvas = document.createElement('canvas')
      canvas.width = 1000
      canvas.height = 900
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      const painter: Painter = {
        fill: (value) => {
          context.fillStyle = value
        },
        stroke: (value) => {
          context.strokeStyle = value
        },
        font: (size, bold) => {
          context.font = `${bold ? 600 : 400} ${size}px ${bold ? 'JiafengSerif' : 'JiafengSans'}, sans-serif`
          context.textAlign = 'center'
        },
        rect: (x, y, width, height) => context.fillRect(x, y, width, height),
        frame: (x, y, width, height, line) => {
          context.lineWidth = line
          context.strokeRect(x, y, width, height)
        },
        text: (value, x, y) => context.fillText(value, x, y),
        measure: (value) => context.measureText(value).width,
      }
      const drawing = paint(painter, data)
      canvas.height = drawing.height
      drawing.render()
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('PNG unavailable'))),
          'image/png',
        ),
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = certificateFilename(data.id)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      message.value = t(
        'PNG 已生成并发起下载，请在浏览器下载列表查看。',
        'PNG created and download requested. Check your browser downloads.',
      )
    }
    // #endif
    // #ifdef MP-WEIXIN
    {
      const context = uni.createCanvasContext(canvasId, instance?.proxy)
      const painter: Painter = {
        fill: (value) => context.setFillStyle(value),
        stroke: (value) => context.setStrokeStyle(value),
        font: (size) => {
          context.setFontSize(size)
          context.setTextAlign('center')
        },
        rect: (x, y, width, height) => context.fillRect(x, y, width, height),
        frame: (x, y, width, height, line) => {
          context.setLineWidth(line)
          context.strokeRect(x, y, width, height)
        },
        text: (value, x, y) => context.fillText(value, x, y),
        measure: (value) => context.measureText(value).width,
      }
      const drawing = paint(painter, data)
      canvasHeight.value = drawing.height
      await nextTick()
      drawing.render()
      await new Promise<void>((resolve) => context.draw(false, () => resolve()))
      const filePath = await new Promise<string>((resolve, reject) =>
        uni.canvasToTempFilePath(
          {
            canvasId,
            width: 1000,
            height: drawing.height,
            destWidth: 1000,
            destHeight: drawing.height,
            fileType: 'png',
            success: (result) => resolve(result.tempFilePath),
            fail: reject,
          },
          instance?.proxy,
        ),
      )
      await new Promise<void>((resolve, reject) =>
        uni.saveImageToPhotosAlbum({ filePath, success: () => resolve(), fail: reject }),
      )
      message.value = t('证书样张已保存到相册。', 'The sample certificate was saved to your album.')
    }
    // #endif
  } catch (error) {
    failSave(error)
  } finally {
    busy.value = false
  }
}
function openPermissionSettings() {
  // #ifdef MP-WEIXIN
  uni.openSetting({
    success: () => {
      message.value = t(
        '设置已关闭。允许相册权限后，请重新点击保存。',
        'Settings closed. If album access is allowed, press Save again.',
      )
    },
    fail: () => {
      message.value = t(
        '无法打开设置，请在微信小程序设置中检查相册权限。',
        'Settings could not be opened. Check album permissions in WeChat settings.',
      )
    },
  })
  // #endif
}
watch(
  () => props.certificate.id,
  () => {
    message.value = ''
    failed.value = false
    permissionDenied.value = false
  },
)
watch(locale, () => {
  message.value = ''
})
</script>
<template>
  <view class="certificate-export">
    <wd-button :loading="busy" :disabled="busy" @click="save">
      {{
        busy ? t('正在生成图片', 'Creating image') : t('保存证书样张 PNG', 'Save certificate PNG')
      }}
    </wd-button>
    <text class="certificate-export-note">
      {{
        t(
          '按当前界面语言生成，包含演示水印。证书主题保留原文。',
          'Created in the current interface language with a demo watermark. Original subject text is retained.',
        )
      }}
    </text>
    <text
      v-if="message"
      :class="['certificate-export-result', { 'certificate-export-error': failed }]"
    >
      {{ message }}
    </text>
    <!-- #ifdef MP-WEIXIN -->
    <button v-if="permissionDenied" class="text-button" @click="openPermissionSettings">
      {{ t('打开相册权限设置', 'Open album permission settings') }}
    </button>
    <canvas
      :canvas-id="canvasId"
      :id="canvasId"
      class="certificate-native-canvas"
      :style="{ width: '1000px', height: canvasHeight + 'px' }"
    />
    <!-- #endif -->
  </view>
</template>
<style scoped>
.certificate-export {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  width: 100%;
}
.certificate-export-note,
.certificate-export-result {
  display: block;
  color: #555;
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
  overflow-wrap: anywhere;
}
.certificate-export-error {
  color: #c41a1a;
}
.certificate-native-canvas {
  position: fixed;
  left: -1200px;
  top: 0;
  pointer-events: none;
}
</style>
