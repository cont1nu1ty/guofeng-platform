<script setup lang="ts">
import { isHttpMode } from '../config/dataMode'
import { recordEngagement } from '../composables/useEngagement'
import { computed, ref, watch } from 'vue'
import SectionHeading from './SectionHeading.vue'
import ResourceDirectory from './ResourceDirectory.vue'
import {
  repo,
  region,
  revision,
  favorite,
  isFavorite,
  largeText,
  notify,
} from '../composables/useDemo'
import { navigate, goBack, useRouteParams } from '../composables/useNavigation'
import { locale, t } from '../composables/useLocale'
import { excerpts, saveExcerpt, archiveError } from '../composables/usePersonalArchive'
import { useReadingTools } from '../composables/useReadingTools'
import { genres, themes, regions } from '../domain/fixtures'
import { glossaryFor, isClassic, readingDocument, type ReadingItem } from '../domain/libraryCatalog'
import { writingHtml } from '../domain/writingTools'
const params = useRouteParams()
const query = ref('')
const genre = ref('all')
const theme = ref('all')
const volume = ref('all')
const chapterIndex = ref(0)
const vertical = ref(false)
const selectionMode = ref(false)
const selectedParagraphs = ref<number[]>([])
const excerptNote = ref('')
const excerptExpanded = ref(false)
const glossaryId = ref('')
const tools = useReadingTools()
const {
  speechSupported,
  speechState,
  speechMessage,
  speechUnavailable,
  exportLabel,
  exportMessage,
  exporting,
} = tools
const source = computed(() => {
  revision.value
  return params.value.id
    ? (repo.getClassic(params.value.id) ?? repo.getWork(params.value.id))
    : undefined
})
watch(() => source.value?.id, () => { if(source.value) void recordEngagement(isClassic(source.value) ? 'collection' : 'submission', source.value.id) }, { immediate: true })
const formattedWork = computed(() =>
  source.value && !isClassic(source.value) && source.value.contentDelta
    ? writingHtml(source.value.contentDelta, source.value.content)
    : '',
)
const document = computed(() =>
  source.value ? readingDocument(source.value, locale.value) : undefined,
)
const currentChapter = computed(
  () => document.value?.chapters[chapterIndex.value] ?? document.value?.chapters[0],
)
const glossary = computed(() => (source.value ? glossaryFor(source.value) : []))
const currentGlossary = computed(
  () => glossary.value.find((item) => item.id === glossaryId.value) ?? glossary.value[0],
)
const selectedText = computed(() =>
  selectedParagraphs.value
    .slice()
    .sort((a, b) => a - b)
    .map((index) => currentChapter.value?.paragraphs[index] ?? '')
    .filter(Boolean)
    .join('\n\n'),
)
const existingExcerpt = computed(() =>
  excerpts.value.find(
    (entry) => entry.sourceId === source.value?.id && entry.text === selectedText.value,
  ),
)
const savedExcerptsCount = computed(
  () => excerpts.value.filter((entry) => entry.sourceId === source.value?.id).length,
)
const dictionaries: Record<string, string> = {
  家风家书: 'Family letters',
  家风纪实散文: 'Family essays',
  家风诗词楹联: 'Poems and couplets',
  红色家风回忆录: 'Red heritage memoirs',
  乡贤家族传记: 'Family biographies',
  家训手记: 'Family principles',
  最美家庭手记: 'Family journals',
  家风文论: 'Family-values commentary',
  清廉家风: 'Integrity',
  孝老爱亲: 'Care for family',
  邻里互助: 'Helping neighbours',
  爱国奉献: 'Public responsibility',
  先贤文脉: 'Classical heritage',
  家族传记: 'Family history',
  北京: 'Beijing',
  浙江: 'Zhejiang',
  四川: 'Sichuan',
  全国: 'National',
}
function label(value: string) {
  return t(value, dictionaries[value] ?? value)
}
function optionLabel(options: { id: string; label: string }[], id: string) {
  return label(options.find((item) => item.id === id)?.label ?? id)
}
function reading(item: ReadingItem) {
  return readingDocument(item, locale.value)
}
function matches(item: ReadingItem) {
  const data = reading(item)
  return (
    (genre.value === 'all' || data.genre === genre.value) &&
    (theme.value === 'all' || data.themes.some((id) => id === theme.value)) &&
    (!query.value.trim() ||
      `${item.title}${item.excerpt}${data.title}${data.excerpt}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()))
  )
}
const classics = computed(() =>
  repo
    .listClassics()
    .filter(
      (item) =>
        (region.value === 'all' || item.region === region.value || item.region === 'all') &&
        (volume.value === 'all' ||
          (volume.value === 'national' ? item.region === 'all' : item.region !== 'all')) &&
        matches(item),
    ),
)
const filteredWorks = computed(() => {
  revision.value
  return repo.listWorks({ region: region.value }).filter(matches)
})
const totalMatches = computed(() => classics.value.length + filteredWorks.value.length)
watch(
  () => params.value.id,
  () => {
    chapterIndex.value = 0
    vertical.value = false
    selectionMode.value = false
    selectedParagraphs.value = []
    excerptNote.value = ''
    glossaryId.value = ''
    tools.stopSpeech()
  },
)
watch(locale, () => {
  selectedParagraphs.value = []
  tools.stopSpeech()
  speechMessage.value = ''
  exportMessage.value = ''
})
watch(selectedText, () => {
  excerptNote.value = existingExcerpt.value?.note ?? ''
})
function openItem(item: ReadingItem) {
  navigate('library', { id: item.id })
}
function resetFilters() {
  query.value = ''
  genre.value = 'all'
  theme.value = 'all'
  volume.value = 'all'
  region.value = 'all'
}
function setChapter(index: number) {
  if (!document.value || index < 0 || index >= document.value.chapters.length) return
  tools.stopSpeech()
  speechMessage.value = ''
  chapterIndex.value = index
  selectedParagraphs.value = []
  excerptNote.value = ''
}
function toggleParagraph(index: number) {
  if (!selectionMode.value) return
  selectedParagraphs.value = selectedParagraphs.value.includes(index)
    ? selectedParagraphs.value.filter((item) => item !== index)
    : [...selectedParagraphs.value, index]
}
function toggleSelection() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) selectedParagraphs.value = []
}
function syncExcerptNote(event: unknown) {
  const value = (event as { detail?: { value?: unknown } })?.detail?.value
  if (typeof value === 'string') excerptNote.value = value
}
async function saveSelectedExcerpt() {
  if (!source.value || !document.value || !selectedText.value.trim()) {
    notify(t('请先选择要摘抄的段落', 'Select a paragraph first'))
    return
  }
  if (selectedText.value.length > 2000) {
    notify(
      t(
        '一次摘抄最多 2000 字，请减少段落。',
        'Select fewer paragraphs: an excerpt can contain up to 2,000 characters.',
      ),
    )
    return
  }
  const result = await saveExcerpt({
    sourceId: source.value.id,
    sourceTitle: document.value.title,
    text: selectedText.value,
    note: excerptNote.value.trim(),
  })
  if (result)
    notify(
      t(
        isHttpMode ? '摘抄与感想已保存到当前账号' : '摘抄与感想已保存到本机',
        isHttpMode ? 'Excerpt and reflection saved to your account' : 'Excerpt and reflection saved on this device',
      ),
    )
}
function readCurrentChapter() {
  if (currentChapter.value)
    tools.startSpeech(
      `${currentChapter.value.title}。${currentChapter.value.paragraphs.join('\n')}`,
    )
}
function exportDocument() {
  if (!document.value) return
  const content = [
    document.value.title,
    document.value.author,
    t(
      '【家风中华行 · 原型演示文字，不是正式出版文件】',
      '[Family Heritage · prototype text, not an official publication]',
    ),
    ...document.value.chapters.map(
      (chapter) => `${chapter.title}\n\n${chapter.paragraphs.join('\n\n')}`,
    ),
    t(
      '使用说明：本导出只包含当前演示文字。未经实际权利核验；对外使用应依据相应内容授权。',
      'Use note: this export contains prototype text only. Actual rights have not been verified; external use depends on the relevant content permissions.',
    ),
  ].join('\n\n')
  tools.exportText(document.value.title, content)
}
</script>
<template>
  <view :class="['library-view', { 'library-en': locale === 'en' }]">
    <template v-if="source && document && currentChapter">
      <view class="library-reader-back">
        <wd-button variant="plain" size="small" @click="goBack()">
          {{ t('返回上一页', 'Back') }}
        </wd-button>
        <text class="library-demo-badge">
          {{
            document.isClassic
              ? t(
                  '原创典籍样章 · 非正式出版物',
                  'Original sample chapters · not a published volume',
                )
              : t('本机演示作品 · 非正式征集结果', 'Local sample work · not an official selection')
          }}
        </text>
        <wd-button variant="text" size="small" @click="navigate('library')">
          {{ t('浏览全部馆藏', 'Browse the library') }}
        </wd-button>
      </view>
      <view class="library-reader-hero">
        <view
          class="library-mini-book"
          :style="{
            backgroundColor: isClassic(source) ? source.coverColor : '#C41A1A',
            color:
              isClassic(source) && source.coverColor.toLowerCase() === '#c9a96e'
                ? '#2C2C2C'
                : '#F5F0E8',
          }"
        >
          <view class="library-mini-book-frame" />
          <text class="library-mini-book-label">{{ t('家风', 'Values') }}</text>
          <text class="library-mini-book-label">{{ t('选读', 'Read') }}</text>
        </view>
        <view class="library-reader-intro">
          <view class="library-reader-kicker">
            <text>{{ document.subtitle }}</text>
            <text>{{ optionLabel(regions, source.region) }}</text>
          </view>
          <text class="library-reader-title">{{ document.title }}</text>
          <text class="library-reader-author">{{ document.author }}</text>
          <text class="library-reader-summary">{{ document.excerpt }}</text>
          <view class="library-reader-tags">
            <text class="library-reader-tag">{{ optionLabel(genres, document.genre) }}</text>
            <text class="library-reader-tag" v-for="id in document.themes" :key="id">
              {{ optionLabel(themes, id) }}
            </text>
          </view>
        </view>
      </view>
      <view class="library-reading-toolbar">
        <view class="library-display-tools">
          <wd-button :variant="vertical ? 'plain' : 'base'" size="small" @click="vertical = false">
            {{ t('横排阅读', 'Horizontal') }}
          </wd-button>
          <wd-button :variant="vertical ? 'base' : 'plain'" size="small" @click="vertical = true">
            {{ t('竖排阅读', 'Vertical') }}
          </wd-button>
          <wd-button
            :variant="largeText ? 'base' : 'plain'"
            size="small"
            @click="largeText = !largeText"
          >
            {{ largeText ? t('大字已开启', 'Large text on') : t('大字模式', 'Large text') }}
          </wd-button>
        </view>
        <view class="library-display-tools">
          <wd-button
            :variant="isFavorite(source.id) ? 'base' : 'plain'"
            size="small"
            @click="favorite(source.id)"
          >
            {{
              isFavorite(source.id) ? t('★ 已收藏', '★ Saved') : t('☆ 收藏本篇', '☆ Save this text')
            }}
          </wd-button>
          <wd-button
            :variant="selectionMode ? 'base' : 'plain'"
            size="small"
            @click="toggleSelection"
          >
            {{
              selectionMode
                ? t('结束选段', 'Finish selecting')
                : t('选择段落摘抄', 'Select an excerpt')
            }}
          </wd-button>
        </view>
      </view>
      <view class="library-reading-layout">
        <view class="library-reader-sidebar">
          <view class="library-contents">
            <view class="library-side-heading">
              <text class="library-side-heading-text">{{ t('卷册目录', 'Contents') }}</text>
              <text class="library-side-heading-text">
                {{ document.chapters.length }} {{ t('章', 'chapters') }}
              </text>
            </view>
            <button
              v-for="(chapter, index) in document.chapters"
              :key="chapter.id"
              :class="['library-chapter-link', { active: chapterIndex === index }]"
              @click="setChapter(index)"
            >
              <text class="library-chapter-link-text">
                {{ String(index + 1).padStart(2, '0') }}
              </text>
              <text class="library-chapter-link-text">{{ chapter.title }}</text>
            </button>
            <text class="library-side-note">
              {{
                t(
                  '按章阅读，摘抄喜欢的段落。',
                  'Read by chapter and keep the paragraphs that matter to you.',
                )
              }}
            </text>
          </view>
          <view class="library-audio-panel">
            <text class="library-panel-title">{{ t('听一段家风', 'Listen to the chapter') }}</text>
            <text class="library-helper">
              {{
                speechSupported
                  ? t(
                      '使用设备已有的本机声音，实际效果取决于系统语音支持。',
                      'Uses an on-device voice. Availability depends on your system.',
                    )
                  : speechUnavailable
              }}
            </text>
            <view class="library-audio-buttons">
              <wd-button
                v-if="speechState === 'idle'"
                variant="plain"
                size="small"
                @click="readCurrentChapter"
              >
                {{
                  speechSupported
                    ? t('开始朗读', 'Start reading aloud')
                    : t('查看朗读说明', 'Audio availability')
                }}
              </wd-button>
              <wd-button v-if="speechState === 'starting'" disabled size="small">
                {{ t('等待设备开始', 'Waiting for the device') }}
              </wd-button>
              <wd-button
                v-if="speechState === 'playing'"
                variant="plain"
                size="small"
                @click="tools.pauseSpeech"
              >
                {{ t('暂停朗读', 'Pause') }}
              </wd-button>
              <wd-button
                v-if="speechState === 'paused'"
                variant="plain"
                size="small"
                @click="tools.resumeSpeech"
              >
                {{ t('继续朗读', 'Resume') }}
              </wd-button>
              <wd-button
                v-if="speechState !== 'idle'"
                variant="text"
                size="small"
                @click="tools.endSpeech"
              >
                {{ t('停止', 'Stop') }}
              </wd-button>
            </view>
            <text v-if="speechMessage" class="library-action-feedback">{{ speechMessage }}</text>
          </view>
        </view>
        <view class="library-reading-main">
          <view class="library-chapter-heading">
            <text class="library-chapter-number">
              {{ String(chapterIndex + 1).padStart(2, '0') }} /
              {{ String(document.chapters.length).padStart(2, '0') }}
            </text>
            <text class="library-chapter-title">{{ currentChapter.title }}</text>
            <text class="library-helper">
              {{
                t(
                  '演示原创选读 · 内容可供沟通与测试',
                  'Original sample reading · for discussion and testing',
                )
              }}
            </text>
          </view>
          <view v-if="selectionMode" class="library-select-guide">
            <wd-icon name="edit" />
            <text>
              {{
                t(
                  '点击正文段落进行多选，再到下方记录感想并保存。',
                  'Tap one or more paragraphs, then add a reflection and save below.',
                )
              }}
            </text>
          </view>
          <view v-if="vertical" class="library-vertical-tip">
            {{
              t(
                '竖排从右向左阅读，可左右滑动。',
                'Vertical text reads from right to left. Swipe sideways.',
              )
            }}
          </view>
          <scroll-view
            v-if="vertical"
            :key="document.id + chapterIndex + locale + largeText"
            scroll-x
            :scroll-left="1000000"
            class="library-vertical-scroll"
          >
            <view
              :class="[
                'library-vertical-prose',
                { 'library-large': largeText, selecting: selectionMode },
              ]"
            >
              <view
                v-for="(paragraph, index) in currentChapter.paragraphs"
                :key="index"
                :class="[
                  'library-vertical-paragraph',
                  { selected: selectedParagraphs.includes(index) },
                ]"
                @click="toggleParagraph(index)"
              >
                <text v-if="selectionMode" class="library-paragraph-number">
                  {{ selectedParagraphs.includes(index) ? '✓' : String(index + 1) }}
                </text>
                <text selectable class="library-paragraph-text">{{ paragraph }}</text>
              </view>
            </view>
          </scroll-view>
          <view
            v-else-if="formattedWork && !selectionMode"
            :class="['library-horizontal-prose', { 'library-large': largeText }]"
          >
            <rich-text :nodes="formattedWork" selectable />
          </view>
          <view
            v-else
            :class="[
              'library-horizontal-prose',
              { 'library-large': largeText, selecting: selectionMode },
            ]"
          >
            <view
              v-for="(paragraph, index) in currentChapter.paragraphs"
              :key="index"
              :class="[
                'library-horizontal-paragraph',
                { selected: selectedParagraphs.includes(index) },
              ]"
              @click="toggleParagraph(index)"
            >
              <text v-if="selectionMode" class="library-paragraph-number">
                {{ selectedParagraphs.includes(index) ? '✓' : String(index + 1).padStart(2, '0') }}
              </text>
              <text selectable class="library-paragraph-text">{{ paragraph }}</text>
            </view>
          </view>
          <view class="library-page-end">
            <text class="library-page-end-text">◆</text>
            <text class="library-page-end-text">
              {{ t('让一份好家风，成为日常的力量', 'Let family values strengthen everyday life') }}
            </text>
            <text class="library-page-end-text">◆</text>
          </view>
          <view class="library-chapter-navigation">
            <wd-button
              variant="plain"
              size="small"
              :disabled="chapterIndex === 0"
              @click="setChapter(chapterIndex - 1)"
            >
              {{ t('上一章', 'Previous chapter') }}
            </wd-button>
            <text class="library-helper">
              {{ chapterIndex + 1 }} / {{ document.chapters.length }}
            </text>
            <wd-button
              variant="plain"
              size="small"
              :disabled="chapterIndex >= document.chapters.length - 1"
              @click="setChapter(chapterIndex + 1)"
            >
              {{ t('下一章', 'Next chapter') }}
            </wd-button>
          </view>
        </view>
      </view>
      <view class="library-reading-support">
        <view class="library-glossary-panel">
          <wd-button
            v-if="isHttpMode"
            size="small"
            variant="plain"
            @click="
              navigate('assistant', {
                mode: 'knowledge',
                prompt:
                  t('请根据已发布资料，解释《', 'Using published sources, explain: ') +
                  (document?.title || '') +
                  t('》中的重点，并给出原文出处。', '. Cite the original sources.'),
              })
            "
          >
            {{ t('向 AI 提问（附来源）', 'Ask AI with sources') }}
          </wd-button>
          <text class="library-panel-title">
            {{ t('词义导读 · 编辑注解', 'Reading notes · editorial guidance') }}
          </text>
          <text class="library-helper">
            {{
              t(
                '产品原创注解样例，不是古籍原注或 AI 即时结果。',
                'Original prototype notes, not historical annotations or live AI output.',
              )
            }}
          </text>
          <view class="library-glossary-tabs">
            <button
              v-for="entry in glossary"
              :key="entry.id"
              :class="['library-glossary-chip', { active: currentGlossary?.id === entry.id }]"
              @click="glossaryId = entry.id"
            >
              {{ t(entry.term, entry.english) }}
            </button>
          </view>
          <view v-if="currentGlossary" class="library-glossary-detail">
            <text class="library-glossary-term">
              {{ t(currentGlossary.term, currentGlossary.english) }}
            </text>
            <text>{{ t(currentGlossary.meaning, currentGlossary.meaningEn) }}</text>
            <view class="library-reflect-prompt">
              <text class="library-reflect-text">{{ t('想一想', 'Reflect') }}</text>
              <text class="library-reflect-text">
                {{ t(currentGlossary.prompt, currentGlossary.promptEn) }}
              </text>
            </view>
          </view>
        </view>
        <view class="library-excerpt-panel">
          <view class="library-side-heading">
            <text class="library-side-heading-text">
              {{ t('我的阅读札记', 'My reading notes') }}
            </text>
            <text class="library-side-heading-text">
              {{ savedExcerptsCount }} {{ t('条', 'saved') }}
            </text>
          </view>
          <view v-if="!selectionMode" class="library-excerpt-intro">
            <text class="library-excerpt-mark">“</text>
            <text>
              {{
                t(
                  '留下打动你的句子，也留下此刻的想法。',
                  'Keep a sentence that moves you, along with your own reflection.',
                )
              }}
            </text>
            <wd-button variant="plain" size="small" @click="toggleSelection">
              {{ t('开始选择段落', 'Choose a paragraph') }}
            </wd-button>
          </view>
          <template v-else>
            <text v-if="!selectedText" class="library-helper library-excerpt-empty">
              {{
                t(
                  '请在上方正文中点击要摘抄的段落。',
                  'Tap a paragraph in the text above to select it.',
                )
              }}
            </text>
            <button v-else class="library-excerpt-selection" @click="excerptExpanded = true">
              <text>{{ selectedText }}</text>
              <text class="library-expand-label">
                {{ t('点击展开全文', 'Read the full excerpt') }} ↗
              </text>
            </button>
            <view class="library-excerpt-count">
              <text>
                {{ t('已选', 'Selected: ') }} {{ selectedParagraphs.length }}
                {{ t('段', 'paragraphs') }}
              </text>
              <text :class="{ 'library-too-long': selectedText.length > 2000 }">
                {{ selectedText.length }} / 2000
              </text>
            </view>
            <textarea
              :key="document.id + chapterIndex + locale + selectedParagraphs.join(',')"
              v-model="excerptNote"
              @blur="syncExcerptNote"
              @confirm="syncExcerptNote"
              class="library-note-input"
              maxlength="500"
              :placeholder="
                t(
                  '写下你的阅读感想（可选，最多500字）',
                  'Add a reflection (optional, up to 500 characters)',
                )
              "
              :aria-label="t('阅读感想', 'Reading reflection')"
            />
            <view class="library-excerpt-actions">
              <wd-button
                size="small"
                :disabled="!selectedText || selectedText.length > 2000 || archiveError"
                @click="saveSelectedExcerpt"
              >
                {{
                  existingExcerpt
                    ? t('更新感想', 'Update reflection')
                    : t('保存摘抄与感想', 'Save excerpt and reflection')
                }}
              </wd-button>
              <text v-if="existingExcerpt" class="library-action-feedback">
                {{
                  t(
                    '此段已保存，可继续修改感想。',
                    'This excerpt is saved. You can update your reflection.',
                  )
                }}
              </text>
            </view>
          </template>
          <view class="library-notebook-footer">
            <text class="library-helper">
              {{
                t('摘抄与感想仅保存在当前设备。', 'Excerpts and reflections stay on this device.')
              }}
            </text>
            <wd-button variant="text" size="small" @click="navigate('profile', { tab: 'archive' })">
              {{ t('查看我的摘抄', 'View my notes') }} →
            </wd-button>
          </view>
          <text v-if="archiveError" class="library-action-feedback">
            {{
              t(
                '本机存档不可用，请检查存储权限后重试。',
                'Local archive storage is unavailable. Check permissions and try again.',
              )
            }}
          </text>
        </view>
      </view>
      <view class="library-rights-panel">
        <view class="library-rights-copy">
          <text class="library-panel-title library-rights-text">
            {{ t('内容来源与使用说明', 'Content source and use') }}
          </text>
          <text class="library-rights-text">
            {{
              document.isClassic
                ? t(
                    '此卷为项目原创示例篇章，非历史古籍扫描件，也非正式出版典籍。',
                    'This volume contains original prototype chapters, not scanned historical manuscripts or an official publication.',
                  )
                : t(
                    '此篇为演示样例或本机体验者提交的文字，作者署名与内容均未进行真实权利核验。',
                    'This text is a prototype sample or a local user submission. Author names and content rights have not been independently verified.',
                  )
            }}
          </text>
          <text class="library-rights-text">
            {{
              t(
                '导出包含本篇全部可见章节与演示标识，供本次沟通使用；对外使用应以实际内容授权为准。',
                'Exports include the visible chapters and a prototype notice for this discussion. External use depends on actual content permissions.',
              )
            }}
          </text>
        </view>
        <view class="library-export-actions">
          <wd-button variant="plain" :disabled="exporting" @click="exportDocument">
            {{ exportLabel }}
          </wd-button>
          <text class="library-helper">
            {{
              tools.exportKind === 'download'
                ? t('H5 导出 UTF-8 文本文件', 'Web export: UTF-8 text file')
                : t(
                    '微信端复制文字，不生成下载文件',
                    'WeChat copies text; no download file is created',
                  )
            }}
          </text>
          <text v-if="exportMessage" class="library-action-feedback">{{ exportMessage }}</text>
        </view>
      </view>
      <view class="scope-note">
        {{
          t(
            '横竖排为前端阅读样式；微信竖排与设备朗读仍需单独真机验证。',
            'Horizontal and vertical modes are interface layouts. WeChat vertical text and device speech still require real-device verification.',
          )
        }}
      </view>
    </template>
    <template v-else-if="params.id">
      <view class="library-invalid">
        <wd-icon name="book" />
        <text class="section-title">
          {{ t('未找到这篇演示内容', 'This sample text was not found') }}
        </text>
        <text>
          {{
            t(
              '编号可能已失效，或这条本机记录已被清理。',
              'The ID may be invalid, or the local record may have been removed.',
            )
          }}
        </text>
        <wd-button variant="plain" @click="navigate('library')">
          {{ t('返回家风典藏', 'Return to the library') }}
        </wd-button>
      </view>
    </template>
    <template v-else>
      <SectionHeading
        :title="t('开卷有益，家风有源', 'Open a book. Discover our shared values.')"
        :eyebrow="t('家风典藏', 'Family heritage library')"
        :subtitle="
          t(
            '在文字里，与一代代人的智慧相遇。',
            'Find care, responsibility and wisdom in the words we pass on.',
          )
        "
      />
      <ResourceDirectory v-if="isHttpMode" />
      <view class="library-banner">
        <view>
          <text class="eyebrow">
            {{ t('家风典籍 · 数字阅读', 'Family stories · digital reading') }}
          </text>
          <text class="library-banner-title">
            {{
              t(
                '一卷藏家风\n书香续文脉',
                'A volume of family wisdom.\nA tradition carried in words.',
              )
            }}
          </text>
        </view>
        <text class="library-banner-seal">{{ t('典\n藏', 'READ') }}</text>
        <text class="library-banner-caption">
          {{ t('示例篇章 · 非正式出版典籍', 'Sample chapters · not published volumes') }}
        </text>
      </view>
      <view class="search-field">
        <wd-icon name="search-line" />
        <input
          v-model="query"
          :placeholder="t('搜索典籍与作品标题、摘要', 'Search book and story titles or summaries')"
          :aria-label="t('搜索典籍与作品', 'Search books and stories')"
        />
      </view>
      <view class="library-filter-panel">
        <view class="library-filter-row">
          <text class="library-filter-name">{{ t('卷册', 'Volumes') }}</text>
          <view class="library-filter-options">
            <button
              v-for="item in [
                { id: 'all', zh: '全部卷册', en: 'All volumes' },
                { id: 'national', zh: '全国总卷', en: 'National volume' },
                { id: 'regional', zh: '地方分卷', en: 'Regional volumes' },
              ]"
              :key="item.id"
              :class="['library-filter-chip', { active: volume === item.id }]"
              @click="volume = item.id"
            >
              {{ t(item.zh, item.en) }}
            </button>
          </view>
        </view>
        <view class="library-filter-row">
          <text class="library-filter-name">{{ t('体裁', 'Genre') }}</text>
          <scroll-view scroll-x class="library-filter-scroll">
            <view class="library-filter-options">
              <button
                :class="['library-filter-chip', { active: genre === 'all' }]"
                @click="genre = 'all'"
              >
                {{ t('全部体裁', 'All genres') }}
              </button>
              <button
                v-for="item in genres"
                :key="item.id"
                :class="['library-filter-chip', { active: genre === item.id }]"
                @click="genre = item.id"
              >
                {{ label(item.label) }}
              </button>
            </view>
          </scroll-view>
        </view>
        <view class="library-filter-row">
          <text class="library-filter-name">{{ t('主题', 'Theme') }}</text>
          <scroll-view scroll-x class="library-filter-scroll">
            <view class="library-filter-options">
              <button
                :class="['library-filter-chip', { active: theme === 'all' }]"
                @click="theme = 'all'"
              >
                {{ t('全部主题', 'All themes') }}
              </button>
              <button
                v-for="item in themes"
                :key="item.id"
                :class="['library-filter-chip', { active: theme === item.id }]"
                @click="theme = item.id"
              >
                {{ label(item.label) }}
              </button>
            </view>
          </scroll-view>
        </view>
      </view>
      <view class="library-results-line">
        <text class="section-title library-results-text">{{ t('典籍卷册', 'Book volumes') }}</text>
        <text class="library-results-text">
          {{ classics.length }} {{ t('卷 · 当前地区与筛选', 'volumes · current filters') }}
        </text>
      </view>
      <view class="book-grid">
        <view v-for="book in classics" :key="book.id" class="classic-card" @click="openItem(book)">
          <view
            class="classic-cover"
            :class="{ 'classic-cover-light': book.coverColor.toLowerCase() === '#c9a96e' }"
            :style="{
              backgroundColor: book.coverColor,
              color: book.coverColor.toLowerCase() === '#c9a96e' ? '#2C2C2C' : '#F5F0E8',
            }"
          >
            <view class="cover-thread" />
            <text class="library-cover-text">{{ reading(book).title }}</text>
            <text class="cover-seal library-cover-text">{{ t('家风', 'Values') }}</text>
          </view>
          <view class="library-book-meta">
            <text class="library-book-meta-text">
              {{
                book.region === 'all'
                  ? t('全国总卷', 'National volume')
                  : optionLabel(regions, book.region) + t('分卷', ' volume')
              }}
            </text>
            <text class="library-book-meta-text">
              {{ reading(book).chapters.length }} {{ t('章', 'chapters') }}
            </text>
          </view>
          <text class="classic-title">{{ reading(book).title }}</text>
          <text class="muted">{{ reading(book).subtitle }}</text>
          <text class="library-book-excerpt">{{ reading(book).excerpt }}</text>
        </view>
      </view>
      <view v-if="!classics.length" class="empty-state library-list-empty">
        <text>
          {{
            t(
              '当前地区或筛选下暂无典籍，可调整体裁、主题或卷册范围。',
              'No books match this region or filter. Try a different genre, theme or volume group.',
            )
          }}
        </text>
        <wd-button variant="plain" size="small" @click="resetFilters">
          {{ t('重置筛选', 'Reset filters') }}
        </wd-button>
      </view>
      <SectionHeading
        :title="t('家风作品选读', 'Read family stories')"
        :subtitle="
          t(
            '原创样例与本机演示投稿，不代表正式评选结果。',
            'Original samples and local demo submissions, not official selections.',
          )
        "
      />
      <view class="work-grid">
        <view v-for="work in filteredWorks" :key="work.id" class="work-card">
          <view class="story-meta">
            <text>{{ optionLabel(genres, work.genre) }}</text>
            <button class="favorite-button" @click="favorite(work.id)">
              {{ isFavorite(work.id) ? t('★ 已收藏', '★ Saved') : t('☆ 收藏', '☆ Save') }}
            </button>
          </view>
          <text class="story-title" @click="openItem(work)">{{ reading(work).title }}</text>
          <text class="story-excerpt" @click="openItem(work)">{{ reading(work).excerpt }}</text>
          <view class="library-work-themes">
            <text class="library-work-theme" v-for="id in reading(work).themes" :key="id">
              {{ optionLabel(themes, id) }}
            </text>
          </view>
          <view class="card-bottom">
            <text class="muted">{{ reading(work).author }}</text>
            <button class="text-button" @click="openItem(work)">
              {{ t('阅读全文', 'Read story') }} ↗
            </button>
          </view>
        </view>
      </view>
      <view v-if="!filteredWorks.length" class="empty-state library-list-empty">
        <text>
          {{
            t(
              '暂无匹配作品，试试其他筛选条件。',
              'No stories match these filters. Try another selection.',
            )
          }}
        </text>
        <wd-button variant="plain" size="small" @click="resetFilters">
          {{ t('重置筛选', 'Reset filters') }}
        </wd-button>
      </view>
      <view class="scope-note">
        {{ t('当前共匹配', 'Matching items: ') }} {{ totalMatches }}
        {{
          t(
            '条内容。卷册筛选仅作用于典籍；体裁与主题筛选同时作用于典籍和作品。',
            '. Volume filters apply to books; genre and theme filters apply to books and stories.',
          )
        }}
      </view>
    </template>
    <wd-popup
      v-model="excerptExpanded"
      :z-index="100"
      position="center"
      closable
      custom-class="content-popup"
    >
      <view class="dialog-body">
        <text class="section-title">{{ t('摘抄全文', 'Full excerpt') }}</text>
        <scroll-view scroll-y class="library-full-excerpt">
          <text selectable>{{ selectedText }}</text>
        </scroll-view>
        <wd-button variant="plain" @click="excerptExpanded = false">
          {{ t('收起并继续阅读', 'Close and continue reading') }}
        </wd-button>
      </view>
    </wd-popup>
  </view>
</template>
<style scoped lang="scss">
.library-view {
  color: var(--jf-ink, #2c2c2c);
}
.library-helper {
  display: block;
  font-size: 12px;
  line-height: 1.85;
  color: #646464;
}
.library-panel-title {
  display: block;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.8;
}
.library-reader-back {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 22px;
}
/* #ifdef H5 */
.library-reader-back > :last-child {
  margin-left: auto;
}
/* #endif */
.library-demo-badge {
  border: 1px solid #dfcaba;
  color: var(--jf-red, #c41a1a);
  padding: 4px 10px;
  font-size: 12px;
  background: #fcf5ed;
}
.library-reader-hero {
  display: flex;
  align-items: center;
  gap: 30px;
  padding: 32px 37px;
  background: #fffdf8;
  border: 1px solid #dfd3c1;
  border-top: 4px solid var(--jf-red, #c41a1a);
}
.library-mini-book {
  flex-shrink: 0;
  position: relative;
  width: 94px;
  height: 140px;
  box-shadow: 5px 6px 0 #d6c3a5;
  border-right: 7px double #e5dbc9;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #fffdf8;
}
.library-mini-book > .library-mini-book-label {
  writing-mode: vertical-rl;
  font:
    22px/1.5 'JiafengSerif',
    serif;
  letter-spacing: 3px;
}
.library-mini-book > .library-mini-book-label:last-child {
  font-size: 11px;
  border: 1px solid var(--jf-gold, #c9a96e);
  padding: 5px 2px;
}
.library-mini-book > .library-mini-book-frame {
  position: absolute;
  top: 13px;
  left: 7px;
  right: 7px;
  bottom: 13px;
  border: 1px solid rgba(245, 240, 232, 0.4);
  pointer-events: none;
}
.library-reader-intro {
  min-width: 0;
  flex: 1;
}
.library-reader-kicker {
  display: flex;
  gap: 16px;
  color: #616161;
  font-size: 12px;
  flex-wrap: wrap;
}
.library-reader-title {
  display: block;
  font:
    700 31px/1.75 'JiafengSerif',
    serif;
  margin: 7px 0;
}
.library-reader-author {
  color: #606060;
  font-size: 13px;
}
.library-reader-summary {
  display: block;
  font-size: 15px;
  line-height: 1.9;
  color: #414141;
  margin-top: 14px;
}
.library-reader-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 17px;
}
.library-reader-tags > .library-reader-tag {
  font-size: 11px;
  padding: 3px 9px;
  border: 1px solid #dfd0b8;
  color: #555;
  background: #f8f0e4;
}
.library-reading-toolbar {
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  flex-wrap: wrap;
  border: 1px solid #dfd3c1;
  border-top: 0;
  background: #f1e8da;
}
.library-display-tools {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.library-reading-layout {
  display: grid;
  grid-template-columns: 254px minmax(0, 1fr);
  gap: 25px;
  margin-top: 25px;
  align-items: start;
}
.library-contents,
.library-audio-panel {
  background: #fffdf8;
  border: 1px solid #dfd3c1;
}
.library-side-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 17px;
  font-size: 17px;
  font-weight: 700;
}
.library-side-heading > .library-side-heading-text:last-child {
  font-size: 12px;
  font-weight: 400;
  color: #666;
}
.library-contents .library-side-heading {
  padding: 20px;
}
.library-chapter-link {
  display: flex;
  gap: 13px;
  align-items: flex-start;
  text-align: left;
  font-size: 13px;
  line-height: 1.8;
  padding: 16px 20px;
  border-top: 1px solid #ece2d4;
  width: 100%;
}
.library-chapter-link.active {
  color: var(--jf-red, #c41a1a);
  background: #fceee8;
  border-left: 3px solid var(--jf-red, #c41a1a);
  padding-left: 17px;
  font-weight: 600;
}
.library-chapter-link > .library-chapter-link-text:first-child {
  flex-shrink: 0;
  color: var(--jf-red, #c41a1a);
}
.library-side-note {
  display: block;
  background: #f3ecdf;
  padding: 16px 20px;
  color: #626262;
  font-size: 11px;
  line-height: 1.85;
}
.library-audio-panel {
  padding: 22px 20px;
  margin-top: 20px;
}
.library-audio-panel .library-helper {
  margin-top: 10px;
}
.library-audio-buttons {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  margin-top: 17px;
}
.library-action-feedback {
  display: block;
  color: var(--jf-red, #c41a1a);
  font-size: 12px;
  line-height: 1.85;
  margin-top: 13px;
}
.library-reading-main {
  border: 1px solid #dfd3c1;
  background: #fffdf8;
  min-width: 0;
}
.library-chapter-heading {
  text-align: center;
  margin: 0 34px;
  padding: 31px 0 24px;
  border-bottom: 1px solid #e9decf;
}
.library-chapter-number {
  font:
    13px/1.5 Georgia,
    serif;
  color: var(--jf-red, #c41a1a);
  letter-spacing: 3px;
}
.library-chapter-title {
  display: block;
  font:
    700 24px/1.85 'JiafengSerif',
    serif;
  margin: 12px 0;
}
.library-select-guide {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--jf-red, #c41a1a);
  background: #fcf0e9;
  border-bottom: 1px solid #e7d5c4;
  padding: 15px 23px;
  font-size: 12px;
  line-height: 1.8;
}
.library-horizontal-prose {
  padding: 19px 34px 8px;
  min-height: 255px;
}
.library-horizontal-paragraph {
  position: relative;
  padding: 12px 10px;
  margin-bottom: 9px;
  border: 1px solid transparent;
}
.library-paragraph-text {
  font-family: 'JiafengSerif', serif;
  color: #333;
  font-size: 17px;
  line-height: 2.25;
  white-space: pre-wrap;
}
.library-horizontal-paragraph .library-paragraph-text {
  display: block;
}
.library-horizontal-prose.selecting .library-horizontal-paragraph {
  border: 1px dashed #d7c3a3;
  cursor: pointer;
  padding: 15px;
}
.library-horizontal-paragraph.selected,
.library-vertical-paragraph.selected {
  background: #fff0e8;
  border-color: var(--jf-red, #c41a1a) !important;
}
.library-paragraph-number {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--jf-red, #c41a1a);
  margin-bottom: 8px;
}
.library-large .library-paragraph-text {
  font-size: 21px;
  line-height: 2.3;
}
.library-vertical-tip {
  color: #666;
  font-size: 11px;
  text-align: center;
  margin: 17px 0 0;
}
.library-vertical-scroll {
  width: 100%;
}
.library-vertical-prose {
  display: flex;
  flex-direction: row-reverse;
  gap: 23px;
  width: max-content;
  min-width: 100%;
  padding: 26px 33px 30px;
  box-sizing: border-box;
}
.library-vertical-paragraph {
  display: flex;
  flex-direction: row-reverse;
  height: 370px;
  flex-shrink: 0;
  padding: 12px 16px;
  border: 1px solid transparent;
}
.library-vertical-paragraph .library-paragraph-text {
  display: block;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  height: 100%;
  letter-spacing: 3px;
}
.library-vertical-paragraph .library-paragraph-number {
  margin-left: 12px;
}
.library-vertical-prose.selecting .library-vertical-paragraph {
  border: 1px dashed #d7c3a3;
  cursor: pointer;
}
.library-page-end {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 20px 25px;
  font-size: 11px;
  color: #666;
}
.library-page-end > .library-page-end-text:first-child,
.library-page-end > .library-page-end-text:last-child {
  color: var(--jf-gold, #c9a96e);
}
.library-chapter-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  border-top: 1px solid #e9decf;
  padding: 20px 24px;
}
.library-reading-support {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 25px;
  margin-top: 25px;
  align-items: start;
}
.library-glossary-panel,
.library-excerpt-panel {
  border: 1px solid #dfd3c1;
  background: #fffdf8;
  padding: 27px;
}
.library-glossary-panel > .library-helper {
  margin-top: 7px;
}
.library-glossary-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 21px 0;
}
.library-glossary-chip {
  border: 1px solid #d7c8b0;
  padding: 7px 12px;
  font-size: 12px;
  border-radius: 2px;
  background: #faf4e9;
}
.library-glossary-chip.active {
  border-color: var(--jf-red, #c41a1a);
  background: #fcf0e8;
  color: var(--jf-red, #c41a1a);
}
.library-glossary-detail {
  font-size: 15px;
  line-height: 1.95;
}
.library-glossary-term {
  display: block;
  color: var(--jf-red, #c41a1a);
  font:
    700 22px/1.6 'JiafengSerif',
    serif;
  margin-bottom: 12px;
}
.library-reflect-prompt {
  margin-top: 24px;
  background: #f6eee1;
  border-left: 3px solid var(--jf-gold, #c9a96e);
  padding: 17px;
  font-size: 13px;
}
.library-reflect-prompt > .library-reflect-text {
  display: block;
}
.library-reflect-prompt > .library-reflect-text:first-child {
  font-weight: 600;
  color: var(--jf-red, #c41a1a);
  margin-bottom: 7px;
}
.library-excerpt-intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  font-size: 15px;
  line-height: 1.9;
}
.library-excerpt-mark {
  height: 41px;
  color: var(--jf-gold, #c9a96e);
  font:
    64px/1 Georgia,
    serif;
}
.library-excerpt-intro :deep(.wd-button) {
  margin-top: 6px;
}
.library-excerpt-empty {
  padding: 20px;
  border: 1px dashed #d8c4a5;
  background: #faf5ea;
}
.library-excerpt-selection {
  display: block;
  padding: 17px;
  font:
    14px/2 'JiafengSerif',
    serif;
  background: #f6eee1;
  border-left: 3px solid var(--jf-gold, #c9a96e);
  max-height: 190px;
  overflow: auto;
  white-space: pre-wrap;
  text-align: left;
  width: 100%;
  border-radius: 0;
  color: var(--jf-ink);
}
.library-expand-label {
  display: block;
  color: var(--jf-red);
  font:
    12px/1.8 'JiafengSans',
    sans-serif;
  margin-top: 8px;
}
.library-full-excerpt {
  height: 50vh;
  max-height: 460px;
  white-space: pre-wrap;
  line-height: 2;
  margin: 18px 0;
}
.library-excerpt-count {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  font-size: 11px;
  color: #666;
  margin: 10px 0 17px;
}
.library-too-long {
  color: var(--jf-red, #c41a1a);
}
.library-note-input {
  height: 114px;
  width: 100%;
  border: 1px solid #d9cbb8;
  background: #fffdf8;
  border-radius: 3px;
  padding: 13px;
  font-size: 13px;
  line-height: 1.8;
}
.library-excerpt-actions {
  margin-top: 18px;
}
.library-notebook-footer {
  border-top: 1px solid #e7dac7;
  margin-top: 24px;
  padding-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 13px;
  flex-wrap: wrap;
}
.library-notebook-footer :deep(.wd-button) {
  padding: 0;
}
.library-rights-panel {
  display: flex;
  align-items: center;
  gap: 35px;
  justify-content: space-between;
  background: #f1e8d9;
  border-top: 3px solid var(--jf-gold, #c9a96e);
  margin-top: 28px;
  padding: 27px 30px;
}
.library-rights-copy {
  flex: 1;
  font-size: 13px;
  line-height: 1.9;
}
.library-rights-copy > .library-rights-text {
  display: block;
  margin-bottom: 10px;
}
.library-export-actions {
  width: 255px;
  flex-shrink: 0;
}
.library-export-actions .library-helper {
  margin-top: 12px;
}
.library-invalid {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 50px 25px;
  background: #fffdf8;
  border: 1px solid #ddcfb8;
  align-items: center;
  text-align: center;
}
.library-invalid :deep(.wd-icon) {
  color: var(--jf-red, #c41a1a);
  font-size: 42px;
}
.library-view .library-banner-title {
  white-space: pre-line;
}
.library-view .library-banner-seal {
  white-space: pre-line;
}
.library-filter-panel {
  border: 1px solid #e0d3c0;
  background: #fffdf8;
  padding: 11px 23px;
  margin-top: 20px;
}
.library-filter-row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 13px 0;
  border-bottom: 1px solid #eee4d4;
}
.library-filter-row:last-child {
  border-bottom: 0;
}
.library-filter-name {
  min-width: 33px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
}
.library-filter-options {
  display: flex;
  gap: 9px;
  align-items: center;
}
.library-filter-scroll {
  min-width: 0;
  flex: 1;
  white-space: nowrap;
}
.library-filter-scroll .library-filter-options {
  display: inline-flex;
}
.library-filter-chip {
  font-size: 12px;
  padding: 7px 13px;
  white-space: nowrap;
  border: 1px solid transparent;
  border-radius: 3px;
  flex-shrink: 0;
  color: #4b4b4b;
}
.library-filter-chip.active {
  background: #fbeddf;
  color: var(--jf-red, #c41a1a);
  border-color: #ddbea9;
}
.library-results-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 17px;
  margin: 28px 0 6px;
}
.library-results-line > .library-results-text:last-child {
  color: #666;
  font-size: 12px;
}
.library-book-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  margin-top: 18px;
  color: #5b5b5b;
}
.library-book-meta > .library-book-meta-text:first-child {
  color: var(--jf-red, #c41a1a);
}
.library-view .classic-title {
  font-size: 19px;
  line-height: 1.7;
  margin-top: 9px;
}
.library-book-excerpt {
  display: block;
  font-size: 13px;
  line-height: 1.9;
  margin-top: 13px;
  color: #4d4d4d;
}
.library-view .classic-cover .cover-seal {
  color: inherit;
}
.library-list-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 17px;
}
.library-work-themes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.library-work-themes > .library-work-theme {
  font-size: 11px;
  color: #626262;
  background: #f2e9da;
  padding: 3px 8px;
}
.library-en .classic-cover > .library-cover-text:first-of-type {
  writing-mode: horizontal-tb;
  font-size: 22px;
  line-height: 1.6;
  letter-spacing: 0;
  max-width: 76%;
  text-align: center;
  padding: 14px 9px;
}
.library-en .cover-seal {
  writing-mode: horizontal-tb;
  letter-spacing: 1px;
  padding: 4px 6px;
}
.library-en .library-mini-book > .library-mini-book-label {
  writing-mode: horizontal-tb;
  font-size: 15px;
  letter-spacing: 0;
}
.library-en .library-mini-book {
  flex-direction: column;
}
.library-en .library-mini-book > .library-mini-book-label:last-child {
  font-size: 11px;
}
@media (max-width: 900px) {
  .library-reading-layout {
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 20px;
  }
  .library-reader-hero {
    padding: 27px;
    gap: 24px;
  }
  .library-reader-title {
    font-size: 27px;
  }
  .library-reading-support {
    gap: 20px;
  }
  .library-glossary-panel,
  .library-excerpt-panel {
    padding: 22px;
  }
  .library-horizontal-prose {
    padding-left: 22px;
    padding-right: 22px;
  }
  .library-rights-panel {
    gap: 22px;
    padding: 25px;
  }
  .library-export-actions {
    width: 220px;
  }
}
@media (max-width: 640px) {
  .library-reader-back {
    gap: 10px;
    margin-bottom: 16px;
  }
  /* #ifdef H5 */
  .library-reader-back > :last-child {
    margin-left: 0;
  }
  /* #endif */
  .library-demo-badge {
    font-size: 10px;
  }
  .library-reader-hero {
    align-items: flex-start;
    padding: 23px 19px;
    gap: 18px;
  }
  .library-mini-book {
    width: 61px;
    height: 97px;
    margin-top: 5px;
    border-right-width: 5px;
    gap: 3px;
  }
  .library-mini-book > .library-mini-book-label {
    font-size: 18px;
  }
  .library-mini-book > .library-mini-book-label:last-child {
    font-size: 9px;
    padding: 4px 1px;
  }
  .library-mini-book > .library-mini-book-frame {
    inset: 7px 5px;
  }
  .library-en .library-mini-book > .library-mini-book-label {
    font-size: 12px;
  }
  .library-reader-title {
    font-size: 23px;
    line-height: 1.7;
  }
  .library-reader-kicker {
    font-size: 10px;
    gap: 7px;
  }
  .library-reader-author {
    font-size: 11px;
  }
  .library-reader-summary {
    font-size: 13px;
  }
  .library-reader-tags {
    margin-top: 14px;
    gap: 5px;
  }
  .library-reader-tags > .library-reader-tag {
    font-size: 10px;
    padding: 3px 7px;
  }
  .library-reading-toolbar {
    padding: 16px;
    gap: 11px;
  }
  .library-display-tools {
    gap: 7px;
  }
  .library-display-tools :deep(.wd-button) {
    font-size: 11px;
    padding-left: 10px;
    padding-right: 10px;
  }
  .library-reading-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
    margin-top: 20px;
  }
  .library-reader-sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .library-audio-panel {
    margin-top: 0;
    padding: 20px;
  }
  .library-side-heading {
    font-size: 16px;
  }
  .library-chapter-link {
    padding-top: 12px;
    padding-bottom: 12px;
    font-size: 13px;
  }
  .library-side-note {
    padding-top: 13px;
    padding-bottom: 13px;
  }
  .library-chapter-heading {
    padding-top: 26px;
    margin: 0 20px;
  }
  .library-chapter-title {
    font-size: 22px;
  }
  .library-chapter-heading .library-helper {
    font-size: 10px;
  }
  .library-horizontal-prose {
    padding: 14px 18px 4px;
    min-height: 230px;
  }
  .library-paragraph-text {
    font-size: 16px;
    line-height: 2.1;
  }
  .library-horizontal-paragraph {
    padding: 10px 3px;
  }
  .library-horizontal-prose.selecting .library-horizontal-paragraph {
    padding: 12px;
  }
  .library-large .library-paragraph-text {
    font-size: 20px;
  }
  .library-select-guide {
    padding: 13px 18px;
    font-size: 11px;
  }
  .library-vertical-prose {
    padding: 22px 16px;
    gap: 16px;
  }
  .library-vertical-paragraph {
    height: 350px;
    padding: 10px 12px;
  }
  .library-vertical-paragraph .library-paragraph-text {
    letter-spacing: 2px;
  }
  .library-page-end {
    font-size: 10px;
    gap: 10px;
    padding-left: 15px;
    padding-right: 15px;
  }
  .library-chapter-navigation {
    padding: 18px 17px;
    gap: 9px;
  }
  .library-chapter-navigation :deep(.wd-button) {
    font-size: 11px;
    padding-left: 12px;
    padding-right: 12px;
  }
  .library-reading-support {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
    margin-top: 18px;
  }
  .library-glossary-panel,
  .library-excerpt-panel {
    padding: 23px 21px;
  }
  .library-panel-title {
    font-size: 16px;
  }
  .library-glossary-detail {
    font-size: 14px;
  }
  .library-note-input {
    font-size: 13px;
  }
  .library-excerpt-selection {
    font-size: 14px;
  }
  .library-notebook-footer {
    gap: 8px;
  }
  .library-rights-panel {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
    padding: 25px 22px;
  }
  .library-export-actions {
    width: auto;
  }
  .library-rights-copy {
    font-size: 12px;
  }
  .library-filter-panel {
    padding: 8px 14px;
  }
  .library-filter-row {
    gap: 9px;
  }
  .library-filter-name {
    font-size: 12px;
    min-width: 27px;
  }
  .library-filter-options {
    gap: 4px;
  }
  .library-filter-chip {
    font-size: 11px;
    padding: 6px 9px;
  }
  .library-filter-row:first-child .library-filter-options {
    flex-wrap: wrap;
  }
  .library-results-line {
    gap: 10px;
    align-items: flex-start;
  }
  .library-results-line > .library-results-text:last-child {
    font-size: 11px;
    text-align: right;
  }
  .library-view .classic-card {
    padding: 14px;
  }
  .library-view .classic-title {
    font-size: 17px;
  }
  .library-book-meta {
    font-size: 10px;
  }
  .library-book-excerpt {
    font-size: 12px;
  }
  .library-view .card-bottom {
    flex-wrap: wrap;
  }
  .library-en .classic-cover > .library-cover-text:first-of-type {
    font-size: 18px;
    max-width: 79%;
    padding: 12px 7px;
  }
  .library-en .library-banner-title {
    font-size: 24px;
    max-width: 90%;
  }
}
</style>
