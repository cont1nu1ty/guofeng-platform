<script setup lang="ts">
import { computed, ref } from 'vue'
import SectionHeading from './SectionHeading.vue'
import { navigate, openReader, works, regionLabel, repo, region } from '../composables/useDemo'
import type { Screen } from '../composables/useDemo'
const query = ref('')
const selectedTopic = ref('全部')
const topics = ['全部', '红色家风', '清廉家风', '百姓家风', '先贤文脉']
const entries: { label: string; sub: string; icon: string; screen?: Screen; feature?: string }[] = [
  { label: '家风投稿', sub: '以文传家', icon: 'edit', screen: 'submit' },
  { label: '典籍馆藏', sub: '书香致远', icon: 'book', screen: 'library' },
  { label: '清廉课堂', sub: '清风润家', icon: 'lock', screen: 'learning' },
  { label: '短视频展播', sub: '帧藏家风', icon: 'play-circle', feature: '短视频展播' },
  { label: '线上传习', sub: '知行合一', icon: 'company', screen: 'learning' },
  { label: '先贤名人馆', sub: '寻迹文脉', icon: 'home', feature: '先贤名人馆' },
  { label: '文创商城', sub: '好礼传情', icon: 'gift', feature: '文创商城' },
  { label: 'AI 家风助手', sub: '落笔有方', icon: 'message', screen: 'assistant' },
]
const emit = defineEmits<{ feature: [name: string] }>()
const filtered = computed(() =>
  works.value.filter(
    (w) =>
      (!query.value || (w.title + w.excerpt + w.author).includes(query.value)) &&
      (selectedTopic.value === '全部' || w.tags.includes(selectedTopic.value)),
  ),
)
const searchClassics = computed(() =>
  query.value
    ? repo
        .listClassics()
        .filter(
          (w) =>
            (region.value === 'all' || w.region === region.value || w.region === 'all') &&
            (w.title + w.excerpt).includes(query.value),
        )
    : [],
)
const searchActivities = computed(() =>
  query.value
    ? repo
        .listActivities({ region: region.value })
        .filter((w) => (w.title + w.excerpt).includes(query.value))
    : [],
)
</script>
<template>
  <view class="welcome-line">
    <text>一脉家风，万家共鸣。</text>
    <text class="muted">{{ regionLabel }}站 · 共建共享</text>
  </view>
  <view class="hero">
    <view class="hero-copy">
      <text class="hero-kicker">家风中华行 · 文化共建计划</text>
      <text class="hero-title">
        让好家风
        <br />
        代代相传
      </text>
      <text class="hero-description">
        以一封家书，珍藏家的温度。
        <br />
        以千万个家的故事，续写中华文脉。
      </text>
      <wd-button custom-class="hero-button" @click="navigate('submit')">
        写下我的家风故事
        <text class="button-arrow">↗</text>
      </wd-button>
      <view class="hero-foot">
        <text class="hero-line" />
        <text>八大文学体裁 · 面向全民征集</text>
      </view>
    </view>
    <view class="hero-art">
      <view class="art-orbit orbit-one" />
      <view class="art-orbit orbit-two" />
      <view class="art-sun" />
      <view class="art-mountain mountain-back" />
      <view class="art-mountain mountain-front" />
      <view class="book book-back">
        <view class="book-thread" />
        <text>家风大典</text>
      </view>
      <view class="book book-front">
        <view class="book-thread" />
        <text>一纸家书</text>
        <text class="book-small">见字如面　家国同心</text>
      </view>
      <view class="art-seal">传承</view>
      <text class="art-caption">以家为起点　让文化有回响</text>
    </view>
  </view>
  <view class="announcement" @click="navigate('review')">
    <view class="notice-symbol">告</view>
    <text class="notice-title">征集公告</text>
    <text class="notice-copy">「家书里的中国」主题作品征集 · 演示活动</text>
    <text class="arrow">→</text>
  </view>
  <view class="entry-grid">
    <button
      v-for="item in entries"
      :key="item.label"
      class="entry-button"
      @click="item.screen ? navigate(item.screen) : emit('feature', item.feature!)"
    >
      <view class="entry-icon"><wd-icon :name="item.icon" size="25px" /></view>
      <text class="entry-label">{{ item.label }}</text>
      <text class="entry-sub">{{ item.sub }}</text>
    </button>
  </view>
  <view class="home-columns">
    <view class="home-main">
      <SectionHeading
        title="万家故事，皆有回响"
        eyebrow="STORIES OF FAMILY"
        subtitle="在平凡日常里，读懂家风的力量。"
      >
        <button class="text-button" @click="navigate('library')">更多作品 ↗</button>
      </SectionHeading>
      <view class="story-filters">
        <button
          v-for="topic in topics"
          :key="topic"
          :class="['filter-chip', { active: selectedTopic === topic }]"
          @click="selectedTopic = topic"
        >
          {{ topic }}
        </button>
      </view>
      <view class="search-field">
        <wd-icon name="search-line" size="19px" />
        <input
          v-model="query"
          placeholder="搜索作品、典籍、活动"
          aria-label="搜索作品、典籍、活动"
        />
        <button v-if="query" class="text-button" @click="query = ''">清除</button>
      </view>
      <view
        v-for="(work, index) in filtered.slice(0, 3)"
        :key="work.id"
        class="story-row"
        @click="openReader(work)"
      >
        <view :class="['story-art', 'story-art-' + index]">
          <text>{{ ['家书', '家训', '家风'][index] }}</text>
          <view class="story-art-line" />
        </view>
        <view class="story-copy">
          <view class="story-meta">
            <text>{{ work.tags[0] }}</text>
            <text>· {{ work.author }}</text>
          </view>
          <text class="story-title">{{ work.title }}</text>
          <text class="story-excerpt">{{ work.excerpt }}</text>
          <text class="story-link">
            阅读故事
            <text>↗</text>
          </text>
        </view>
      </view>
      <view v-if="!filtered.length" class="empty-state">暂未找到作品，试试其他地区或关键词。</view>
      <view
        v-for="item in searchClassics"
        :key="item.id"
        class="search-result"
        @click="openReader(item)"
      >
        <text class="tag">典籍</text>
        {{ item.title }}
        <text>↗</text>
      </view>
      <view
        v-for="item in searchActivities"
        :key="item.id"
        class="search-result"
        @click="navigate('learning')"
      >
        <text class="tag">活动</text>
        {{ item.title }}
        <text>↗</text>
      </view>
    </view>
    <view class="home-side">
      <view class="quote-panel">
        <text class="eyebrow">今日家训</text>
        <text class="quote-text">
          忠厚传家久
          <br />
          诗书继世长
        </text>
        <view class="fine-line" />
        <text class="quote-note">
          把日子过成家风
          <br />
          把家风传给下一代
        </text>
        <button class="text-button" @click="navigate('library')">走进典籍馆藏 →</button>
      </view>
      <view class="mini-feature" @click="navigate('learning')">
        <text class="eyebrow">家风传习 · 活动预告</text>
        <text class="mini-feature-title">
          寻一处书院
          <br />
          赴一场家风之约
        </text>
        <view class="feature-bottom">
          <text>查看研学活动</text>
          <text>↗</text>
        </view>
      </view>
    </view>
  </view>
  <view class="vision-strip">
    <view>
      <text class="vision-number">
        34
        <text>个</text>
      </text>
      <text>省级分区规划</text>
    </view>
    <view>
      <text class="vision-number">
        08
        <text>类</text>
      </text>
      <text>家风文学体裁</text>
    </view>
    <view>
      <text class="vision-number">
        06
        <text>级</text>
      </text>
      <text>拟定评审流程</text>
    </view>
    <view class="vision-caption">
      <text>
        汇万家之美
        <br />
        成中华家风
      </text>
      <text class="muted">愿景展示 · 非运营数据</text>
    </view>
  </view>
</template>
