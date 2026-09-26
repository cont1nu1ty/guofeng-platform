<script setup lang="ts">
import { isHttpMode } from '../../config/dataMode'
import { canNavigateVenue } from '../../domain/remoteCatalog'
import { regions } from '../../domain/fixtures'
import { computed, ref, watch } from 'vue'
import SectionHeading from '../../components/SectionHeading.vue'
import VenueJourney from './VenueJourney.vue'
import { navigate, goBack, useRouteParams } from '../../composables/useNavigation'
import { t } from '../../composables/useLocale'
import { region } from '../../composables/useDemo'
import { venues, type BilingualText } from '../../domain/contentCatalog'
const L = (value: BilingualText) => t(value.zh, value.en)
const params = useRouteParams()
const venue = computed(() => venues.find((item) => item.id === params.value.id))
const selectedRegion = ref<string>(region.value)
watch(region, (value) => {
  selectedRegion.value = value
})
const selectedPin = ref<string>(venues[0]?.id || '')
const routeVisible = ref(false)
const category = ref('all')
const regionOptions = computed(() =>
  regions.filter((r) => r.id === 'all' || venues.some((v) => v.region === r.id)),
)
function openMap() {
  if (!venue.value || !canNavigateVenue(venue.value)) return
  uni.openLocation({
    latitude: venue.value.latitude!,
    longitude: venue.value.longitude!,
    name: L(venue.value.title),
    address: L(venue.value.address),
    fail: () =>
      uni.showToast({
        title: t(
          '地图暂不可用，请查看地址与参观须知。',
          'Map unavailable. Refer to the address and visitor information.',
        ),
        icon: 'none',
      }),
  })
}
const filtered = computed(() =>
  venues.filter(
    (item) =>
      (selectedRegion.value === 'all' ||
        item.region === 'all' ||
        item.region === selectedRegion.value) &&
      (category.value === 'all' || item.category === category.value),
  ),
)
const highlighted = computed(
  () => filtered.value.find((item) => item.id === selectedPin.value) ?? filtered.value[0],
)
</script>
<template>
  <view class="content-page">
    <template v-if="venue">
      <view class="content-back">
        <wd-button variant="plain" size="small" @click="goBack()">
          {{ t('返回阵地', 'Back to venues') }}
        </wd-button>
        <text class="content-demo-label">
          {{
            isHttpMode && !venue.sample
              ? t('已发布阵地', 'Published venue')
              : t('虚构场馆 · 展示样例', 'Fictional venue · prototype')
          }}
        </text>
      </view>
      <view class="content-venue-detail-art">
        <view class="content-building">
          <view class="content-building-roof" />
          <view class="content-building-sign">{{ L(venue.title) }}</view>
          <view class="content-building-pillars">
            <view />
            <view />
            <view />
            <view />
          </view>
          <view class="content-building-stairs" />
        </view>
        <text class="content-venue-art-label">
          {{ t('家风传习阵地', 'Family Heritage Venue') }}
        </text>
      </view>
      <view class="content-venue-detail">
        <view class="content-meta">
          <text class="content-red-label">{{ L(venue.city) }}</text>
          <text>{{ t('原创示意场景', 'Original illustrative scene') }}</text>
        </view>
        <text class="content-detail-title">{{ L(venue.title) }}</text>
        <text class="content-lead">{{ L(venue.description) }}</text>
        <view class="content-facts">
          <view>
            <wd-icon name="location" />
            <text>{{ L(venue.address) }}</text>
          </view>
          <view>
            <wd-icon name="clock-circle" />
            <text>{{ L(venue.hours) }}</text>
          </view>
        </view>
        <view class="content-chip-row">
          <text v-for="(item, index) in venue.highlights" :key="index" class="content-soft-chip">
            {{ L(item) }}
          </text>
        </view>
        <view class="content-button-row">
          <wd-button
            v-if="venue.activityId"
            @click="navigate('learning', { id: venue.activityId })"
          >
            {{ t('查看研学与预约', 'Activities and booking') }}
          </wd-button>
          <wd-button variant="plain" @click="routeVisible = !routeVisible">
            {{ routeVisible ? t('收起导览', 'Hide route') : t('查看场馆导览', 'View venue route') }}
          </wd-button>
        </view>
      </view>
      <VenueJourney v-if="!isHttpMode" :destination="L(venue.title)" />
      <view v-else class="content-button-row">
        <wd-button v-if="canNavigateVenue(venue)" variant="plain" @click="openMap">
          {{ t('在地图中查看', 'Open in map') }}
        </wd-button>
        <text v-else class="scope-note">
          {{
            venue.sample
              ? t(
                  '虚构场馆不提供实际出行导航。',
                  'Fictional venues do not provide travel navigation.',
                )
              : t(
                  '尚未配置可用坐标，请查看场馆地址与联系方式。',
                  'Coordinates are unavailable. Refer to the address and contact details.',
                )
          }}
        </text>
      </view>
      <view v-if="routeVisible" class="content-route-panel">
        <text class="content-panel-title">{{ t('参观路线示意', 'Illustrative visit route') }}</text>
        <view class="content-route-stops">
          <view v-for="(stop, index) in venue.stops" :key="index" class="content-route-stop">
            <text class="content-stop-number">{{ index + 1 }}</text>
            <text>{{ L(stop) }}</text>
            <text v-if="index < venue.stops.length - 1" class="content-stop-arrow">→</text>
          </view>
        </view>
        <text class="content-caption">
          {{
            t(
              '此为场馆内部导览示意，不提供真实地图定位或道路导航。',
              'This is a sample indoor itinerary, without real geolocation or street navigation.',
            )
          }}
        </text>
      </view>
      <view class="content-venue-notice">
        <text class="content-panel-title">
          {{
            isHttpMode
              ? t('参观须知', 'Visitor information')
              : t('参观须知 · 展示样例', 'Visitor information · sample')
          }}
        </text>
        <text>
          {{
            isHttpMode
              ? venue.visitorNotice
                ? L(venue.visitorNotice)
                : t('暂无补充说明', 'No additional visitor information')
              : t(
                  '适合亲子共读与家庭文化体验；示例活动需先预约，可在活动详情体验签到。',
                  'Designed for family reading and cultural activities. Try registration and check-in on the activity page.',
                )
          }}
        </text>
        <text>
          {{
            isHttpMode
              ? venue.contact
                ? t('联系方式：', 'Contact: ') + venue.contact
                : ''
              : t(
                  '场馆、地址、开放时间与服务均为虚构，不能据此安排实际出行。正式接入后展示无障碍设施、交通信息与联系电话。',
                  'The venue, address, hours and services are fictional. Do not plan travel from this sample. Production pages will include accessibility, transport and contact information.',
                )
          }}
        </text>
      </view>
    </template>
    <template v-else-if="params.id">
      <view class="empty-state">
        {{ t('未找到可公开的阵地。', 'Published venue not found.') }}
        <wd-button variant="plain" @click="navigate('venues')">
          {{ t('查看全部阵地', 'View all venues') }}
        </wd-button>
      </view>
    </template>
    <template v-else>
      <SectionHeading
        :title="t('家风有传承，身边有阵地', 'Discover a place to learn together')"
        :eyebrow="t('传习阵地', 'Learning venues')"
        :subtitle="
          t(
            '从一间共读空间到一座文化书院，寻找可参与的家风课堂。',
            'Explore sample reading rooms, academies and community workshops.',
          )
        "
      />
      <view class="content-filter-tabs content-filter-space">
        <view
          v-for="item in regionOptions"
          :key="item.id"
          :class="['content-filter-chip', { active: selectedRegion === item.id }]"
          @click="selectedRegion = item.id"
        >
          {{ t(item.label) }}
        </view>
      </view>
      <view v-if="isHttpMode" class="content-filter-tabs">
        <button
          v-for="item in [
            { id: 'all', zh: '全部阵地', en: 'All venues' },
            { id: 'hall', zh: '宗祠名人馆', en: 'Heritage halls' },
            { id: 'practice', zh: '文明实践中心', en: 'Community centres' },
            { id: 'integrity', zh: '廉政教育基地', en: 'Integrity centres' },
          ]"
          :key="item.id"
          :class="['content-filter-chip', { active: category === item.id }]"
          @click="category = item.id"
        >
          {{ t(item.zh, item.en) }}
        </button>
      </view>
      <view v-if="!filtered.length" class="empty-state">
        <text>
          {{
            isHttpMode
              ? t(
                  '当前地区和语言暂无已发布阵地。',
                  'No venues are published for this region and language.',
                )
              : t(
                  '当前地区暂无阵地样例，后续内容将在统一版式下展示。',
                  'No sample venues are available in this region yet. Future content will use the same layout.',
                )
          }}
        </text>
        <wd-button variant="plain" @click="selectedRegion = 'all'">
          {{ t('查看其他地区', 'Browse other regions') }}
        </wd-button>
      </view>
      <view v-else class="content-venue-map-layout">
        <view class="content-map">
          <view class="content-map-grid" />
          <view class="content-map-river" />
          <view class="content-map-road content-map-road-one" />
          <view class="content-map-road content-map-road-two" />
          <text class="content-map-label">
            {{ t('阵地分布 · 示意图', 'Venue distribution · schematic') }}
          </text>
          <view
            v-for="item in filtered"
            :key="item.id"
            :class="['content-map-pin', { active: highlighted?.id === item.id }]"
            :style="{ left: item.x + '%', top: item.y + '%' }"
            @click="selectedPin = item.id"
          >
            <view>{{ item.mark }}</view>
            <text>{{ L(item.title) }}</text>
          </view>
          <text class="content-map-disclaimer">
            {{
              t(
                '非真实地图 · 无地理比例 · 点击标记查看阵地',
                'Illustration, not a real map · not to scale · select a marker',
              )
            }}
          </text>
        </view>
        <view v-if="highlighted" class="content-map-card">
          <text class="content-red-label">{{ L(highlighted.city) }}</text>
          <text class="content-card-title">{{ L(highlighted.title) }}</text>
          <text class="content-description">{{ L(highlighted.description) }}</text>
          <view class="content-chip-row">
            <text
              v-for="(item, index) in highlighted.highlights"
              :key="index"
              class="content-soft-chip"
            >
              {{ L(item) }}
            </text>
          </view>
          <wd-button @click="navigate('venues', { id: highlighted.id })">
            {{ t('查看阵地详情', 'View venue details') }}
          </wd-button>
        </view>
      </view>
      <view class="content-section-line">
        <text class="section-title">{{ t('走进传习阵地', 'Explore learning venues') }}</text>
        <text class="content-caption">{{ filtered.length }} {{ t('处阵地', 'venues') }}</text>
      </view>
      <view class="content-venue-grid">
        <view
          v-for="item in filtered"
          :key="item.id"
          class="content-venue-card"
          @click="navigate('venues', { id: item.id })"
        >
          <view class="content-venue-mini-art">
            <view class="content-mini-building">
              <view />
              <view />
              <view />
            </view>
            <text>{{ item.mark }}</text>
          </view>
          <view class="content-venue-card-body">
            <text class="content-red-label">{{ L(item.city) }}</text>
            <text class="content-card-title">{{ L(item.title) }}</text>
            <text class="content-description">{{ L(item.description) }}</text>
            <view class="content-card-footer">
              <text class="content-caption">
                {{
                  item.activityId
                    ? t('查看关联活动', 'View linked activity')
                    : t('图文导览', 'Illustrated guide')
                }}
              </text>
              <text class="content-read-link">{{ t('走进场馆', 'Explore') }} →</text>
            </view>
          </view>
        </view>
      </view>
      <view class="scope-note">
        {{
          isHttpMode
            ? t(
                '分布图是无地理比例的示意图。已配置真实坐标且非样例的阵地可打开地图；以场馆公布的地址和须知为准。',
                'The distribution view is a schematic, not to scale. Non-sample venues with coordinates can open a map. Follow the published address and visitor information.',
              )
            : t(
                '阵地与位置均为产品展示样例，不提供真实出行信息；正式地图、定位、路线规划与导航待接入。',
                'Venues and locations are prototype samples. Real maps, geolocation, route planning and navigation are not connected.',
              )
        }}
      </view>
    </template>
  </view>
</template>
