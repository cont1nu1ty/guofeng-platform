<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  regionChildren,
  venueArea,
  saveVenueArea,
  type RegionNode,
} from "../../services/regions";
import { loadWorkspace } from "../../services/workspaceData";
import { newRequestId } from "../../services/http";
const props = defineProps<{ venueId: string; provinceId: string }>();
const cities = ref<RegionNode[]>([]),
  counties = ref<RegionNode[]>([]),
  city = ref(""),
  county = ref(""),
  version = ref(0),
  current = ref("");
const busy = ref(false),
  error = ref("");
let epoch = 0,
  key = "",
  signature = "";
const coordinateSystem = ref("unknown");
const areaId = computed(() => county.value || city.value);
async function load() {
  const seq = ++epoch;
  busy.value = true;
  error.value = "";
  city.value = "";
  county.value = "";
  counties.value = [];
  try {
    const [association, list] = await Promise.all([
      venueArea(props.venueId),
      props.provinceId && props.provinceId !== "all"
        ? regionChildren(props.provinceId, false)
        : Promise.resolve([]),
    ]);
    if (seq !== epoch) return;
    version.value = association.version;
    coordinateSystem.value = association.coordinateSystem;
    cities.value = list;
    current.value = association.area?.name || "仅按省级地区展示";
    if (association.area) {
      city.value =
        association.area.level === 1
          ? association.area.id
          : association.area.parentId;
      const children = await regionChildren(city.value, false);
      if (seq !== epoch) return;
      counties.value = children;
      if (association.area.level === 2) county.value = association.area.id;
    }
  } catch (e) {
    if (seq === epoch) error.value = e instanceof Error ? e.message : "地区关联读取失败";
  } finally {
    if (seq === epoch) busy.value = false;
  }
}
async function selectCity() {
  county.value = "";
  counties.value = [];
  error.value = "";
  if (!city.value) return;
  const selected = city.value;
  try {
    const next = await regionChildren(selected, false);
    if (city.value === selected) counties.value = next;
  } catch (e) {
    if (city.value === selected) error.value = e instanceof Error ? e.message : "区县加载失败";
  }
}
async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  const next = `${props.venueId}:${areaId.value}:${version.value}:${coordinateSystem.value}`;
  if (signature !== next) {
    key = newRequestId();
    signature = next;
  }
  try {
    const result = await saveVenueArea(
      props.venueId,
      areaId.value,
      version.value,
      coordinateSystem.value,
      key,
    );
    version.value = result.version;
    current.value = result.area?.name || "仅按省级地区展示";
    await loadWorkspace();
    ElMessage.success("阵地地区已保存");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "关联未保存";
  } finally {
    busy.value = false;
  }
}
watch(() => [props.venueId, props.provinceId], load, { immediate: true });
</script>
<template>
  <p>
    当前归属：{{ current }}。市县节点由系统设置维护；未配置的节点不会自动生成。
  </p>
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
  <el-form label-position="top" v-loading="busy">
    <el-form-item label="城市"
      ><el-select
        v-model="city"
        clearable
        placeholder="仅按省级地区展示"
        @change="selectCity"
        ><el-option
          v-for="item in cities"
          :key="item.id"
          :value="item.id"
          :label="item.name" /></el-select
    ></el-form-item>
    <el-form-item label="区县"
      ><el-select
        v-model="county"
        clearable
        :disabled="!city"
        placeholder="归属所选城市"
        ><el-option
          v-for="item in counties"
          :key="item.id"
          :value="item.id"
          :label="item.name" /></el-select
    ></el-form-item>
    <el-form-item label="已填坐标的来源坐标系"
      ><el-select v-model="coordinateSystem"
        ><el-option value="unknown" label="待核对（不叠加底图）" /><el-option
          value="wgs84"
          label="WGS84（网页 OpenStreetMap 底图）" /><el-option
          value="gcj02"
          label="GCJ02（小程序地图）"
      /></el-select>
      <p>
        请依坐标来源核对，系统不推断或转换坐标系；网页底图须能够访问
        OpenStreetMap。原导航入口仍保留。
      </p></el-form-item
    >
    <el-button type="primary" :loading="busy" @click="save"
      >保存地区关联</el-button
    >
  </el-form>
</template>
