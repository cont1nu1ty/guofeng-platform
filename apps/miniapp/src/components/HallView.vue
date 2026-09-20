<script setup lang="ts">
import { readInputValue } from '../composables/readInputValue'
import { computed, ref, watch } from 'vue'
import SectionHeading from './SectionHeading.vue'
import { hallPeople, type BilingualText } from '../domain/showcaseCatalog'
import { navigate, goBack, useRouteParams } from '../composables/useNavigation'
import { t } from '../composables/useLocale'
const params = useRouteParams()
const lt = (value: BilingualText) => t(value.zh, value.en)
const current = computed(() => hallPeople.find((person) => person.id === params.value.id))
const regionFilter = ref('all')
const activeScene = ref(0)
const selectedHotspot = ref(0)
const reflection = ref('')
const reflectionSaved = ref(false)
const reflectionEditorVersion = ref(0)
watch(
  reflection,
  () => {
    reflectionSaved.value = false
  },
  { flush: 'sync' },
)
const guideOpen = ref(true)
const visiblePeople = computed(() =>
  hallPeople.filter(
    (person) => regionFilter.value === 'all' || person.region === regionFilter.value,
  ),
)
const scenes = computed(() => [
  t('序厅 · 读一段家训', 'Entrance · read a precept'),
  t('书斋 · 看一册家书', 'Study · explore a letter'),
  t('传习 · 留一句约定', 'Practice · make a promise'),
])
const hotspotLabels = computed(() => [
  t('家训题壁', 'Inscription'),
  t('书册展台', 'Book display'),
  t('文脉图示', 'Heritage diagram'),
])
const hotspotDescriptions = computed(() =>
  current.value
    ? [
        `${lt(current.value.quote)} ${t('此处为家训精神的文字展陈，题壁为原创排版示意。', 'An original typographic display of the precept’s central idea.')}`,
        `${lt(current.value.book)} · ${t('以原创书册图形呈现内容入口，非古籍影印或实物文物。', 'The original book illustration introduces the text; it is not a reproduction of an artefact.')}`,
        t(
          '以“长辈—家书—后辈”的关系图理解代际传承；此图为研学示意，并非人物真实家谱。',
          'An educational diagram connecting elders, letters and younger generations; it is not a historical genealogy.',
        ),
      ]
    : [],
)
watch(
  () => params.value.id,
  () => {
    activeScene.value = 0
    selectedHotspot.value = 0
    reflection.value = ''
    reflectionSaved.value = false
    guideOpen.value = true
  },
)
function selectScene(index: number) {
  activeScene.value = index
  selectedHotspot.value = Math.min(index, 2)
}
function selectHotspot(index: number) {
  selectedHotspot.value = index
  guideOpen.value = true
}
function saveReflection() {
  if (reflection.value.trim().length < 4) {
    uni.showToast({
      title: t('请写下至少 4 个字的家庭约定', 'Write a promise of at least 4 characters.'),
      icon: 'none',
    })
    return
  }
  try {
    uni.setStorageSync(`jiafeng:reflection:${current.value?.id}`, reflection.value.trim())
    reflectionSaved.value = true
  } catch {
    uni.showToast({
      title: t('本机存储不可用，约定未保存', 'Storage unavailable. Your promise was not saved.'),
      icon: 'none',
    })
  }
}
function restoreReflection() {
  try {
    const saved = uni.getStorageSync(`jiafeng:reflection:${current.value?.id}`)
    if (typeof saved === 'string') {
      reflection.value = saved
      reflectionEditorVersion.value++
      reflectionSaved.value = true
    }
  } catch {
    uni.showToast({
      title: t('无法读取本机约定', 'Could not load the saved promise.'),
      icon: 'none',
    })
  }
}
function copySource() {
  if (current.value)
    uni.setClipboardData({
      data: current.value.sourceUrl,
      fail() {
        uni.showToast({
          title: t('复制未完成，请稍后重试', 'Copy failed. Please try again.'),
          icon: 'none',
        })
      },
    })
}
</script>

<template>
  <view class="showcase-view">
    <template v-if="current">
      <view class="showcase-breadcrumb">
        <wd-button size="small" variant="plain" @click="goBack()">
          {{ t('返回名人馆', 'Back to galleries') }}
        </wd-button>
        <text>{{ lt(current.regionName) }}</text>
      </view>
      <view class="hall-detail-hero">
        <view class="hall-name-seal">
          <text>{{ current.name.zh }}</text>
        </view>
        <view>
          <text class="showcase-kicker">
            {{ lt(current.era) }} · {{ t('人物档案', 'Profile') }}
          </text>
          <text class="showcase-title">{{ lt(current.name) }}</text>
          <text class="hall-hero-quote">{{ lt(current.theme) }}</text>
          <text class="showcase-description">{{ lt(current.introduction) }}</text>
        </view>
      </view>
      <view class="showcase-detail-layout">
        <view>
          <view class="showcase-panel hall-tour-panel">
            <view class="showcase-row-between">
              <view>
                <text class="showcase-card-title">
                  {{ t('走进主题展厅', 'Explore the thematic gallery') }}
                </text>
                <text class="showcase-note">
                  {{
                    t(
                      '原创图文导览 · 点击标记阅读展签',
                      'Original illustrated tour · tap a marker to read',
                    )
                  }}
                </text>
              </view>
              <text class="showcase-number">0{{ activeScene + 1 }} / 03</text>
            </view>
            <view class="showcase-filter hall-scene-tabs">
              <wd-button
                v-for="(scene, index) in scenes"
                :key="index"
                size="small"
                :variant="activeScene !== index ? 'plain' : 'base'"
                @click="selectScene(index)"
              >
                {{ scene }}
              </wd-button>
            </view>
            <view :class="['hall-tour-scene', 'hall-scene-' + activeScene]">
              <view class="hall-scene-wall">
                <view class="hall-wall-scroll">
                  <text>
                    {{
                      activeScene === 0
                        ? current.quote.zh
                        : activeScene === 1
                          ? current.book.zh
                          : '家和 · 国兴'
                    }}
                  </text>
                </view>
              </view>
              <view class="hall-desk">
                <view class="hall-open-book">
                  <text>{{ current.book.zh }}</text>
                </view>
              </view>
              <view class="hall-genealogy">
                <text>{{ t('长辈', 'Elders') }}</text>
                <view />
                <text>{{ t('家书', 'Letters') }}</text>
                <view />
                <text>{{ t('后辈', 'Younger generation') }}</text>
              </view>
              <button
                v-for="(hotspot, index) in hotspotLabels"
                :key="hotspot"
                :class="[
                  'hall-hotspot',
                  'hall-hotspot-' + index,
                  { active: selectedHotspot === index },
                ]"
                :aria-label="hotspot"
                @click="selectHotspot(index)"
              >
                {{ index + 1 }}
              </button>
              <text class="hall-scene-caption">{{ scenes[activeScene] }}</text>
            </view>
            <view v-if="guideOpen" class="hall-exhibit-label">
              <text class="showcase-kicker">
                {{ t('展签', 'Exhibit label') }} 0{{ selectedHotspot + 1 }}
              </text>
              <text class="showcase-card-title">{{ hotspotLabels[selectedHotspot] }}</text>
              <text>{{ hotspotDescriptions[selectedHotspot] }}</text>
            </view>
            <view class="showcase-actions">
              <wd-button
                size="small"
                variant="plain"
                :disabled="activeScene === 0"
                @click="selectScene(activeScene - 1)"
              >
                {{ t('上一展区', 'Previous') }}
              </wd-button>
              <wd-button
                size="small"
                :disabled="activeScene === 2"
                @click="selectScene(activeScene + 1)"
              >
                {{ t('下一展区', 'Next') }}
              </wd-button>
              <wd-button size="small" variant="plain" @click="guideOpen = !guideOpen">
                {{ guideOpen ? t('收起展签', 'Hide label') : t('展开讲解', 'Read label') }}
              </wd-button>
            </view>
          </view>
          <view class="showcase-panel">
            <text class="showcase-card-title">
              {{ t('一段家训，三次思考', 'A precept and three reflections') }}
            </text>
            <view v-for="(note, index) in current.notes" :key="index" class="showcase-script-line">
              <text class="showcase-step">0{{ index + 1 }}</text>
              <text>{{ lt(note) }}</text>
            </view>
          </view>
          <view class="showcase-panel hall-reflection">
            <text class="showcase-card-title">
              {{ t('把家训带回家', 'Bring the precept home') }}
            </text>
            <text class="showcase-description">
              {{
                t(
                  '今天，你愿意和家人共同实践哪一件小事？',
                  'What small promise would you like to practise with your family?',
                )
              }}
            </text>
            <textarea
              @blur="reflection = readInputValue($event, reflection)"
              @confirm="reflection = readInputValue($event, reflection)"
              v-model="reflection"
              :key="reflectionEditorVersion"
              class="showcase-textarea"
              :maxlength="180"
              :placeholder="
                t(
                  '例如：每周留出一晚，和家人共读一封家书。',
                  'For example: read a family letter together one evening a week.',
                )
              "
            />
            <view class="showcase-actions">
              <wd-button size="small" @click="saveReflection">
                {{
                  reflectionSaved
                    ? t('已保存到本机', 'Saved on this device')
                    : t('保存我的约定', 'Save my promise')
                }}
              </wd-button>
              <wd-button size="small" variant="plain" @click="restoreReflection">
                {{ t('读取已存约定', 'Load saved promise') }}
              </wd-button>
            </view>
          </view>
        </view>
        <view class="showcase-side-panel">
          <view class="hall-book-display">
            <view class="hall-book-spine" />
            <text>{{ current.book.zh }}</text>
            <text class="hall-book-author">{{ current.name.zh }}</text>
          </view>
          <view class="showcase-callout">
            <text class="showcase-card-title">{{ t('展览资料说明', 'About this gallery') }}</text>
            <text>
              {{
                t(
                  '人物介绍依据公开资料简写；展厅、书册及关系图均为原创示意，不对应真实场馆、文物或家谱。当前展示为图文导览。',
                  'Profiles are brief summaries of public sources. The gallery, book and relationship diagram are original illustrations and do not depict a real museum, artefact or genealogy. This is an illustrated tour.',
                )
              }}
            </text>
            <text class="showcase-note" selectable>{{ current.sourceTitle }}</text>
            <wd-button size="small" variant="plain" @click="copySource">
              {{ t('复制资料来源链接', 'Copy source link') }}
            </wd-button>
          </view>
        </view>
      </view>
    </template>
    <template v-else-if="params.id">
      <view class="empty-state">
        {{ t('没有找到这位人物的展厅', 'Gallery not found') }}
        <wd-button size="small" @click="navigate('hall')">
          {{ t('返回人物列表', 'Browse profiles') }}
        </wd-button>
      </view>
    </template>
    <template v-else>
      <SectionHeading
        :title="t('走近先贤，读懂家国', 'Meet the thinkers behind the precepts')"
        :eyebrow="t('先贤名人馆 · 文脉相传', 'HERITAGE GALLERIES')"
        :subtitle="
          t(
            '以一封家书连接古今，以一段家训照见日常。',
            'Connect the past and present through letters and family instructions.',
          )
        "
      />
      <view class="hall-intro-band">
        <view class="hall-intro-character">传</view>
        <view>
          <text class="showcase-title">
            {{ t('一馆一人物，一展一家风', 'One gallery, one family tradition') }}
          </text>
          <text>
            {{
              t(
                '人物档案 · 家训选读 · 原创展陈 · 图文导览',
                'Profiles · precepts · original exhibits · illustrated tours',
              )
            }}
          </text>
        </view>
        <text class="hall-intro-count">
          02
          <text>{{ t('个主题展', 'galleries') }}</text>
        </text>
      </view>
      <view class="showcase-filter">
        <wd-button
          v-for="item in [
            { id: 'all', label: t('全部地区', 'All regions') },
            { id: 'sichuan', label: t('四川主题', 'Sichuan') },
            { id: 'jiangsu', label: t('江苏主题', 'Jiangsu') },
          ]"
          :key="item.id"
          size="small"
          :variant="regionFilter !== item.id ? 'plain' : 'base'"
          @click="regionFilter = item.id"
        >
          {{ item.label }}
        </wd-button>
      </view>
      <view class="hall-people-grid">
        <view
          v-for="person in visiblePeople"
          :key="person.id"
          class="showcase-card hall-person-card"
          @click="navigate('hall', { id: person.id })"
        >
          <view class="hall-person-art">
            <view class="hall-arch" />
            <text class="hall-person-seal">{{ person.name.zh }}</text>
            <text class="hall-person-book">{{ person.book.zh }}</text>
            <text class="hall-art-caption">
              {{ t('原创文字展陈', 'Original typographic exhibit') }}
            </text>
          </view>
          <view class="showcase-card-body">
            <text class="showcase-kicker">{{ lt(person.regionName) }} · {{ lt(person.era) }}</text>
            <text class="showcase-title">{{ lt(person.name) }}</text>
            <text class="hall-list-quote">{{ lt(person.theme) }}</text>
            <text class="showcase-description">{{ lt(person.introduction) }}</text>
            <view class="showcase-card-foot">
              <text>{{ t('3 个导览展区', '3 gallery scenes') }}</text>
              <text>{{ t('进入展厅 →', 'Enter gallery →') }}</text>
            </view>
          </view>
        </view>
      </view>
      <view class="scope-note">
        {{
          t(
            '本期提供原创图文展厅；720° 全景与真实文物数字采集需要另行提供授权素材。',
            'This edition provides original illustrated galleries. Panoramas and digitised artefacts require separately licensed materials.',
          )
        }}
      </view>
    </template>
  </view>
</template>
