<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SectionHeading from '../../components/SectionHeading.vue'
import MediaCreationPanel from './MediaCreationPanel.vue'
import { useReplayCache } from '../../composables/useReplayCache'
import { mediaCatalog, type BilingualText } from '../../domain/showcaseCatalog'
import {
  mediaFavorites,
  mediaLikes,
  showcaseStorageError,
  toggleMediaFavorite,
  toggleMediaLike,
} from '../../composables/useShowcase'
import { navigate, goBack, useRouteParams } from '../../composables/useNavigation'
import { t } from '../../composables/useLocale'
import { assetUrl } from '../../composables/useAssetUrl'
const params = useRouteParams()
const current = computed(() => mediaCatalog.find((item) => item.id === params.value.id))
const replayCache = useReplayCache(current)
const filter = ref('all')
const shareOpen = ref(false)
const playerError = ref(false)
const playerLoading = ref(false)
const copied = ref(false)
const lt = (value: BilingualText) => t(value.zh, value.en)
const filters = computed(() => [
  { id: 'all', label: t('全部展播', 'All videos') },
  { id: 'letter', label: t('家书演绎', 'Family letters') },
  { id: 'documentary', label: t('日常纪实', 'Everyday life') },
  { id: 'lecture', label: t('讲堂回放', 'Lecture replays') },
  { id: 'favorites', label: t('我的收藏', 'Saved') },
])
const visible = computed(() =>
  mediaCatalog.filter(
    (item) =>
      filter.value === 'all' ||
      (filter.value === 'favorites'
        ? mediaFavorites.value.includes(item.id)
        : item.category === filter.value),
  ),
)
watch(
  () => params.value.id,
  () => {
    shareOpen.value = false
    playerError.value = false
    copied.value = false
  },
)
function toggleAction(action: 'favorite' | 'like') {
  if (!current.value) return
  try {
    action === 'favorite'
      ? toggleMediaFavorite(current.value.id)
      : toggleMediaLike(current.value.id)
  } catch {
    uni.showToast({
      title: t('本机存储不可用，操作未保存', 'Storage unavailable. Changes were not saved.'),
      icon: 'none',
    })
  }
}
function copyShare() {
  if (!current.value) return
  uni.setClipboardData({
    data: `${lt(current.value.title)} · ${t('家风中华行前端演示', 'Family Heritage frontend demo')}\n${t('在短视频展播查看片名即可找到，本分享卡不代表正式发布。', 'Find the title in the video gallery. This is a demonstration card.')}`,
    success() {
      copied.value = true
    },
    fail() {
      uni.showToast({
        title: t('复制未完成，可手动选择文字', 'Copy failed. Select the text manually.'),
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
          {{ t('返回展播', 'Back to gallery') }}
        </wd-button>
        <text>{{ lt(current.collection) }}</text>
      </view>
      <view class="showcase-detail-layout">
        <view>
          <view class="media-player-frame">
            <video
              v-if="!playerError"
              :key="current.id"
              class="media-player"
              :src="replayCache.source.value"
              :poster="assetUrl(current.poster)"
              :controls="true"
              :show-center-play-btn="true"
              :show-fullscreen-btn="true"
              :enable-progress-gesture="true"
              :autoplay="false"
              @waiting="playerLoading = true"
              @loadedmetadata="playerLoading = false"
              @timeupdate="playerLoading = false"
              @error="playerError = true"
            />
            <view v-else class="media-player-fallback">
              <wd-icon name="video" size="32px" />
              <text>{{ t('样片暂时无法播放', 'The sample could not be played') }}</text>
              <text>
                {{
                  t(
                    '仍可阅读下方文字脚本，或重新加载播放器。',
                    'Read the script below or reload the player.',
                  )
                }}
              </text>
              <wd-button variant="plain" size="small" @click="playerError = false">
                {{ t('重新加载', 'Reload') }}
              </wd-button>
            </view>
          </view>
          <text v-if="playerLoading && !playerError" class="showcase-note" role="status">
            {{ t('正在缓冲样片…', 'Buffering the sample…') }}
          </text>
          <view class="showcase-panel">
            <text class="showcase-card-title">{{ t('回放文件缓存', 'Replay file cache') }}</text>
            <view class="showcase-actions">
              <wd-button size="small" :disabled="replayCache.busy.value" @click="replayCache.save">
                {{
                  replayCache.busy.value
                    ? t('处理中…', 'Working…')
                    : replayCache.cached.value
                      ? t('重新缓存', 'Cache again')
                      : t('缓存本条样片', 'Cache this sample')
                }}
              </wd-button>
              <wd-button
                v-if="replayCache.cached.value"
                size="small"
                variant="plain"
                @click="replayCache.useCached.value = !replayCache.useCached.value"
              >
                {{
                  replayCache.useCached.value
                    ? t('切回随包播放', 'Use packaged source')
                    : t('使用缓存播放', 'Play from cache')
                }}
              </wd-button>
              <wd-button
                v-if="replayCache.cached.value"
                size="small"
                variant="plain"
                :disabled="replayCache.busy.value"
                @click="replayCache.remove"
              >
                {{ t('删除缓存', 'Delete cache') }}
              </wd-button>
            </view>
            <text class="showcase-note">
              {{
                replayCache.useCached.value
                  ? t(
                      '当前播放器使用本机缓存文件。',
                      'The player is using the locally cached file.',
                    )
                  : t(
                      '缓存仅保存本条样片，不代表整个站点可离线启动。',
                      'Caching stores this sample file only; it does not make the whole site available offline.',
                    )
              }}
            </text>
            <text v-if="replayCache.message.value" class="showcase-note" role="status">
              {{ replayCache.message.value }}
            </text>
          </view>
          <view class="media-detail-copy showcase-panel">
            <view class="showcase-meta">
              <text>
                {{
                  current.type === 'replay'
                    ? t('回放界面样例', 'Replay interface sample')
                    : t('原创文字短片', 'Original typography short')
                }}
              </text>
              <text>{{ current.duration }} · {{ t('静音样片', 'Silent sample') }}</text>
            </view>
            <text class="showcase-title">{{ lt(current.title) }}</text>
            <text class="showcase-description">{{ lt(current.excerpt) }}</text>
            <view class="showcase-actions">
              <wd-button
                size="small"
                :variant="!mediaLikes.includes(current.id) ? 'plain' : 'base'"
                @click="toggleAction('like')"
              >
                {{ mediaLikes.includes(current.id) ? t('已点赞', 'Liked') : t('点赞', 'Like') }} ·
                {{ mediaLikes.includes(current.id) ? '1' : '0' }}
              </wd-button>
              <wd-button
                size="small"
                :variant="!mediaFavorites.includes(current.id) ? 'plain' : 'base'"
                @click="toggleAction('favorite')"
              >
                {{
                  mediaFavorites.includes(current.id)
                    ? t('已收藏', 'Saved')
                    : t('收藏短片', 'Save video')
                }}
              </wd-button>
              <wd-button size="small" variant="plain" @click="shareOpen = !shareOpen">
                {{ t('分享卡片', 'Share card') }}
              </wd-button>
            </view>
            <view v-if="shareOpen" class="showcase-share-card">
              <text class="showcase-kicker">
                {{ t('家风中华行 · 邀你共读', 'Family Heritage · Read together') }}
              </text>
              <text class="showcase-card-title">{{ lt(current.title) }}</text>
              <text class="showcase-description">{{ lt(current.excerpt) }}</text>
              <wd-button size="small" @click="copyShare">
                {{
                  copied ? t('已复制分享文案', 'Text copied') : t('复制分享文案', 'Copy share text')
                }}
              </wd-button>
              <text class="showcase-note">
                {{
                  t(
                    '分享文案只复制到剪贴板，由你自行发送。',
                    'The text is copied to your clipboard for you to share.',
                  )
                }}
              </text>
            </view>
          </view>
          <view class="showcase-panel showcase-script">
            <text class="showcase-card-title">{{ t('短片文字脚本', 'Video script') }}</text>
            <view
              v-for="(line, index) in current.transcript"
              :key="index"
              class="showcase-script-line"
            >
              <text class="showcase-step">0{{ index + 1 }}</text>
              <text>{{ lt(line) }}</text>
            </view>
          </view>
        </view>
        <view class="showcase-side-panel">
          <text class="showcase-card-title">{{ t('继续看 · 家风合集', 'Continue watching') }}</text>
          <view
            v-for="item in mediaCatalog.filter((video) => video.id !== current?.id)"
            :key="item.id"
            class="media-related"
            @click="navigate('media', { id: item.id })"
          >
            <image :src="assetUrl(item.poster)" mode="aspectFill" />
            <view>
              <text class="showcase-card-title">{{ lt(item.title) }}</text>
              <text class="showcase-note">
                {{ item.duration }} · {{ t('原创演示', 'Original demo') }}
              </text>
            </view>
          </view>
          <view class="showcase-callout">
            <text class="showcase-card-title">{{ t('内容说明', 'About these samples') }}</text>
            <text>
              {{
                t(
                  '样片为本项目自制的文字动画。讲堂内容用于演示回放布局，没有正在进行的直播。点赞与收藏仅保存在当前设备。',
                  'All samples are original typography animations. The lecture demonstrates a replay layout; no live stream is running. Likes and saved videos stay on this device.',
                )
              }}
            </text>
          </view>
        </view>
      </view>
    </template>
    <template v-else-if="params.id">
      <view class="empty-state">
        {{ t('没有找到这条短片', 'Video not found') }}
        <wd-button size="small" @click="navigate('media')">
          {{ t('查看全部展播', 'View all videos') }}
        </wd-button>
      </view>
    </template>
    <template v-else>
      <SectionHeading
        :title="t('帧藏家风，让温暖被看见', 'Family stories, brought to life')"
        :eyebrow="t('短视频 · 讲堂 · 合集', 'VIDEOS · TALKS · COLLECTIONS')"
        :subtitle="
          t(
            '一封家书、一段日常、一场共读，把家的力量留在时光里。',
            'Letters, everyday moments and shared reading — preserving the strength of family.',
          )
        "
      />
      <MediaCreationPanel :initial-tab="params.tab" />
      <view class="media-feature" @click="navigate('media', { id: mediaCatalog[0].id })">
        <image :src="assetUrl(mediaCatalog[0].poster)" mode="aspectFill" />
        <view class="media-feature-copy">
          <text class="showcase-kicker">
            {{ t('本期推荐 · 原创样片', 'Featured · original sample') }}
          </text>
          <text class="showcase-title">{{ lt(mediaCatalog[0].title) }}</text>
          <text>{{ lt(mediaCatalog[0].excerpt) }}</text>
          <view class="media-play-link">
            <wd-icon name="play" size="22px" />
            <text>{{ t('播放 12 秒样片', 'Play the 12-second sample') }}</text>
          </view>
        </view>
      </view>
      <view class="showcase-filter" role="tablist">
        <wd-button
          v-for="item in filters"
          :key="item.id"
          size="small"
          :variant="filter !== item.id ? 'plain' : 'base'"
          @click="filter = item.id"
        >
          {{ item.label }}
        </wd-button>
      </view>
      <view class="showcase-grid">
        <view
          v-for="item in visible"
          :key="item.id"
          class="showcase-card media-card"
          @click="navigate('media', { id: item.id })"
        >
          <view class="media-card-cover">
            <image :src="assetUrl(item.poster)" mode="aspectFill" />
            <view class="media-play-disc"><wd-icon name="play" size="25px" /></view>
            <text class="media-duration">{{ item.duration }}</text>
          </view>
          <view class="showcase-card-body">
            <text class="showcase-kicker">{{ lt(item.collection) }}</text>
            <text class="showcase-card-title">{{ lt(item.title) }}</text>
            <text class="showcase-description">{{ lt(item.excerpt) }}</text>
            <view class="showcase-card-foot">
              <text>{{ t('原创静音样片', 'Original silent sample') }}</text>
              <text>
                {{
                  mediaFavorites.includes(item.id) ? t('已收藏', 'Saved') : t('观看 →', 'Watch →')
                }}
              </text>
            </view>
          </view>
        </view>
      </view>
      <view v-if="!visible.length" class="empty-state">
        {{
          t(
            '还没有收藏短片，打开一条短片即可收藏。',
            'No saved videos yet. Open a video to save it.',
          )
        }}
      </view>
      <view class="showcase-live-band">
        <view>
          <text class="showcase-card-title">
            {{ t('家风讲堂 · 云端共读', 'Family values lecture · read together') }}
          </text>
          <text>
            {{
              t(
                '查看回放样例，体验播放、文字脚本与合集浏览。',
                'Explore a sample replay, its script and related videos.',
              )
            }}
          </text>
        </view>
        <wd-button variant="plain" size="small" @click="navigate('media', { id: 'lecture-01' })">
          {{ t('查看回放', 'View replay') }}
        </wd-button>
      </view>
    </template>
    <view v-if="showcaseStorageError" class="scope-note">
      {{
        t(
          '本机存储不可用；本页可浏览，但收藏、点赞及申领记录无法保存。',
          'Storage is unavailable. You can browse, but changes cannot be saved.',
        )
      }}
    </view>
  </view>
</template>
