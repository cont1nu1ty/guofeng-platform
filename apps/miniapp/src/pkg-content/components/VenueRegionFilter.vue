<script setup lang="ts">
import { ref, watch } from 'vue'
import { request } from '../../services/api'
import { t } from '../../composables/useLocale'
import type { VenueRegionNode } from '../domain/venueRegions'
const props = defineProps<{ provinceId: string }>()
const emit = defineEmits<{ filter: [ids: string[] | null] }>()
const cities = ref<VenueRegionNode[]>([]),
  counties = ref<VenueRegionNode[]>([]),
  city = ref(''),
  county = ref('')
const busy = ref(false),
  error = ref('')
let sequence = 0
const label = (item: VenueRegionNode) => t(item.name, item.nameEn || item.name)
async function children(id: string) {
  return (
    await request<{ items: VenueRegionNode[] }>(
      `/regions/children?parentId=${encodeURIComponent(id)}`,
    )
  ).data.items
}
async function loadProvince() {
  const serial = ++sequence
  city.value = ''
  county.value = ''
  cities.value = []
  counties.value = []
  error.value = ''
  emit('filter', null)
  if (!props.provinceId || props.provinceId === 'all') {
    busy.value = false
    return
  }
  busy.value = true
  try {
    const result = await children(props.provinceId)
    if (serial === sequence) cities.value = result
  } catch (e) {
    if (serial === sequence)
      error.value = e instanceof Error ? e.message : t('地区加载失败', 'Unable to load regions')
  } finally {
    if (serial === sequence) busy.value = false
  }
}
async function selectCity(id: string) {
  city.value = id
  county.value = ''
  counties.value = []
  await filterArea(true)
}
async function selectCounty(id: string) {
  county.value = id
  await filterArea(false)
}
async function filterArea(loadChildren: boolean) {
  const serial = ++sequence,
    area = county.value || city.value
  error.value = ''
  if (!area) {
    busy.value = false
    emit('filter', null)
    return
  }
  busy.value = true
  emit('filter', [])
  try {
    const [venues, next] = await Promise.all([
      request<{ ids: string[] }>(`/regions/venues?areaId=${encodeURIComponent(area)}`),
      loadChildren ? children(city.value) : Promise.resolve(null),
    ])
    if (serial !== sequence) return
    if (next) counties.value = next
    emit('filter', venues.data.ids)
  } catch (e) {
    if (serial === sequence)
      error.value =
        e instanceof Error ? e.message : t('筛选未完成，请重试', 'Filter failed. Please retry')
  } finally {
    if (serial === sequence) busy.value = false
  }
}
watch(() => props.provinceId, loadProvince, { immediate: true })
</script>
<template>
  <view class="venue-regions">
    <view v-if="cities.length" class="content-filter-row">
      <wd-button
        size="small"
        :variant="city ? 'plain' : 'solid'"
        :disabled="busy"
        @click="selectCity('')"
      >
        {{ t('全部城市', 'All cities') }}
      </wd-button>
      <wd-button
        v-for="item in cities"
        :key="item.id"
        size="small"
        :variant="city === item.id ? 'solid' : 'plain'"
        :disabled="busy"
        @click="selectCity(item.id)"
      >
        {{ label(item) }}
      </wd-button>
    </view>
    <view v-if="counties.length" class="content-filter-row">
      <wd-button
        size="small"
        :variant="county ? 'plain' : 'solid'"
        :disabled="busy"
        @click="selectCounty('')"
      >
        {{ t('全部区县', 'All districts') }}
      </wd-button>
      <wd-button
        v-for="item in counties"
        :key="item.id"
        size="small"
        :variant="county === item.id ? 'solid' : 'plain'"
        :disabled="busy"
        @click="selectCounty(item.id)"
      >
        {{ label(item) }}
      </wd-button>
    </view>
    <text v-if="busy" role="status">
      {{ t('正在读取地区与阵地…', 'Loading regions and venues…') }}
    </text>
    <view v-else-if="error" role="alert">
      <text>{{ error }}</text>
      <wd-button variant="plain" size="small" @click="city ? filterArea(true) : loadProvince()">
        {{ t('重试', 'Retry') }}
      </wd-button>
    </view>
    <text v-else-if="provinceId !== 'all' && !cities.length" class="scope-note">
      {{
        t(
          '此地区尚未配置市县目录，可继续查看省级阵地。',
          'No city directory is available yet. Province-level venues remain available.',
        )
      }}
    </text>
  </view>
</template>
<style scoped>
.venue-regions {
  margin-bottom: 16px;
}
.content-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
