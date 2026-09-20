<script setup lang="ts">
import { computed, ref } from 'vue'
import SectionHeading from './SectionHeading.vue'
import { repo, openReader, works, region, favorite, isFavorite } from '../composables/useDemo'
import { genres } from '../domain/fixtures'
const query = ref('')
const genre = ref('all')
const classics = computed(() =>
  repo
    .listClassics()
    .filter(
      (c) =>
        (region.value === 'all' || c.region === region.value || c.region === 'all') &&
        (!query.value || (c.title + c.excerpt).includes(query.value)),
    ),
)
const filtered = computed(() =>
  works.value.filter(
    (w) =>
      (genre.value === 'all' || w.genre === genre.value) &&
      (!query.value || (w.title + w.excerpt).includes(query.value)),
  ),
)
</script>
<template>
  <SectionHeading
    title="开卷有益，家风有源"
    eyebrow="THE FAMILY CULTURE LIBRARY"
    subtitle="在文字里，与一代代人的智慧相遇。"
  />
  <view class="library-banner">
    <view>
      <text class="eyebrow">家风典籍 · 数字阅读</text>
      <text class="library-banner-title">
        一卷藏家风
        <br />
        书香续文脉
      </text>
    </view>
    <text class="library-banner-seal">
      典
      <br />
      藏
    </text>
    <text class="library-banner-caption">示例篇章 · 非正式出版典籍</text>
  </view>
  <view class="search-field">
    <wd-icon name="search-line" />
    <input v-model="query" placeholder="搜索典籍与优秀作品" aria-label="搜索典籍与优秀作品" />
  </view>
  <view class="book-grid">
    <view v-for="book in classics" :key="book.id" class="classic-card" @click="openReader(book)">
      <view class="classic-cover" :style="{ backgroundColor: book.coverColor }">
        <view class="cover-thread" />
        <text>{{ book.title }}</text>
        <text class="cover-seal">家风</text>
      </view>
      <text class="classic-title">{{ book.title }}</text>
      <text class="muted">{{ book.subtitle }}</text>
    </view>
  </view>
  <view v-if="!classics.length" class="empty-state">该地区暂无匹配典籍，可切换全国查看。</view>
  <SectionHeading title="优秀作品选读" subtitle="此处文章均为虚构演示文本" />
  <scroll-view scroll-x class="horizontal-scroll">
    <view class="story-filters">
      <button :class="['filter-chip', { active: genre === 'all' }]" @click="genre = 'all'">
        全部体裁
      </button>
      <button
        v-for="g in genres"
        :key="g.id"
        :class="['filter-chip', { active: genre === g.id }]"
        @click="genre = g.id"
      >
        {{ g.label }}
      </button>
    </view>
  </scroll-view>
  <view class="work-grid">
    <view v-for="work in filtered" :key="work.id" class="work-card">
      <view class="story-meta">
        <text>{{ work.tags[0] }}</text>
        <button class="favorite-button" @click="favorite(work.id)">
          {{ isFavorite(work.id) ? '★ 已收藏' : '☆ 收藏' }}
        </button>
      </view>
      <text class="story-title" @click="openReader(work)">{{ work.title }}</text>
      <text class="story-excerpt" @click="openReader(work)">{{ work.excerpt }}</text>
      <view class="card-bottom">
        <text class="muted">{{ work.author }}</text>
        <button class="text-button" @click="openReader(work)">阅读全文 ↗</button>
      </view>
    </view>
  </view>
  <view v-if="!filtered.length" class="empty-state">暂无匹配作品，试试其他筛选条件。</view>
</template>
