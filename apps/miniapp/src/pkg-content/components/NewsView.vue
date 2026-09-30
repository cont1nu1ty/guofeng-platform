<script setup lang="ts">
import { isHttpMode } from '../../config/dataMode'
import { region } from '../../composables/useDemo'
import { computed, ref, watch } from 'vue'
import SectionHeading from '../../components/SectionHeading.vue'
import NewsSubscriptions from './NewsSubscriptions.vue'
import { newsPreferences, toggleNewsCategory } from '../composables/useNewsPreferences'
import { navigate, goBack, useRouteParams } from '../../composables/useNavigation'
import { t } from '../../composables/useLocale'
import {
  familyTopics,
  newsArticles,
  newsCategories,
  type BilingualText,
} from '../../domain/contentCatalog'
const L = (value: BilingualText) => t(value.zh, value.en)
const params = useRouteParams()
const category = ref('all')
const topic = ref('all')
const keyword = ref('')
watch(
  () => params.value.topic,
  (value) => {
    if (value) topic.value = value
  },
  { immediate: true },
)
const article = computed(() => newsArticles.find((item) => item.id === params.value.id))
const activeTopic = computed(() => familyTopics.find((item) => item.id === topic.value))
const filtered = computed(() =>
  newsArticles.filter(
    (item) =>
      (region.value === 'all' ||
        !item.region ||
        item.region === 'all' ||
        item.region === region.value) &&
      (category.value === 'all' || item.category === category.value) &&
      (topic.value === 'all' || item.topic === topic.value) &&
      `${item.title.zh}${item.title.en}${item.excerpt.zh}${item.excerpt.en}`
        .toLowerCase()
        .includes(keyword.value.trim().toLowerCase()),
  ),
)
const categoryLabel = (id: string) => {
  const item = newsCategories.find((entry) => entry.id === id)
  return item ? L(item.label) : id
}
const topicLabel = (id: string) => {
  const item = familyTopics.find((entry) => entry.id === id)
  return item ? L(item.label) : id
}
function chooseTopic(id: string) {
  topic.value = topic.value === id ? 'all' : id
  category.value = 'all'
}
function resetFilters() {
  topic.value = 'all'
  category.value = 'all'
  keyword.value = ''
}
</script>
<template>
  <view class="content-page">
    <view v-if="!article && !params.id" class="content-filter-tabs news-top-tabs">
      <button
        :class="['choice-card', { active: params.view !== 'subscriptions' }]"
        @click="navigate('news')"
      >
        {{ t('全部资讯', 'All updates') }}
      </button>
      <button
        :class="['choice-card', { active: params.view === 'subscriptions' }]"
        @click="navigate('news', { view: 'subscriptions' })"
      >
        {{ t('我的订阅', 'My subscriptions') }} · {{ newsPreferences.categories.length }}
      </button>
    </view>
    <NewsSubscriptions v-if="params.view === 'subscriptions' && !params.id" />
    <template v-else-if="article">
      <view class="content-back">
        <wd-button variant="plain" size="small" @click="goBack()">
          {{ t('返回资讯', 'Back to updates') }}
        </wd-button>
        <text class="content-demo-label">
          {{
            isHttpMode
              ? t('已发布资讯', 'Published update')
              : t('原创演示内容', 'Original prototype content')
          }}
        </text>
      </view>
      <view class="content-article">
        <view class="content-meta">
          <text class="content-red-label">{{ categoryLabel(article.category) }}</text>
          <text>{{ topicLabel(article.topic) }}</text>
          <text>{{ article.date }}</text>
        </view>
        <wd-button variant="plain" size="small" @click="toggleNewsCategory(article.category)">
          {{
            newsPreferences.categories.includes(article.category)
              ? t('已订阅该分类 ✓', 'Category subscribed ✓')
              : t('订阅该分类 +', 'Subscribe to category +')
          }}
        </wd-button>
        <text class="content-detail-title">{{ L(article.title) }}</text>
        <text class="content-lead">{{ L(article.excerpt) }}</text>
        <view class="content-author">
          <view class="content-small-seal">文</view>
          <view>
            <text>
              {{
                isHttpMode
                  ? t('家风平台', 'Family Heritage platform')
                  : t('家风内容演示组', 'Prototype editorial team')
              }}
            </text>
            <text class="content-caption">
              {{
                isHttpMode
                  ? article.sample
                    ? t('虚构场景素材', 'Fictional showcase material')
                    : t('平台内容', 'Platform content')
                  : t('原创样例 · 非官方发布', 'Original sample · not an official publication')
              }}
            </text>
          </view>
        </view>
        <view class="content-prose">
          <text v-for="(paragraph, index) in article.paragraphs" :key="index">
            {{ L(paragraph) }}
          </text>
        </view>
        <view class="content-article-end">
          <text>◆</text>
          <text>{{ t('在平凡日常里，传承好家风', 'Pass on family values in everyday life') }}</text>
          <text>◆</text>
        </view>
        <wd-button
          v-if="article.relatedScreen && article.relatedLabel"
          @click="navigate(article.relatedScreen)"
        >
          {{ L(article.relatedLabel) }}
        </wd-button>
      </view>
      <view class="content-section-line">
        <text class="section-title">{{ t('继续阅读', 'Keep reading') }}</text>
      </view>
      <view class="content-related">
        <view
          v-for="item in newsArticles.filter(
            (entry) => entry.topic === article!.topic && entry.id !== article!.id,
          )"
          :key="item.id"
          class="content-related-item"
          @click="navigate('news', { id: item.id })"
        >
          <text>{{ L(item.title) }}</text>
          <wd-icon name="arrow-right" />
        </view>
      </view>
    </template>
    <template v-else-if="params.id">
      <view class="empty-state">
        {{
          t('未找到当前语言可公开的资讯。', 'No published article is available in this language.')
        }}
        <wd-button variant="plain" @click="navigate('news')">
          {{ t('查看全部资讯', 'View all updates') }}
        </wd-button>
      </view>
    </template>
    <template v-else>
      <SectionHeading
        :title="t('家国同心，家风共传', 'Stories that connect generations')"
        :eyebrow="t('资讯动态', 'Updates')"
        :subtitle="
          t(
            '读一则故事，见一份担当，让好的家风被更多人看见。',
            'Discover stories of care and responsibility, and share family values.',
          )
        "
      />
      <view class="content-topic-grid">
        <view
          v-for="item in familyTopics"
          :key="item.id"
          :class="['content-topic-card', { active: topic === item.id }]"
          @click="chooseTopic(item.id)"
        >
          <text class="content-topic-mark">{{ item.mark }}</text>
          <text class="content-topic-title">{{ L(item.label) }}</text>
          <text class="content-topic-description">{{ L(item.description) }}</text>
          <text class="content-topic-link">{{ t('专题阅读', 'Explore topic') }} →</text>
        </view>
      </view>
      <view v-if="activeTopic" class="content-topic-selected">
        <text>{{ t('当前专题：', 'Topic: ') }}{{ L(activeTopic.label) }}</text>
        <wd-button size="small" variant="plain" @click="topic = 'all'">
          {{ t('查看全部专题', 'All topics') }}
        </wd-button>
      </view>
      <view class="content-filter-bar">
        <view class="content-filter-tabs">
          <view
            v-for="item in newsCategories"
            :key="item.id"
            :class="['content-filter-chip', { active: category === item.id }]"
            @click="category = item.id"
          >
            {{ L(item.label) }}
          </view>
        </view>
        <view class="content-search">
          <wd-icon name="search-line" />
          <input
            v-model="keyword"
            :placeholder="t('搜索资讯标题或内容', 'Search titles or summaries')"
          />
        </view>
      </view>
      <view class="content-news-grid">
        <view
          v-for="item in filtered"
          :key="item.id"
          class="content-news-card"
          @click="navigate('news', { id: item.id })"
        >
          <view :class="['content-news-art', 'content-news-art-' + item.topic]">
            <text class="content-art-corner">{{ topicLabel(item.topic) }}</text>
            <view class="content-letter-art">
              <view />
              <view />
              <view />
              <view />
            </view>
            <text class="content-art-mark">
              {{ familyTopics.find((entry) => entry.id === item.topic)?.mark }}
            </text>
            <text class="content-art-footer">
              {{ t('家风中华行 · 内容样例', 'Family Heritage · Sample') }}
            </text>
          </view>
          <view class="content-news-body">
            <view class="content-meta">
              <text class="content-red-label">{{ categoryLabel(item.category) }}</text>
              <text>{{ item.date }}</text>
            </view>
            <text class="content-card-title">{{ L(item.title) }}</text>
            <text class="content-description">{{ L(item.excerpt) }}</text>
            <view class="content-card-footer">
              <text class="content-caption">
                {{ t('原创样例 · 非官方发布', 'Original prototype content') }}
              </text>
              <text class="content-read-link">{{ t('阅读全文', 'Read story') }} →</text>
            </view>
          </view>
        </view>
      </view>
      <view v-if="!filtered.length" class="empty-state">
        <text>{{ t('当前筛选下暂无资讯。', 'No updates match these filters.') }}</text>
        <wd-button variant="plain" @click="resetFilters">
          {{ t('重置筛选', 'Reset filters') }}
        </wd-button>
      </view>
      <view class="scope-note">
        {{
          t(
            '本页文章、人物和活动均为产品原创样例，不代表正式政策、官方公告或真实报道。',
            'Articles, people and events are original prototype samples, not official policies, notices or actual reports.',
          )
        }}
      </view>
    </template>
  </view>
</template>

<style scoped>
.news-top-tabs {
  margin-bottom: 24px;
}
.news-top-tabs .choice-card {
  padding: 10px 15px;
  font-size: 14px;
}
</style>
