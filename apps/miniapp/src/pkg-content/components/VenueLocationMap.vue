<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '../../composables/useLocale'
import { request } from '../../services/api'
const props = defineProps<{ venueId: string; latitude: number; longitude: number; title: string }>()
const mapError = ref(false)
const coordinateSystem = ref('unknown'),
  loading = ref(false)
const externalMapOpen = ref(false)
let sequence = 0
watch(
  () => props.venueId,
  async (id) => {
    const seq = ++sequence
    externalMapOpen.value = false
    coordinateSystem.value = 'unknown'
    mapError.value = false
    loading.value = true
    try {
      const result = await request<{ coordinateSystem: string }>(
        `/regions/venue-map/${encodeURIComponent(id)}`,
      )
      if (seq === sequence) coordinateSystem.value = result.data.coordinateSystem
    } catch {
      if (seq === sequence) mapError.value = true
    } finally {
      if (seq === sequence) loading.value = false
    }
  },
  { immediate: true },
)
const markers = computed(() => [
  {
    id: 1,
    latitude: props.latitude,
    longitude: props.longitude,
    title: props.title,
    callout: { content: props.title, display: 'ALWAYS' },
  },
])
// #ifdef H5
const mapUrl = computed(() => {
  const lat = props.latitude,
    lon = props.longitude,
    clampLat = (n: number) => Math.max(-85, Math.min(85, n)),
    clampLon = (n: number) => Math.max(-180, Math.min(180, n))
  return `https://www.openstreetmap.org/export/embed.html?bbox=${[clampLon(lon - 0.025), clampLat(lat - 0.018), clampLon(lon + 0.025), clampLat(lat + 0.018)].join(',')}&layer=mapnik&marker=${lat},${lon}`
})
// #endif
</script>
<template>
  <view class="venue-location-map">
    <text v-if="loading" role="status">{{ t('正在读取地图配置…', 'Loading map settings…') }}</text>
    <!-- #ifdef H5 -->
    <wd-button
      v-if="coordinateSystem === 'wgs84' && !externalMapOpen"
      variant="plain"
      @click="externalMapOpen = true"
    >
      {{ t('加载 OpenStreetMap 地图', 'Load OpenStreetMap') }}
    </wd-button>
    <iframe
      v-if="coordinateSystem === 'wgs84' && externalMapOpen"
      :src="mapUrl"
      :title="t('阵地位置地图：', 'Venue location: ') + title"
      class="venue-map-frame"
      loading="lazy"
      referrerpolicy="no-referrer"
    />
    <text v-if="coordinateSystem === 'wgs84'" class="scope-note">
      {{
        t(
          '点击加载后将向 OpenStreetMap 请求阵地坐标附近的底图，第三方会接收您的网络地址；不发送您的定位。地图保留原提供方署名，需要公网访问。',
          'Loading requests venue-area map tiles from OpenStreetMap, which receives your network address. Your location is not sent. Provider attribution is retained; internet access is required.',
        )
      }}
    </text>
    <text v-else-if="!loading" class="scope-note">
      {{
        t(
          '网页底图需要已核对的 WGS84 坐标；请使用地址和已有导航入口。',
          'The web map requires verified WGS84 coordinates. Use the address and navigation link.',
        )
      }}
    </text>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <map
      v-if="!mapError && coordinateSystem === 'gcj02'"
      class="venue-map-frame"
      :latitude="latitude"
      :longitude="longitude"
      :markers="markers"
      :scale="14"
      @error="mapError = true"
    />
    <text v-else-if="!loading" class="scope-note">
      {{
        t(
          '小程序地图需要已核对的 GCJ02 坐标；请使用地址或地图导航。',
          'The mini-program map requires verified GCJ02 coordinates. Use the address or navigation link.',
        )
      }}
    </text>
    <!-- #endif -->
  </view>
</template>
<style scoped>
.venue-map-frame {
  width: 100%;
  height: 300px;
  display: block;
  border: 0;
  border-radius: 12px;
}
.venue-location-map {
  min-width: 0;
}
.scope-note {
  display: block;
  margin-top: 8px;
}
</style>
