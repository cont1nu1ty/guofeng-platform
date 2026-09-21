<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
  CanvasRenderer,
]);
const props = withDefaults(
  defineProps<{ option: EChartsCoreOption; height?: string; label: string }>(),
  { height: "260px" },
);
const host = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | undefined;
let observer: ResizeObserver | undefined;
onMounted(() => {
  if (!host.value) return;
  const ensureChart = () => {
    if (!host.value?.clientWidth || !host.value?.clientHeight) return;
    if (!chart) {
      chart = echarts.init(host.value);
      chart.setOption(props.option);
    } else chart.resize();
  };
  ensureChart();
  observer = new ResizeObserver(ensureChart);
  observer.observe(host.value);
});
watch(
  () => props.option,
  (option) => chart?.setOption(option, true),
  { deep: true },
);
onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});
</script>
<template>
  <div
    ref="host"
    role="img"
    :aria-label="label"
    :style="{ height, width: '100%', minWidth: 0 }"
  />
</template>
