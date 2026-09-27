<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import SectionHeading from './SectionHeading.vue'
import { locale, t } from '../composables/useLocale'
import { isHttpMode } from '../config/dataMode'
import { remoteUser } from '../services/api'
import { useRemoteSearch } from '../composables/useRemoteSearch'
import { region, regionLabel, repo, revision } from '../composables/useDemo'
import { navigate, useRouteParams, type Screen } from '../composables/useNavigation'
import {
  createSearchIndex,
  findEntries,
  searchKinds,
  type SearchKind,
} from '../domain/searchCatalog'
import { readInputValue } from '../composables/readInputValue'
const params = useRouteParams()
const query = ref(params.value.q ?? '')
const kind = ref<SearchKind | 'all'>('all')
const limit = ref(12)
const allRegions = ref(false)
const index = computed(() => {
  revision.value
  if (isHttpMode) return []
  return createSearchIndex(repo.listWorks(), repo.listClassics(), repo.listActivities())
})
const remote = useRemoteSearch()
const matches = computed(() =>
  isHttpMode
    ? remote.page.value.items
    : findEntries(index.value, query.value, kind.value, allRegions.value ? 'all' : region.value),
)
const resultTotal = computed(() => (isHttpMode ? remote.page.value.total : matches.value.length))
function count(id: SearchKind | 'all') {
  return isHttpMode
    ? (remote.page.value.counts[id] ?? 0)
    : findEntries(index.value, query.value, id, allRegions.value ? 'all' : region.value).length
}
watch(
  [query, kind, region, allRegions, locale, remoteUser],
  () => {
    if (isHttpMode)
      remote.search({
        q: query.value,
        kind: kind.value,
        region: allRegions.value ? 'all' : region.value,
        language: locale.value,
      })
  },
  { immediate: true },
)
onBeforeUnmount(remote.dispose)
watch([query, kind, region, allRegions], () => {
  limit.value = 12
})
function resetSearch() {
  query.value = ''
  kind.value = 'all'
  allRegions.value = true
}
function kindLabel(id: SearchKind) {
  const item = searchKinds.find((k) => k.id === id)!
  return t(item.label.zh, item.label.en)
}
</script>
<template>
  <view class="search-page">
    <SectionHeading
      :title="t('一处检索，遍览家风', 'Explore family culture in one search')"
      :eyebrow="t('全站搜索', 'Search the platform')"
      :subtitle="
        t(
          '检索作品、资讯、典籍、活动、课堂、媒体、名人馆、文创与阵地。',
          'Find stories, news, books, events, courses, media, halls, gifts and venues.',
        )
      "
    />
    <view class="search-field">
      <wd-icon name="search" />
      <input
        class="search-keyword-input"
        v-model="query"
        confirm-type="search"
        @blur="query = readInputValue($event, query)"
        @confirm="query = readInputValue($event, query)"
        :placeholder="t('输入关键词，中英文均可', 'Enter keywords in Chinese or English')"
      />
      <button v-if="query" class="text-button" @click="query = ''">{{ t('清除', 'Clear') }}</button>
    </view>
    <view class="search-kind-list">
      <button :class="['choice-card', { active: kind === 'all' }]" @click="kind = 'all'">
        {{ t('全部', 'All') }} ·
        {{ count('all') }}
      </button>
      <button
        v-for="item in searchKinds"
        :key="item.id"
        :class="['choice-card', { active: kind === item.id }]"
        @click="kind = item.id"
      >
        {{ t(item.label.zh, item.label.en) }} ·
        {{ count(item.id) }}
      </button>
    </view>
    <view class="search-summary">
      <text>
        {{ resultTotal }} {{ t('条结果', 'results') }} ·
        {{ allRegions ? t('全国', 'National') : t(regionLabel) }}
      </text>
      <button v-if="region !== 'all'" class="text-button" @click="allRegions = !allRegions">
        {{
          allRegions
            ? t('仅看当前地区与共享内容', 'Current region and shared content')
            : t('搜索全部地区', 'Search all regions')
        }}
      </button>
    </view>
    <view v-if="isHttpMode && remote.error.value" class="empty-state" role="status">
      <text>{{ remote.error.value }}</text>
      <wd-button variant="plain" :disabled="remote.loading.value" @click="remote.retry">
        {{ t('重试搜索', 'Retry search') }}
      </wd-button>
    </view>
    <text v-if="isHttpMode && remote.loading.value" class="scope-note" role="status">
      {{ t('正在检索已发布内容…', 'Searching published content…') }}
    </text>
    <view
      v-if="!matches.length && (!isHttpMode || (!remote.loading.value && !remote.error.value))"
      class="empty-state"
    >
      <text>
        {{
          t(
            '没有找到匹配内容，试试其他关键词或地区。',
            'No matches. Try another keyword or region.',
          )
        }}
      </text>
      <wd-button variant="plain" @click="resetSearch">
        {{
          isHttpMode
            ? t('浏览已发布内容', 'Browse published content')
            : t('查看全部样例', 'Browse all samples')
        }}
      </wd-button>
    </view>
    <button
      v-for="item in isHttpMode ? matches : matches.slice(0, limit)"
      :key="item.id"
      class="search-entry"
      @click="navigate(item.screen as Screen, { id: item.contentId })"
    >
      <view class="search-entry-meta">
        <text class="tag">{{ kindLabel(item.kind) }}</text>
        <text>↗</text>
      </view>
      <text class="search-entry-title">{{ t(item.title.zh, item.title.en) }}</text>
      <text class="search-entry-summary">{{ t(item.summary.zh, item.summary.en) }}</text>
    </button>
    <view
      v-if="isHttpMode ? remote.page.value.nextCursor : matches.length > limit"
      class="search-more"
    >
      <wd-button
        variant="plain"
        :disabled="isHttpMode && remote.loading.value"
        @click="isHttpMode ? remote.more() : (limit += 12)"
      >
        {{ t('加载更多', 'Show more') }} ({{ resultTotal - (isHttpMode ? matches.length : limit) }})
      </wd-button>
    </view>
    <text class="scope-note">
      {{
        isHttpMode
          ? t(
              '仅检索当前语言已发布的公开内容；个人约定、打卡、未公开投稿和评审材料不在此列。',
              'Only published content in the selected language is searched. Private promises, recordings, drafts and reviews are excluded.',
            )
          : t(
              '搜索范围为本机样例与当前设备投稿，不代表全国真实资源库。',
              'Results include local samples and submissions on this device, not a live national database.',
            )
      }}
    </text>
  </view>
</template>
<style scoped>
.search-kind-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0;
}
.search-kind-list .choice-card {
  padding: 8px 12px;
  font-size: 13px;
  min-height: 38px;
}
.search-summary,
.search-entry-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.search-summary {
  margin: 20px 0;
  color: var(--jf-muted);
  font-size: 13px;
}
.search-entry {
  display: block;
  width: 100%;
  padding: 20px;
  text-align: left;
  margin: 12px 0;
  border: 1px solid var(--jf-border);
  background: var(--jf-surface);
  border-radius: 0;
  color: var(--jf-ink);
  line-height: 1.8;
}
.search-entry-title {
  display: block;
  font:
    600 20px/1.6 'JiafengSerif',
    serif;
  margin: 12px 0;
}
.search-entry-summary {
  font-size: 14px;
  display: block;
}
.search-more {
  text-align: center;
  margin: 24px 0;
}
.search-field .search-keyword-input {
  min-width: 0;
  flex: 1;
}
</style>
