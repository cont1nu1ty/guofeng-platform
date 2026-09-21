<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, Document, DataAnalysis } from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import ChartPanel from "../components/ChartPanel.vue";
import { workspace, recordActivity, regions } from "../domain/workspace";
import { reviewState } from "../domain/review";
import {
  scopedSubmissions,
  scopedTasks,
  scopedActivities,
  scopedContents,
  historyTrend,
  trendOption,
  trendPeriod,
  channelOption,
  downloadSampleCsv,
} from "../domain/analytics";
const reportOpen = ref(false);
const reportPeriod = ref("2026年9月");
const regionRows = computed(() =>
  regions
    .slice(1)
    .filter(
      (region) => workspace.region === "全国" || workspace.region === region,
    )
    .map((region) => ({
      region,
      works: reviewState.submissions.filter((item) => item.region === region)
        .length,
      reviewing: reviewState.submissions.filter(
        (item) => item.region === region && item.status === "评审中",
      ).length,
      selected: reviewState.submissions.filter(
        (item) => item.region === region && item.status === "已入围",
      ).length,
    }))
    .sort((a, b) => b.works - a.works),
);
const progress = computed(() =>
  scopedSubmissions.value.length
    ? Math.round(
        (scopedSubmissions.value.filter((item) => item.status !== "待初审")
          .length /
          scopedSubmissions.value.length) *
          100,
      )
    : 0,
);
const barOption = computed(() => ({
  color: ["#ac4136"],
  grid: { left: 0, right: 24, top: 4, bottom: 0, containLabel: true },
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  xAxis: {
    type: "value",
    minInterval: 1,
    splitLine: { lineStyle: { color: "#eff0e7", type: "dashed" } },
    axisLabel: { fontSize: 10, color: "#a3aa94" },
  },
  yAxis: {
    type: "category",
    inverse: true,
    data: regionRows.value.map((item) => item.region),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#7d886d", fontSize: 11 },
  },
  series: [
    {
      type: "bar",
      barWidth: 15,
      data: regionRows.value.map((item) => item.works),
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: "right", fontSize: 10, color: "#9c8c69" },
    },
  ],
}));
function exportData() {
  downloadSampleCsv();
  recordActivity("导出示例统计CSV", workspace.region);
}
</script>
<template>
  <PageHeading
    title="数据智库"
    description="从征集、评审到传习，观察文化共建的每一步。所有图表均为示例。"
    eyebrow="INSIGHTS / 数据观察"
    ><template #actions
      ><el-button :icon="Download" @click="exportData">导出示例数据</el-button
      ><el-button type="primary" :icon="Document" @click="reportOpen = true"
        >报告预览</el-button
      ></template
    ></PageHeading
  >
  <div class="stat-grid">
    <div class="stat-card">
      <span>当前示例稿件</span
      ><strong>{{ scopedSubmissions.length }} <small>篇</small></strong>
      <p>覆盖当前筛选地区</p>
    </div>
    <div class="stat-card">
      <span>初审处理进度</span><strong>{{ progress }}<small>%</small></strong
      ><el-progress
        :percentage="progress"
        :show-text="false"
        color="#ab4437"
        :stroke-width="4"
      />
    </div>
    <div class="stat-card">
      <span>已完成评审任务</span
      ><strong
        >{{ scopedTasks.filter((item) => item.status === "已完成").length }}
        <small>项</small></strong
      >
      <p>共 {{ scopedTasks.length }} 项示例任务</p>
    </div>
    <div class="stat-card">
      <span>活动参与人次</span
      ><strong
        >{{
          scopedActivities.reduce(
            (sum, item) => sum + item.registrations.length,
            0,
          )
        }}
        <small>人次</small></strong
      >
      <p>当前 {{ scopedActivities.length }} 场示例活动</p>
    </div>
  </div>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2>征集与初审趋势</h2>
        <p>预设历史样例，不与当前稿件库合并计数 · {{ workspace.region }}</p>
      </div>
      <el-radio-group v-model="trendPeriod" size="small"
        ><el-radio-button value="7">近7日</el-radio-button
        ><el-radio-button value="14">近14日</el-radio-button></el-radio-group
      >
    </div>
    <ChartPanel
      :option="trendOption"
      label="预设历史投稿量与初审量折线图"
      height="300px"
    />
  </section>
  <div class="analytics-grid">
    <section class="panel">
      <div class="panel-header">
        <h2>区域征集分布</h2>
        <el-tag type="info">当前稿件</el-tag>
      </div>
      <ChartPanel
        :option="barOption"
        label="各地区当前示例稿件数量"
        height="235px"
      />
    </section>
    <section class="panel">
      <div class="panel-header">
        <h2>参与群体结构</h2>
        <el-icon class="muted"><DataAnalysis /></el-icon>
      </div>
      <ChartPanel
        :option="channelOption"
        label="示例稿件的投稿通道占比"
        height="235px"
      />
      <div class="empty-note">党政干部 / 校园青少年 / 城乡群众 / 特色群体</div>
    </section>
  </div>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2>区域明细</h2>
        <p>数字来自当前会话中的示例稿件，审核操作会同步改变统计。</p>
      </div>
    </div>
    <el-table :data="regionRows" empty-text="当前地区暂无示例"
      ><el-table-column
        prop="region"
        label="地区"
        min-width="140" /><el-table-column
        prop="works"
        label="投稿总数"
        min-width="100" /><el-table-column
        prop="reviewing"
        label="评审中"
        min-width="100" /><el-table-column
        prop="selected"
        label="示例入围"
        min-width="100"
    /></el-table>
  </section>
  <el-drawer
    v-model="reportOpen"
    title="文化共建报告 · 预览"
    size="min(650px, 100vw)"
    ><div class="report-sheet">
      <span class="report-eyebrow">JIAFENG / 示例报告</span>
      <h2>家风文化共建观察</h2>
      <div class="report-scope">
        {{ reportPeriod }} · {{ workspace.region }}
      </div>
      <el-divider />
      <p>
        本报告为界面演示模板，由当前示例记录汇总，不是实际运营报告或AI生成结果。
      </p>
      <h3>一、征集与评审</h3>
      <p>
        当前范围内共有 {{ scopedSubmissions.length }} 篇示例稿件，初审处理进度为
        {{ progress }}%。{{
          scopedTasks.filter((item) => item.status === "已完成").length
        }}
        项专家任务已完成示例评分。
      </p>
      <h3>二、内容与传习</h3>
      <p>
        已发布
        {{
          scopedContents.filter((item) => item.status === "已发布").length
        }}
        条示例内容；{{ scopedActivities.length }} 场活动累计记录
        {{
          scopedActivities.reduce(
            (sum, item) => sum + item.registrations.length,
            0,
          )
        }}
        人次示例报名。
      </p>
      <h3>三、历史趋势样例</h3>
      <p>
        所选
        {{
          historyTrend.length
        }}
        日趋势为预设数据，仅用于讨论报表展示方式。传播、文创及研学指标尚未接入。
      </p>
      <el-divider /><span class="muted small"
        >正式报告将按已确认的指标口径、授权范围和实际业务记录生成。</span
      >
    </div></el-drawer
  >
</template>
<style scoped>
.stat-card p {
  font-size: 10px;
  margin: 0;
}
.stat-card small {
  font-size: 12px;
  font-weight: 400;
  color: #9ca48d;
}
.analytics-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 20px;
  margin: 20px 0;
}
.analytics-grid > .panel {
  margin: 0;
}
.report-sheet {
  padding: 22px;
  background: #faf8f0;
  border: 1px solid #e8e2d2;
}
.report-eyebrow {
  font-size: 10px;
  letter-spacing: 2px;
  color: #a48d61;
}
.report-sheet h2 {
  font-family: JiafengSerif, serif;
  font-size: 26px;
  margin: 21px 0 12px;
  color: #674d34;
}
.report-scope {
  color: #a39373;
  font-size: 12px;
}
.report-sheet p {
  font-size: 13px;
  color: #7c7d6a;
  line-height: 2;
}
.report-sheet h3 {
  font-family: JiafengSerif, serif;
  color: #745c3f;
  margin-top: 24px;
}
@media (max-width: 700px) {
  .analytics-grid {
    grid-template-columns: 1fr;
  }
  .report-sheet {
    padding: 18px;
  }
}
</style>
