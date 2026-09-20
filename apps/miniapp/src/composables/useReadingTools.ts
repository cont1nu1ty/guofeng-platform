import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { locale, t } from './useLocale'
import { onHide } from '@dcloudio/uni-app'

export function useReadingTools() {
  const speechSupported = ref(false)
  const speechState = ref<'idle' | 'starting' | 'playing' | 'paused'>('idle')
  const speechMessage = ref('')
  const localVoiceCount = ref(0)
  const exportMessage = ref('')
  const exporting = ref(false)
  let generation = 0
  let startTimeout: ReturnType<typeof setTimeout> | undefined
  let exportKind: 'download' | 'copy' = 'copy'
  // #ifdef H5
  exportKind = 'download'
  // #endif
  const exportLabel = computed(() =>
    exportKind === 'download'
      ? t('下载本篇 TXT', 'Download this text (.txt)')
      : t('复制本篇文字', 'Copy this text'),
  )
  const speechUnavailable = computed(() =>
    speechSupported.value
      ? t(
          '浏览器未提供匹配当前语言的本机声音，可继续图文阅读。',
          'No on-device voice is available for this language. You can continue reading.',
        )
      : t(
          '本端暂无可用朗读音源，可使用目录与词义导读辅助阅读。',
          'Audio is unavailable on this platform. Use the contents and reading notes instead.',
        ),
  )
  function updateVoices() {
    // #ifdef H5
    if (speechSupported.value)
      localVoiceCount.value = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.localService).length
    // #endif
  }
  function stopSpeech() {
    generation++
    if (startTimeout) clearTimeout(startTimeout)
    startTimeout = undefined
    // #ifdef H5
    if (speechSupported.value) window.speechSynthesis.cancel()
    // #endif
    speechState.value = 'idle'
  }
  function startSpeech(text: string) {
    speechMessage.value = ''
    if (!speechSupported.value) {
      speechMessage.value = speechUnavailable.value
      return
    }
    // #ifdef H5
    stopSpeech()
    const language = locale.value === 'en' ? 'en' : 'zh'
    const voice = window.speechSynthesis
      .getVoices()
      .find((entry) => entry.localService && entry.lang.toLowerCase().startsWith(language))
    if (!voice) {
      speechMessage.value = speechUnavailable.value
      return
    }
    const token = generation
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = 0.9
    utterance.onstart = () => {
      if (token !== generation) return
      if (startTimeout) clearTimeout(startTimeout)
      speechState.value = 'playing'
      speechMessage.value = t('正在朗读当前章节', 'Reading the current chapter')
    }
    utterance.onpause = () => {
      if (token === generation) {
        speechState.value = 'paused'
        speechMessage.value = t('朗读已暂停', 'Reading paused')
      }
    }
    utterance.onresume = () => {
      if (token === generation) {
        speechState.value = 'playing'
        speechMessage.value = t('继续朗读当前章节', 'Reading resumed')
      }
    }
    utterance.onend = () => {
      if (token === generation) {
        speechState.value = 'idle'
        speechMessage.value = t('本章朗读结束', 'Chapter reading finished')
      }
    }
    utterance.onerror = () => {
      if (token === generation) {
        speechState.value = 'idle'
        speechMessage.value = t(
          '设备朗读未能完成，请检查系统声音或继续图文阅读。',
          'Device speech could not finish. Check system voices or continue reading.',
        )
      }
    }
    try {
      speechState.value = 'starting'
      window.speechSynthesis.speak(utterance)
      startTimeout = setTimeout(() => {
        if (token === generation && speechState.value === 'starting') {
          stopSpeech()
          speechMessage.value = t(
            '设备没有开始朗读，请检查本机语音支持。',
            'The device did not start reading. Check on-device voice support.',
          )
        }
      }, 5000)
    } catch {
      speechState.value = 'idle'
      speechMessage.value = t('当前浏览器无法启动朗读。', 'This browser could not start speech.')
    }
    // #endif
  }
  function pauseSpeech() {
    // #ifdef H5
    if (speechState.value === 'playing') window.speechSynthesis.pause()
    // #endif
  }
  function resumeSpeech() {
    // #ifdef H5
    if (speechState.value === 'paused') window.speechSynthesis.resume()
    // #endif
  }
  function endSpeech() {
    stopSpeech()
    speechMessage.value = t('已停止本篇朗读', 'Reading stopped')
  }
  async function exportText(title: string, content: string) {
    exportMessage.value = ''
    exporting.value = true
    // #ifdef H5
    try {
      const blob = new Blob(['\uFEFF', content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)}-demo.txt`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
      exportMessage.value = t(
        '已请求下载 TXT，请查看浏览器下载列表。',
        'TXT download requested. Check your browser’s downloads.',
      )
    } catch {
      exportMessage.value = t(
        '下载未能启动，请检查浏览器设置后重试。',
        'The download could not start. Check browser settings and try again.',
      )
    }
    exporting.value = false
    return
    // #endif
    // #ifndef H5
    uni.setClipboardData({
      data: content,
      success: () => {
        exportMessage.value = t(
          '本篇文字已复制，可粘贴到本机文档。',
          'The text has been copied. Paste it into a local document.',
        )
      },
      fail: () => {
        exportMessage.value = t(
          '复制失败，请检查权限后重试。',
          'Copy failed. Check permissions and try again.',
        )
      },
      complete: () => {
        exporting.value = false
      },
    })
    // #endif
  }
  onMounted(() => {
    // #ifdef H5
    speechSupported.value =
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    if (speechSupported.value) {
      updateVoices()
      window.speechSynthesis.addEventListener('voiceschanged', updateVoices)
    }
    // #endif
  })
  // Uni routes onHide hooks from nested components to their owning page.
  onHide(() => {
    stopSpeech()
    speechMessage.value = ''
  })
  onBeforeUnmount(() => {
    stopSpeech()
    // #ifdef H5
    if (speechSupported.value)
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices)
    // #endif
  })
  return {
    speechSupported,
    speechState,
    speechMessage,
    localVoiceCount,
    speechUnavailable,
    startSpeech,
    pauseSpeech,
    resumeSpeech,
    endSpeech,
    stopSpeech,
    exportText,
    exportLabel,
    exportMessage,
    exporting,
    exportKind,
  }
}
