<script setup lang="ts">
import { isHttpMode } from '../../config/dataMode'
import { remoteUser } from '../../services/api'
import { recordEngagement } from '../../composables/useEngagement'
import { region } from '../../composables/useDemo'
import MediaSubmissionPanel from './MediaSubmissionPanel.vue'
import MediaAudioPlayer from './MediaAudioPlayer.vue'
import MediaAccessibilityPanel from './MediaAccessibilityPanel.vue'
import { computed, ref, watch } from 'vue'
import SectionHeading from '../../components/SectionHeading.vue'
import MediaCreationPanel from './MediaCreationPanel.vue'
import { useReplayCache } from '../composables/useReplayCache'
import { mediaCatalog, type BilingualText } from '../../domain/showcaseCatalog'
import {
  mediaFavorites,
  mediaLikes,
  showcaseStorageError,
  toggleMediaFavorite,
  toggleMediaLike,
} from '../../composables/useShowcase'
import { navigate, goBack, useRouteParams, screenUrl } from '../../composables/useNavigation'
import { t, locale } from '../../composables/useLocale'
import { assetUrl } from '../composables/useAssetUrl'
const params = useRouteParams()
const regionalMedia = computed(() =>
  mediaCatalog.filter(
    (x) => region.value === 'all' || !x.region || x.region === 'all' || x.region === region.value,
  ),
)
const current = computed(() => mediaCatalog.find((item) => item.id === params.value.id))
watch(
  () => [current.value?.id, remoteUser.value?.id],
  () => {
    if (current.value) void recordEngagement('media', current.value.id)
  },
  { immediate: true },
)
const replayCache = useReplayCache(current)
const filter = ref('all')
const shareOpen = ref(false)
const playerError = ref(false)
const playerLoading = ref(false)
const currentTime = ref(0)
function onTimeUpdate(event: unknown) {
  playerLoading.value = false
  currentTime.value = (event as { detail?: { currentTime?: number } }).detail?.currentTime || 0
}
const copied = ref(false)
const lt = (value: BilingualText) => t(value.zh, value.en)
const filters = computed(() => [
  { id: 'all', label: t('全部展播', 'All videos') },
  { id: 'letter', label: t('家书演绎', 'Family letters') },
  { id: 'documentary', label: t('日常纪实', 'Everyday life') },
  { id: 'lecture', label: t('讲堂回放', 'Lecture replays') },
  { id: 'recitation', label: t('家风朗诵', 'Recitations') },
  { id: 'favorites', label: t('我的收藏', 'Saved') },
])
const visible = computed(() =>
  regionalMedia.value.filter(
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
    currentTime.value = 0
  },
)
async function toggleAction(action: 'favorite' | 'like') {
  if (!current.value) return
  try {
    action === 'favorite'
      ? await toggleMediaFavorite(current.value.id)
      : await toggleMediaLike(current.value.id)
  } catch (error) {
    uni.showToast({
      title:
        error instanceof Error
          ? error.message
          : t('本机存储不可用，操作未保存', 'Storage unavailable. Changes were not saved.'),
      icon: 'none',
    })
  }
}
function copyShare() {
  if (!current.value) return
  let link = ''
  // #ifdef H5
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = screenUrl('media', { id: current.value.id, lang: locale.value })
  link = url.toString()
  // #endif
  uni.setClipboardData({
    data: `${link ? link + '\n' : ''}${lt(current.value.title)} · ${isHttpMode ? t('家风中华行', 'Family Heritage') : t('家风中华行前端演示', 'Family Heritage frontend demo')}\n${t('在短视频展播搜索片名查看。', 'Search the title in the media gallery.')}`,
    success() {
      copied.value = true
      if (current.value) void recordEngagement('media', current.value.id, 'share_intent')
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
          <MediaAudioPlayer v-if="current.type === 'audio'" :source="replayCache.source.value" />
          <view v-else class="media-player-frame">
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
              @timeupdate="onTimeUpdate"
              @error="playerError = true"
            />
            <view v-else class="media-player-fallback">
              <wd-icon name="video" size="32px" />
              <text>{{ t('媒体暂时无法播放', 'The media could not be played') }}</text>
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
          <MediaAccessibilityPanel
            v-if="isHttpMode"
            :media-id="current.id"
            :current-time="currentTime"
          />
          <text v-if="playerLoading && !playerError" class="showcase-note" role="status">
            {{ t('正在缓冲…', 'Buffering…') }}
          </text>
          <view v-if="current.type !== 'audio'" class="showcase-panel">
            <text class="showcase-card-title">{{ t('回放文件缓存', 'Replay file cache') }}</text>
            <view class="showcase-actions">
              <wd-button size="small" :disabled="replayCache.busy.value" @click="replayCache.save">
                {{
                  replayCache.busy.value
                    ? t('处理中…', 'Working…')
                    : replayCache.cached.value
                      ? t('重新缓存', 'Cache again')
                      : t('缓存本条媒体', 'Cache this media')
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
                    ? isHttpMode
                      ? t('切回在线播放', 'Play online')
                      : t('切回随包播放', 'Use packaged source')
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
                      '缓存仅保存本条媒体，不代表整个站点可离线启动。',
                      'Caching stores this media file only; it does not make the whole site available offline.',
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
                  isHttpMode
                    ? current.type === 'audio'
                      ? t('朗诵音频', 'Audio recitation')
                      : current.type === 'replay'
                        ? t('讲堂回放', 'Lecture replay')
                        : t('短视频', 'Video')
                    : current.type === 'replay'
                      ? t('回放界面样例', 'Replay interface sample')
                      : t('原创文字短片', 'Original typography short')
                }}
              </text>
              <text>
                {{ current.duration }} ·
                {{ isHttpMode ? t('平台展播', 'Published media') : t('静音样片', 'Silent sample') }}
              </text>
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
                {{
                  isHttpMode
                    ? t('本人记录', 'Your preference')
                    : mediaLikes.includes(current.id)
                      ? '1'
                      : '0'
                }}
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
                  copied
                    ? t('已复制分享文案', 'Text copied')
                    : t('复制分享内容', 'Copy sharing details')
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
              <!-- #ifdef MP-WEIXIN -->
              <button open-type="share" class="text-button">
                {{ t('分享给微信好友', 'Share with a WeChat contact') }}
              </button>
              <text class="showcase-note">
                {{
                  t(
                    '原生分享需要正式小程序配置；当前网页链接不会触发微信消息。',
                    'Native sharing requires a configured Mini Program. Web links do not send WeChat messages.',
                  )
                }}
              </text>
              <!-- #endif -->
              <!-- #ifdef H5 -->
              <text class="showcase-note">
                {{
                  t(
                    '分享内容含当前作品的网页链接；请确保接收人可访问本服务地址。',
                    'Sharing includes this work’s web link. Recipients must be able to access the server address.',
                  )
                }}
              </text>
              <!-- #endif -->
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
            v-for="item in regionalMedia.filter((video) => video.id !== current?.id)"
            :key="item.id"
            class="media-related"
            @click="navigate('media', { id: item.id })"
          >
            <image :src="assetUrl(item.poster)" mode="aspectFill" />
            <view>
              <text class="showcase-card-title">{{ lt(item.title) }}</text>
              <text class="showcase-note">
                {{ item.duration }} ·
                {{
                  isHttpMode ? t('已发布媒体', 'Published media') : t('原创演示', 'Original demo')
                }}
              </text>
            </view>
          </view>
          <view class="showcase-callout">
            <text class="showcase-card-title">{{ t('内容说明', 'About these samples') }}</text>
            <text>
              {{
                isHttpMode
                  ? t(
                      '媒体由后台审核发布，点赞和收藏保存在当前账号。上传视频统一转换为MP4，可选人工字幕与朗读；直播尚未接入。',
                      'Media is reviewed and published by editors. Likes and saved items belong to your account. Uploaded videos are normalized to MP4. Editors can add captions and recordings; live streaming is not connected.',
                    )
                  : t(
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
      <MediaSubmissionPanel v-if="isHttpMode" />
      <MediaCreationPanel v-else :initial-tab="params.tab" />
      <view
        v-if="regionalMedia.length"
        class="media-feature"
        @click="navigate('media', { id: regionalMedia[0].id })"
      >
        <image :src="assetUrl(regionalMedia[0].poster)" mode="aspectFill" />
        <view class="media-feature-copy">
          <text class="showcase-kicker">
            {{
              isHttpMode
                ? t('本期展播', 'Featured media')
                : t('本期推荐 · 原创样片', 'Featured · original sample')
            }}
          </text>
          <text class="showcase-title">{{ lt(regionalMedia[0].title) }}</text>
          <text>{{ lt(regionalMedia[0].excerpt) }}</text>
          <view class="media-play-link">
            <wd-icon name="play" size="22px" />
            <text>
              {{
                isHttpMode
                  ? t('播放作品', 'Play media')
                  : t('播放 12 秒样片', 'Play the 12-second sample')
              }}
            </text>
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
              <text>
                {{
                  isHttpMode
                    ? item.sample
                      ? t('虚构场景素材', 'Fictional showcase material')
                      : t('已发布', 'Published')
                    : t('原创静音样片', 'Original silent sample')
                }}
              </text>
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
          isHttpMode
            ? t(
                '当前地区、语言或分类暂无已发布媒体。',
                'No published media matches the current region, language or category.',
              )
            : t(
                '还没有收藏短片，打开一条短片即可收藏。',
                'No saved videos yet. Open a video to save it.',
              )
        }}
      </view>
      <view v-if="!isHttpMode" class="showcase-live-band">
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
