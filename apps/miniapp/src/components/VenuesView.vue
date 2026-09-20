<script setup lang="ts">
import { computed, ref } from 'vue'
import SectionHeading from './SectionHeading.vue'
import { navigate, goBack, useRouteParams } from '../composables/useNavigation'
import { t } from '../composables/useLocale'
import { region } from '../composables/useDemo'
import { venues, type BilingualText } from '../domain/contentCatalog'
const L = (value: BilingualText) => t(value.zh, value.en)
const params = useRouteParams()
const venue = computed(() => venues.find((item) => item.id === params.value.id))
const selectedRegion = ref<string>(region.value)
const selectedPin = ref<string>(venues[0].id)
const routeVisible = ref(false)
const filtered = computed(() =>
  venues.filter((item) => selectedRegion.value === 'all' || item.region === selectedRegion.value),
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
          {{ t('虚构场馆 · 展示样例', 'Fictional venue · prototype') }}
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
          <wd-button @click="navigate('learning', { id: venue.activityId })">
            {{ t('查看研学与预约', 'Activities and booking') }}
          </wd-button>
          <wd-button variant="plain" @click="routeVisible = !routeVisible">
            {{ routeVisible ? t('收起导览', 'Hide route') : t('查看场馆导览', 'View venue route') }}
          </wd-button>
        </view>
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
          {{ t('参观须知 · 展示样例', 'Visitor information · sample') }}
        </text>
        <text>
          {{
            t(
              '适合亲子共读与家庭文化体验；示例活动需先预约，可在活动详情体验签到。',
              'Designed for family reading and cultural activities. Try registration and check-in on the activity page.',
            )
          }}
        </text>
        <text>
          {{
            t(
              '场馆、地址、开放时间与服务均为虚构，不能据此安排实际出行。正式接入后展示无障碍设施、交通信息与联系电话。',
              'The venue, address, hours and services are fictional. Do not plan travel from this sample. Production pages will include accessibility, transport and contact information.',
            )
          }}
        </text>
      </view>
    </template>
    <template v-else-if="params.id">
      <view class="empty-state">
        {{ t('未找到这个示例阵地。', 'This sample venue was not found.') }}
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
          v-for="item in [
            { id: 'all', zh: '全国', en: 'All regions' },
            { id: 'beijing', zh: '北京', en: 'Beijing' },
            { id: 'zhejiang', zh: '浙江', en: 'Zhejiang' },
            { id: 'sichuan', zh: '四川', en: 'Sichuan' },
          ]"
          :key="item.id"
          :class="['content-filter-chip', { active: selectedRegion === item.id }]"
          @click="selectedRegion = item.id"
        >
          {{ t(item.zh, item.en) }}
        </view>
      </view>
      <view class="content-venue-map-layout">
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
        <text class="content-caption">
          {{ filtered.length }} {{ t('处示例阵地', 'sample venues') }}
        </text>
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
                {{ t('可预约示例活动', 'Sample activity available') }}
              </text>
              <text class="content-read-link">{{ t('走进场馆', 'Explore') }} →</text>
            </view>
          </view>
        </view>
      </view>
      <view class="scope-note">
        {{
          t(
            '阵地与位置均为产品展示样例，不提供真实出行信息；正式地图、定位、路线规划与导航待接入。',
            'Venues and locations are prototype samples. Real maps, geolocation, route planning and navigation are not connected.',
          )
        }}
      </view>
    </template>
  </view>
</template>
