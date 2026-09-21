<script setup lang="ts">
import { computed, ref } from 'vue'
import SectionHeading from './SectionHeading.vue'
import { readInputValue } from '../composables/readInputValue'
import { openReader, works, regionLabel, repo, region } from '../composables/useDemo'
import { navigate, type Screen } from '../composables/useNavigation'
import { t, locale } from '../composables/useLocale'
import {
  familyTopics,
  newsArticles,
  newsCategories,
  type BilingualText,
} from '../domain/contentCatalog'
import type { Work } from '../domain/types'
const L = (text: BilingualText) => t(text.zh, text.en)
const query = ref('')
const selectedTopic = ref('all')
const heroIndex = ref(0)
const carouselPaused = ref(false)
const terms = computed(() => query.value.trim().toLocaleLowerCase())
const match = (...text: string[]) => text.join(' ').toLocaleLowerCase().includes(terms.value)
const topics = computed(() => [
  { id: 'all', label: t('精选作品', 'Featured stories') },
  ...familyTopics.map((topic) => ({ id: topic.id, label: L(topic.label) })),
])
const entries = computed<{ label: string; sub: string; icon: string; screen: Screen }[]>(() => [
  {
    label: t('家风投稿', 'Contribute'),
    sub: t('以文传家', 'Share your story'),
    icon: 'edit',
    screen: 'submit',
  },
  {
    label: t('典籍馆藏', 'Collections'),
    sub: t('书香致远', 'Read the classics'),
    icon: 'book',
    screen: 'library',
  },
  {
    label: t('清廉课堂', 'Classroom'),
    sub: t('清风润家', 'Learn integrity'),
    icon: 'lock',
    screen: 'classroom',
  },
  {
    label: t('短视频展播', 'Videos'),
    sub: t('帧藏家风', 'Watch together'),
    icon: 'play-circle',
    screen: 'media',
  },
  {
    label: t('线上传习', 'Learning'),
    sub: t('知行合一', 'Take part'),
    icon: 'company',
    screen: 'learning',
  },
  {
    label: t('先贤名人馆', 'Heritage halls'),
    sub: t('寻迹文脉', 'Explore traditions'),
    icon: 'home',
    screen: 'hall',
  },
  {
    label: t('文创商城', 'Cultural gifts'),
    sub: t('好礼传情', 'Culture for life'),
    icon: 'gift',
    screen: 'shop',
  },
  {
    label: t('AI 家风助手', 'AI assistant'),
    sub: t('落笔有方', 'Writing support'),
    icon: 'message',
    screen: 'assistant',
  },
])
interface HeroSlide {
  id: string
  kicker: string
  title: string[]
  description: string[]
  action: string
  foot: string
  screen: Screen
  params?: Record<string, string>
  book: string
  seal: string
}
const heroSlides = computed<HeroSlide[]>((): HeroSlide[] => [
  {
    id: 'policy',
    kicker: t('全国政策通知 · 版式样例', 'NATIONAL NOTICES · DEMO'),
    title: [t('政策学习', 'Learn and'), t('从家出发', 'grow together')],
    description: [
      t('以家庭文明为起点，读懂共建共享。', 'Explore family culture and shared values.'),
      t('预览政策通知与学习导读的呈现方式。', 'Preview a policy notice and reading guide.'),
    ],
    action: t('查看通知样例', 'Read sample notice'),
    foot: t('原创版式样例 · 非正式政策发布', 'Original demo · no official policy issued'),
    screen: 'news',
    params: { id: 'national-policy-demo' },
    book: '政策导读',
    seal: '共学',
  },
  {
    id: 'contribute',
    kicker: t('征稿公告 · 家书征集样例', 'CALL FOR STORIES · DEMO'),
    title: [t('让好家风', 'Let family'), t('代代相传', 'values endure')],
    description: [
      t('以一封家书，珍藏家的温度。', 'Keep the warmth of home in a letter.'),
      t('从身边的故事写起，留下传家的记忆。', 'Share the stories you wish to pass on.'),
    ],
    action: t('阅读征稿说明', 'View the sample call'),
    foot: t('八大文学体裁 · 本机投稿演示', '8 genres · local submission demo'),
    screen: 'news',
    params: { id: 'notice-autumn' },
    book: '一纸家书',
    seal: '传承',
  },
  {
    id: 'celebration',
    kicker: t('年度盛典 · 预告演示', 'ANNUAL CELEBRATION · DEMO'),
    title: [t('家风相聚', 'A year of'), t('薪火相传', 'shared stories')],
    description: [
      t('从家书到云端，让家庭故事相互照亮。', 'Bring family stories together online.'),
      t('体验盛典预告、直播布局与回放入口。', 'Explore a preview and sample replay.'),
    ],
    action: t('查看盛典预告', 'Preview the event'),
    foot: t('虚构活动 · 无真实直播与排期', 'Fictional event · no live stream or date'),
    screen: 'media',
    params: { tab: 'live' },
    book: '万家同心',
    seal: '共庆',
  },
  {
    id: 'library-launch',
    kicker: t('典籍首发 · 新卷预览', 'NEW COLLECTION · DEMO'),
    title: [t('新卷启读', 'A new volume,'), t('共续文脉', 'a shared story')],
    description: [
      t('翻开家风新卷，在共读中连接古今。', 'Open a new chapter in family reading.'),
      t('先读首发介绍，再走进典藏样章。', 'Meet the collection and read a sample.'),
    ],
    action: t('查看首发介绍', 'Meet the collection'),
    foot: t('原创选读样例 · 非正式出版消息', 'Original samples · no formal publication'),
    screen: 'news',
    params: { id: 'collection-launch-demo' },
    book: '家书新卷',
    seal: '启卷',
  },
  {
    id: 'study-visit',
    kicker: t('研学活动 · 预约体验', 'LEARNING VISITS · DEMO'),
    title: [t('走进书院', 'Visit and learn,'), t('读懂家风', 'read together')],
    description: [
      t('把阅读带进书院，把家风写进行动。', 'Bring family reading into shared spaces.'),
      t('查看活动导学，体验预约与签到。', 'Explore a visit, booking and check-in.'),
    ],
    action: t('查看研学样例', 'Explore the sample visit'),
    foot: t('虚构场馆与活动 · 仅作界面体验', 'Fictional venue and event · demo only'),
    screen: 'learning',
    params: { id: 'DEMO-ACTIVITY-002' },
    book: '书院研学',
    seal: '知行',
  },
  {
    id: 'classroom',
    kicker: t('廉政课堂 · 家庭共同学习', 'INTEGRITY CLASSROOM · DEMO'),
    title: [t('清风润家', 'Integrity'), t('正气传承', 'begins at home')],
    description: [
      t('从一堂家风课，读懂责任与担当。', 'Discover responsibility in a family lesson.'),
      t('把清廉的约定，写进每一天。', 'Put shared values into daily practice.'),
    ],
    action: t('走进廉政课堂', 'Explore the classroom'),
    foot: t('分节学习 · 情景问答 · 证书样张', 'Lessons · questions · sample certificate'),
    screen: 'classroom',
    params: { id: 'integrity-home' },
    book: '清廉家风',
    seal: '正气',
  },
])
function changeHero(event: { detail: { current: number } }) {
  heroIndex.value = event.detail.current
}
const workEnglish: Record<string, { title: string; excerpt: string; author: string }> = {
  'DEMO-WORK-001': {
    title: 'Turn ordinary days into a family letter',
    excerpt:
      'A light above the table and a leaf in an old book carry memories to someone far away.',
    author: 'Lin He (fictional)',
  },
  'DEMO-WORK-002': {
    title: 'Four seasons around one table',
    excerpt: 'Three generations share lessons about appreciation and care through everyday meals.',
    author: 'Xu An (fictional)',
  },
  'DEMO-WORK-003': {
    title: 'A promise in the bamboo shade',
    excerpt: 'A borrowed tool holds a lesson in keeping promises between generations.',
    author: 'Zhou Ning (fictional)',
  },
  'DEMO-WORK-004': {
    title: 'Integrity begins at the doorstep',
    excerpt: 'Bring honesty and self-discipline home through mutual care and gentle reminders.',
    author: 'Chen Yan (fictional)',
  },
}
function workText(work: Work, field: 'title' | 'excerpt' | 'author') {
  return t(work[field], workEnglish[work.id]?.[field] ?? work[field])
}
const filteredWorks = computed(() =>
  selectedTopic.value === 'all'
    ? works.value.filter(
        (work) =>
          !terms.value ||
          match(
            work.title,
            work.excerpt,
            work.author,
            workEnglish[work.id]?.title ?? '',
            workEnglish[work.id]?.excerpt ?? '',
          ),
      )
    : [],
)
const topicArticles = computed(() =>
  selectedTopic.value === 'all' && !terms.value
    ? []
    : newsArticles.filter(
        (article) =>
          (selectedTopic.value === 'all' || article.topic === selectedTopic.value) &&
          (!terms.value ||
            match(article.title.zh, article.title.en, article.excerpt.zh, article.excerpt.en)),
      ),
)
const searchClassics = computed(() =>
  terms.value
    ? repo
        .listClassics()
        .filter(
          (item) =>
            (region.value === 'all' || item.region === region.value || item.region === 'all') &&
            match(item.title, item.excerpt),
        )
    : [],
)
const searchActivities = computed(() =>
  terms.value
    ? repo
        .listActivities({ region: region.value })
        .filter((item) => match(item.title, item.excerpt))
    : [],
)
const noResults = computed(
  () =>
    !filteredWorks.value.length &&
    !topicArticles.value.length &&
    !searchClassics.value.length &&
    !searchActivities.value.length,
)
const latestNews = computed(() => newsArticles.slice(0, 3))
const articleCategory = (id: string) => {
  const category = newsCategories.find((item) => item.id === id)
  return category ? L(category.label) : t('资讯动态', 'News')
}
function topicArticle(id: string) {
  return newsArticles.find((article) => article.topic === id)!
}
</script>
<template>
  <view :class="['home-view', { 'home-english': locale === 'en' }]">
    <view class="welcome-line">
      <text>{{ t('一脉家风，万家共鸣。', 'Shared values, countless family stories.') }}</text>
      <text class="muted">{{ t(regionLabel) }} · {{ t('共建共享', 'Built together') }}</text>
    </view>
    <swiper
      class="home-hero-swiper"
      :current="heroIndex"
      :autoplay="!carouselPaused"
      :interval="6500"
      :duration="450"
      :circular="true"
      @change="changeHero"
    >
      <swiper-item v-for="slide in heroSlides" :key="slide.id">
        <view class="hero">
          <view class="hero-copy">
            <text class="hero-kicker">{{ slide.kicker }}</text>
            <view class="hero-title">
              <text v-for="line in slide.title" :key="line">{{ line }}</text>
            </view>
            <view class="hero-description">
              <text v-for="line in slide.description" :key="line">{{ line }}</text>
            </view>
            <wd-button custom-class="hero-button" @click="navigate(slide.screen, slide.params)">
              {{ slide.action }}
              <text class="button-arrow">↗</text>
            </wd-button>
            <view class="hero-foot">
              <text class="hero-line" />
              <text>{{ slide.foot }}</text>
            </view>
          </view>
          <view class="hero-art" @click="navigate(slide.screen, slide.params)">
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
              <text>{{ slide.book }}</text>
              <text class="book-small">见字如面　家国同心</text>
            </view>
            <view class="art-seal">{{ slide.seal }}</view>
            <text class="art-caption">
              {{ t('以家为起点　让文化有回响', 'Begin with family · carry culture forward') }}
            </text>
          </view>
        </view>
      </swiper-item>
    </swiper>
    <view class="home-carousel-tools">
      <view class="home-carousel-dots">
        <button
          v-for="(slide, index) in heroSlides"
          :key="slide.id"
          :class="['home-carousel-dot', { active: heroIndex === index }]"
          :aria-label="t('切换到：', 'Show: ') + slide.kicker"
          :aria-current="heroIndex === index ? 'true' : 'false'"
          @click="heroIndex = index"
        >
          <text>0{{ index + 1 }}</text>
        </button>
      </view>
      <button class="home-carousel-pause" @click="carouselPaused = !carouselPaused">
        {{ carouselPaused ? t('继续轮播', 'Resume slides') : t('暂停轮播', 'Pause slides') }}
      </button>
    </view>
    <view class="announcement" @click="navigate('news', { id: 'notice-autumn' })">
      <view class="notice-symbol">{{ t('告', 'N') }}</view>
      <text class="notice-title">{{ t('征集公告', 'Notice') }}</text>
      <text class="notice-copy">
        {{ L(newsArticles[0].title) }} · {{ t('演示公告', 'Sample notice') }}
      </text>
      <text class="arrow">→</text>
    </view>
    <view class="entry-grid">
      <button
        v-for="item in entries"
        :key="item.screen"
        class="entry-button"
        @click="navigate(item.screen)"
      >
        <view class="entry-icon"><wd-icon :name="item.icon" size="25px" /></view>
        <text class="entry-label">{{ item.label }}</text>
        <text class="entry-sub">{{ item.sub }}</text>
      </button>
    </view>
    <view class="home-topic-section">
      <SectionHeading
        :title="t('四大家风专区', 'Four paths through family heritage')"
        :eyebrow="t('家国同心 · 文脉相承', 'FAMILY VALUES · SHARED TRADITIONS')"
        :subtitle="
          t(
            '读懂一个故事，走近一种传承。各专区均提供原创样例。',
            'Explore original sample stories in every theme.',
          )
        "
      >
        <button class="text-button" @click="navigate('news')">
          {{ t('全部专题', 'All topics') }} ↗
        </button>
      </SectionHeading>
      <view class="home-topic-grid">
        <button
          v-for="topic in familyTopics"
          :key="topic.id"
          class="home-topic-card"
          @click="navigate('news', { topic: topic.id })"
        >
          <view class="home-topic-top">
            <text class="home-topic-mark">{{ topic.mark }}</text>
            <text class="home-topic-title">{{ L(topic.label) }}</text>
          </view>
          <text class="home-topic-description">{{ L(topic.description) }}</text>
          <text class="home-topic-feature">{{ L(topicArticle(topic.id).title) }}</text>
          <text class="home-topic-link">{{ t('进入专区', 'Explore topic') }} →</text>
        </button>
      </view>
    </view>
    <view class="home-columns">
      <view class="home-main">
        <SectionHeading
          :title="t('万家故事，皆有回响', 'Every family has a story')"
          :eyebrow="t('家风故事 · 共同传承', 'STORIES OF FAMILY')"
          :subtitle="
            t('在平凡日常里，读懂家风的力量。', 'Discover the strength of family in everyday life.')
          "
        >
          <button class="text-button" @click="navigate('library')">
            {{ t('更多作品', 'More stories') }} ↗
          </button>
        </SectionHeading>
        <view class="story-filters">
          <button
            v-for="topic in topics"
            :key="topic.id"
            :class="['filter-chip', { active: selectedTopic === topic.id }]"
            @click="selectedTopic = topic.id"
          >
            {{ topic.label }}
          </button>
        </view>
        <view class="search-field">
          <wd-icon name="search-line" size="19px" />
          <input
            v-model="query"
            :placeholder="
              t('搜索作品、资讯、课堂、视频等', 'Search stories, courses, videos and more')
            "
            confirm-type="search"
            @blur="query = readInputValue($event, query)"
            @confirm="navigate('search', { q: readInputValue($event, query).trim() })"
            :aria-label="t('搜索作品、资讯、典籍、活动', 'Search stories, news, books and events')"
          />
          <button v-if="query" class="text-button" @click="query = ''">
            {{ t('清除', 'Clear') }}
          </button>
        </view>
        <button class="text-button home-search-all" @click="navigate('search', { q: terms })">
          {{ t('查看全站搜索结果', 'View all search results') }} →
        </button>
        <view
          v-for="(work, index) in filteredWorks.slice(0, 3)"
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
              <text>{{ t('原创故事样例', 'Original sample') }}</text>
              <text>· {{ workText(work, 'author') }}</text>
            </view>
            <text class="story-title">{{ workText(work, 'title') }}</text>
            <text class="story-excerpt">{{ workText(work, 'excerpt') }}</text>
            <text class="story-link">
              {{ t('阅读故事', 'Read story') }}
              <text>↗</text>
            </text>
          </view>
        </view>
        <view
          v-for="(article, index) in topicArticles.slice(0, 3)"
          :key="article.id"
          class="story-row"
          @click="navigate('news', { id: article.id })"
        >
          <view :class="['story-art', 'story-art-' + index]">
            <text>{{ familyTopics.find((topic) => topic.id === article.topic)?.mark }}</text>
            <view class="story-art-line" />
          </view>
          <view class="story-copy">
            <view class="story-meta">
              <text>{{ articleCategory(article.category) }}</text>
              <text>· {{ t('原创演示', 'Original demo') }}</text>
            </view>
            <text class="story-title">{{ L(article.title) }}</text>
            <text class="story-excerpt">{{ L(article.excerpt) }}</text>
            <text class="story-link">
              {{ t('阅读专题故事', 'Read themed story') }}
              <text>↗</text>
            </text>
          </view>
        </view>
        <view v-if="noResults" class="empty-state">
          {{
            t('暂未找到内容，试试其他地区或关键词。', 'No results. Try another region or keyword.')
          }}
        </view>
        <view
          v-for="item in searchClassics"
          :key="item.id"
          class="search-result"
          @click="openReader(item)"
        >
          <text class="tag">{{ t('典籍', 'Book') }}</text>
          {{ item.title }}
          <text>↗</text>
        </view>
        <view
          v-for="item in searchActivities"
          :key="item.id"
          class="search-result"
          @click="navigate('learning', { id: item.id })"
        >
          <text class="tag">{{ t('活动', 'Event') }}</text>
          {{ item.title }}
          <text>↗</text>
        </view>
      </view>
      <view class="home-side">
        <view class="quote-panel">
          <text class="eyebrow">{{ t('今日家训', 'A daily precept') }}</text>
          <text class="quote-text">
            {{ t('忠厚传家久', 'Kindness endures') }}
            <br />
            {{ t('诗书继世长', 'Learning carries on') }}
          </text>
          <view class="fine-line" />
          <text class="quote-note">
            {{ t('把日子过成家风', 'Live your family values') }}
            <br />
            {{ t('把家风传给下一代', 'Share them with the next generation') }}
          </text>
          <button class="text-button" @click="navigate('library')">
            {{ t('走进典籍馆藏', 'Open the collection') }} →
          </button>
        </view>
        <view class="mini-feature" @click="navigate('learning')">
          <text class="eyebrow">{{ t('家风传习 · 活动预告', 'LEARNING · UPCOMING EVENTS') }}</text>
          <text class="mini-feature-title">
            {{ t('寻一处书院', 'Find a reading space') }}
            <br />
            {{ t('赴一场家风之约', 'Share a family story') }}
          </text>
          <view class="feature-bottom">
            <text>{{ t('查看研学活动', 'Explore events') }}</text>
            <text>↗</text>
          </view>
        </view>
        <view class="home-venue-link" @click="navigate('venues')">
          <wd-icon name="location" size="22px" />
          <view>
            <text>{{ t('身边的家风阵地', 'Explore learning venues') }}</text>
            <text>
              {{
                t('示意地图 · 场馆导览 · 预约体验', 'Illustrated map · venue tours · demo bookings')
              }}
            </text>
          </view>
          <text>→</text>
        </view>
      </view>
    </view>
    <view class="home-news-section">
      <SectionHeading
        :title="t('资讯动态', 'News and updates')"
        :eyebrow="t('知家事 · 看新风', 'LETTERS · LEARNING · COMMUNITY')"
        :subtitle="
          t(
            '公告、学习专栏与活动报道，了解平台的新故事。',
            'Notices, learning columns and stories from the community.',
          )
        "
      >
        <button class="text-button" @click="navigate('news')">
          {{ t('全部资讯', 'All updates') }} ↗
        </button>
      </SectionHeading>
      <view class="home-news-grid">
        <button
          v-for="article in latestNews"
          :key="article.id"
          class="home-news-card"
          @click="navigate('news', { id: article.id })"
        >
          <view class="home-news-meta">
            <text>{{ articleCategory(article.category) }}</text>
            <text>{{ article.date }}</text>
          </view>
          <text class="home-news-title">{{ L(article.title) }}</text>
          <text class="home-news-excerpt">{{ L(article.excerpt) }}</text>
          <text class="home-topic-link">{{ t('阅读详情', 'Read more') }} →</text>
        </button>
      </view>
    </view>
    <view class="vision-strip home-statistics">
      <view>
        <text class="vision-number">
          12,860
          <text>{{ t('篇', 'works') }}</text>
        </text>
        <text>{{ t('累计投稿（示例）', 'Total submissions · sample') }}</text>
      </view>
      <view>
        <text class="vision-number">
          8,620
          <text>{{ t('人', 'people') }}</text>
        </text>
        <text>{{ t('参与人数（示例）', 'Participants · sample') }}</text>
      </view>
      <view>
        <text class="vision-number">
          34
          <text>{{ t('个', 'regions') }}</text>
        </text>
        <text>{{ t('覆盖地区（示例）', 'Regions covered · sample') }}</text>
      </view>
      <view class="vision-caption">
        <text>
          {{ t('汇万家之美', 'Many families') }}
          <br />
          {{ t('成中华家风', 'One shared heritage') }}
        </text>
        <text class="muted">
          {{ t('演示示例 · 非实际运营数据', 'Sample figures · no live statistics') }}
        </text>
      </view>
    </view>
    <text class="home-statistics-note">
      {{
        t(
          '以上为用于页面沟通的模拟累计数据，不代表实际投稿、参与人数或服务覆盖。',
          'These illustrative totals do not represent actual submissions, participants or service coverage.',
        )
      }}
    </text>
  </view>
</template>
<style scoped lang="scss">
.home-hero-swiper {
  height: 440px;
}
.home-hero-swiper .hero {
  height: 100%;
  min-height: 0;
  background: var(--jf-red, #c41a1a);
}
.home-hero-swiper .hero-copy {
  padding-top: 32px;
  padding-bottom: 26px;
}
.hero-title > text,
.hero-description > text {
  display: block;
}
.home-hero-swiper .hero-title {
  font-family: 'JiafengSerif', 'Source Han Serif SC', serif;
  font-size: 40px;
  line-height: 1.3;
  margin: 12px 0;
}
.home-hero-swiper .hero-kicker,
.home-hero-swiper .hero-foot {
  color: #ffecd0;
}
.home-hero-swiper .hero-description {
  color: #fff4e8;
  line-height: 1.75;
}
.home-hero-swiper .hero-line {
  background: var(--jf-gold, #c9a96e);
}
.home-carousel-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 2px 2px;
}
.home-carousel-dots {
  display: flex;
  align-items: center;
  gap: 9px;
}
.home-carousel-dot {
  min-width: 42px;
  height: 28px;
  border-top: 2px solid #cbbdac;
  color: #5d5752;
  font-size: 10px;
  text-align: center;
}
.home-carousel-dot.active {
  color: var(--jf-red, #c41a1a);
  border-top-color: var(--jf-red, #c41a1a);
  font-weight: 700;
}
.home-carousel-pause {
  font-size: 11px;
  color: #5d5752;
  padding: 5px 0 5px 12px;
}
.home-topic-section {
  margin-bottom: 35px;
}
.home-topic-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.home-topic-card {
  padding: 22px 20px;
  text-align: left;
  background: #fffdf9;
  border: 1px solid #ddcfbd;
  border-top: 3px solid var(--jf-red, #c41a1a);
  min-width: 0;
}
.home-topic-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.home-topic-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 41px;
  flex-shrink: 0;
  background: var(--jf-red, #c41a1a);
  color: #fff7e8;
  font-family: 'JiafengSerif', serif;
  font-size: 24px;
}
.home-topic-title {
  font-family: 'JiafengSerif', serif;
  font-size: 17px;
  font-weight: 600;
  color: var(--jf-ink, #2c2c2c);
}
.home-topic-description {
  display: block;
  color: #57514d;
  font-size: 12px;
  line-height: 1.8;
  margin-top: 16px;
  min-height: 43px;
}
.home-topic-feature {
  display: block;
  border-top: 1px solid #e8ded0;
  margin-top: 15px;
  padding-top: 13px;
  color: var(--jf-ink, #2c2c2c);
  font-size: 12px;
  line-height: 1.8;
  min-height: 56px;
}
.home-topic-link {
  display: block;
  color: var(--jf-red, #c41a1a);
  font-size: 12px;
  margin-top: 14px;
  font-weight: 600;
}
.home-venue-link {
  border: 1px solid #dccbb0;
  display: flex;
  align-items: center;
  padding: 18px;
  margin-top: 22px;
  gap: 12px;
  color: var(--jf-red, #c41a1a);
  background: #fffdf9;
  cursor: pointer;
}
.home-venue-link > view {
  flex: 1;
}
.home-venue-link > view > text {
  display: block;
  font-size: 13px;
  font-weight: 600;
}
.home-venue-link > view > text + text {
  font-size: 11px;
  font-weight: 400;
  color: #5d5752;
  margin-top: 5px;
}
.home-news-section {
  margin-top: 40px;
}
.home-news-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.home-news-card {
  border: 1px solid #dccfbd;
  text-align: left;
  background: #fffdf9;
  padding: 24px;
  min-width: 0;
}
.home-news-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  color: #5d5752;
}
.home-news-meta > text:first-child {
  color: var(--jf-red, #c41a1a);
}
.home-news-title {
  display: block;
  font-family: 'JiafengSerif', serif;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.7;
  color: var(--jf-ink, #2c2c2c);
  margin-top: 16px;
}
.home-news-excerpt {
  display: block;
  color: #57514d;
  font-size: 13px;
  line-height: 1.85;
  margin-top: 11px;
}
.home-statistics-note {
  display: block;
  text-align: center;
  font-size: 11px;
  color: #5d5752;
  margin-top: 12px;
  line-height: 1.8;
}
.home-statistics .vision-number {
  color: var(--jf-red, #c41a1a);
}
.home-statistics > view {
  color: #57514d;
}
.home-english .hero-title {
  font-size: 39px;
  letter-spacing: 0;
}
.home-english .hero-description {
  white-space: normal;
  letter-spacing: 0;
}
.home-english .entry-label {
  font-size: 12px;
}
.home-english .entry-sub {
  font-size: 10px;
}
.home-english .home-topic-title {
  font-size: 16px;
}
.home-english .quote-text {
  font-size: 22px;
  letter-spacing: 0;
}
.home-english .mini-feature-title {
  font-size: 23px;
  letter-spacing: 0;
}
@media (min-width: 1450px) {
  .home-hero-swiper {
    height: 455px;
  }
  .home-hero-swiper .hero-copy {
    padding-top: 36px;
  }
}
@media (max-width: 1000px) {
  .home-topic-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .home-topic-feature {
    min-height: 0;
  }
  .home-hero-swiper {
    height: 440px;
  }
  .home-english .hero-title {
    font-size: 34px;
  }
}
@media (max-width: 600px) {
  .home-hero-swiper {
    height: 390px;
  }
  .home-hero-swiper .hero-copy {
    padding: 25px 20px 22px;
  }
  .home-hero-swiper .hero-title {
    font-size: 30px;
    line-height: 1.35;
    margin: 10px 0;
  }
  .home-carousel-tools {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 9px;
    padding-top: 7px;
  }
  .home-carousel-dots {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 4px;
  }
  .home-carousel-dot {
    width: 100%;
    min-width: 0;
    height: 32px;
    padding: 0;
  }
  .home-carousel-pause {
    margin: 0;
    padding: 5px 0;
    font-size: 10px;
    white-space: nowrap;
  }
  .home-topic-section {
    margin-bottom: 28px;
  }
  .home-topic-grid {
    gap: 12px;
  }
  .home-topic-card {
    padding: 16px 13px;
  }
  .home-topic-top {
    gap: 9px;
  }
  .home-topic-mark {
    width: 28px;
    height: 33px;
    font-size: 20px;
  }
  .home-topic-title {
    font-size: 14px;
  }
  .home-topic-description {
    font-size: 11px;
    line-height: 1.8;
    min-height: 60px;
    margin-top: 12px;
  }
  .home-topic-feature {
    font-size: 11px;
    min-height: 54px;
    padding-top: 11px;
    margin-top: 11px;
  }
  .home-topic-link {
    font-size: 11px;
  }
  .home-news-section {
    margin-top: 30px;
  }
  .home-news-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .home-news-card {
    padding: 21px;
  }
  .home-news-title {
    font-size: 18px;
    margin-top: 12px;
  }
  .home-news-excerpt {
    font-size: 12px;
  }
  .home-statistics .vision-number {
    font-size: 25px;
    letter-spacing: 0;
  }
  .home-statistics .vision-number text {
    font-size: 9px;
    margin-left: 4px;
  }
  .home-statistics > view {
    font-size: 9px;
  }
  .home-statistics-note {
    font-size: 10px;
  }
  .home-venue-link {
    grid-column: 1 / -1;
    margin-top: 0;
  }
  .home-english .hero-copy {
    width: 74%;
  }
  .home-english .hero-title {
    font-size: 27px;
    line-height: 1.45;
  }
  .home-english .hero-art {
    width: 26%;
    opacity: 0.8;
  }
  .home-english .hero-kicker {
    font-size: 7px;
    letter-spacing: 0.3px;
    white-space: normal;
  }
  .home-english .hero-description {
    font-size: 10px;
    line-height: 1.65;
  }
  .home-english .hero-foot {
    font-size: 7px;
    white-space: normal;
    margin-top: 19px;
  }
  .home-english .entry-label {
    font-size: 10px;
  }
  .home-english .entry-sub {
    font-size: 8px;
  }
  .home-english .home-topic-title {
    font-size: 12px;
  }
  .home-english .home-topic-description {
    min-height: 77px;
  }
  .home-english .home-topic-feature {
    min-height: 77px;
  }
  .home-english .quote-text {
    font-size: 17px;
  }
  .home-english .mini-feature-title {
    font-size: 17px;
  }
  .home-english .welcome-line {
    align-items: flex-start;
    gap: 12px;
  }
  .home-english .welcome-line > .muted {
    text-align: right;
  }
  .home-english .vision-number {
    font-size: 23px;
  }
  .home-english .vision-number text {
    display: block;
    font-size: 9px;
    margin-left: 0;
  }
  .home-english .vision-strip > view {
    font-size: 8px;
  }
}
</style>

<style scoped>
.home-search-all {
  margin: 12px 0 22px;
}
</style>
