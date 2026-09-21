import { computed, ref } from "vue";
import { reviewState } from "./review";
import { editorialState } from "./editorial";
import { matchesRegion, workspace } from "./workspace";

export const trendPeriod = ref<"7" | "14">("14");
export const scopedSubmissions = computed(() =>
  reviewState.submissions.filter((item) => matchesRegion(item.region)),
);
export const scopedTasks = computed(() =>
  reviewState.tasks.filter((item) => matchesRegion(item.region)),
);
export const scopedActivities = computed(() =>
  editorialState.activities.filter((item) => matchesRegion(item.region)),
);
export const scopedContents = computed(() =>
  editorialState.contents.filter((item) => matchesRegion(item.region)),
);
const sampleTrend = [12, 18, 15, 24, 20, 29, 25, 34, 29, 38, 33, 42, 37, 48];
export const historyTrend = computed(() => {
  const factor =
    workspace.region === "全国"
      ? 1
      : ({
          北京市: 0.24,
          浙江省: 0.27,
          四川省: 0.19,
          江苏省: 0.17,
          广东省: 0.13,
        }[workspace.region] ?? 0.2);
  return sampleTrend
    .map((count, index) => ({
      date: `09.${String(index + 7).padStart(2, "0")}`,
      submitted: Math.round(count * factor),
      reviewed: Math.round((count * 0.67 + (index % 3)) * factor),
    }))
    .slice(trendPeriod.value === "7" ? -7 : 0);
});
export const trendOption = computed(() => ({
  color: ["#b23d35", "#abaf9b"],
  tooltip: {
    trigger: "axis",
    borderWidth: 0,
    textStyle: { fontSize: 11 },
    extraCssText: "box-shadow:0 4px 20px #30302015;border-radius:8px",
  },
  legend: {
    right: 2,
    top: 0,
    icon: "circle",
    itemWidth: 6,
    itemHeight: 6,
    textStyle: { color: "#949a8b", fontSize: 10 },
  },
  grid: { left: 0, right: 12, top: 42, bottom: 8, containLabel: true },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: historyTrend.value.map((item) => item.date),
    axisLine: { lineStyle: { color: "#e8eae0" } },
    axisTick: { show: false },
    axisLabel: { color: "#a3aa9a", fontSize: 10, margin: 14 },
  },
  yAxis: {
    type: "value",
    minInterval: 1,
    axisLabel: { color: "#a3aa9a", fontSize: 10 },
    splitLine: { lineStyle: { color: "#f0f1eb", type: "dashed" } },
  },
  series: [
    {
      name: "投稿量",
      type: "line",
      smooth: 0.3,
      symbol: "circle",
      showSymbol: false,
      symbolSize: 6,
      lineStyle: { width: 2.5 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "#d68c7928" },
            { offset: 1, color: "#d68c7901" },
          ],
        },
      },
      data: historyTrend.value.map((item) => item.submitted),
    },
    {
      name: "完成初审",
      type: "line",
      smooth: 0.3,
      showSymbol: false,
      lineStyle: { width: 1.5, type: "dashed" },
      data: historyTrend.value.map((item) => item.reviewed),
    },
  ],
}));
export const channelDistribution = computed(() =>
  ["党政干部", "校园青少年", "城乡群众", "特色群体"].map((name) => ({
    name,
    value: scopedSubmissions.value.filter((item) => item.channel === name)
      .length,
  })),
);
export const channelOption = computed(() => ({
  color: ["#ad4138", "#c8ab77", "#647e71", "#b2bba9"],
  tooltip: {
    trigger: "item",
    formatter: "{b}：{c} 篇（{d}%）",
    borderWidth: 0,
    textStyle: { fontSize: 11 },
  },
  graphic: [
    {
      type: "text",
      left: "center",
      top: "37%",
      style: {
        text: `${scopedSubmissions.value.length}`,
        font: "600 29px sans-serif",
        fill: "#333d32",
        textAlign: "center",
      },
    },
    {
      type: "text",
      left: "center",
      top: "54%",
      style: {
        text: "示例稿件",
        font: "10px sans-serif",
        fill: "#a0a690",
        textAlign: "center",
      },
    },
  ],
  series: [
    {
      type: "pie",
      radius: ["64%", "78%"],
      center: ["50%", "48%"],
      label: { show: false },
      itemStyle: { borderColor: "#fff", borderWidth: 4, borderRadius: 4 },
      data: channelDistribution.value,
    },
  ],
}));

export function downloadSampleCsv() {
  const rows = [
    ["家风中华行 · 示例统计导出（非运营数据）"],
    ["范围", workspace.region],
    ["日期", "示例投稿量", "示例完成初审"],
    ...historyTrend.value.map((item) => [
      item.date,
      `${item.submitted}`,
      `${item.reviewed}`,
    ]),
  ];
  const csv =
    "\ufeff" +
    rows
      .map((row) =>
        row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "家风中华行-示例统计.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
