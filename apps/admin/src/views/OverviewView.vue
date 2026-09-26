<script setup lang="ts">
import { isHttpMode, modeText } from "../services/mode";

import { computed } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowRight,
  Document,
  Checked,
  Calendar,
  Reading,
  Plus,
  EditPen,
  User,
  Collection,
  Clock,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import ChartPanel from "../components/ChartPanel.vue";
import { activityLog, workspace } from "../domain/workspace";
import {
  scopedSubmissions,
  scopedTasks,
  scopedActivities,
  scopedContents,
  trendOption,
  historyTrend,
  trendPeriod,
  channelDistribution,
  channelOption,
} from "../domain/analytics";

import { canVisit } from "../services/session";
const router = useRouter();
const pending = computed(() =>
  scopedSubmissions.value.filter((item) => item.status === "待初审"),
);
const pendingTasks = computed(() =>
  scopedTasks.value.filter((item) => item.status === "待评分"),
);
const metrics = computed(() => [
  {
    label: "征集稿件",
    value: scopedSubmissions.value.length,
    unit: "篇",
    detail: `${pending.value.length} 篇待初审`,
    icon: Document,
    color: "red",
    path: "/submissions",
  },
  {
    label: "待办评审",
    value: pendingTasks.value.length,
    unit: "项",
    detail: "查看专家任务进度",
    icon: Checked,
    color: "gold",
    path: "/reviews",
  },
  {
    label: "开放活动",
    value: scopedActivities.value.filter((item) =>
      ["报名中", "进行中"].includes(item.status),
    ).length,
    unit: "场",
    detail: `${scopedActivities.value.reduce((sum, item) => sum + item.registrations.length, 0)} 人次报名`,
    icon: Calendar,
    color: "green",
    path: "/activities",
  },
  {
    label: "已发布内容",
    value: scopedContents.value.filter((item) => item.status === "已发布")
      .length,
    unit: "条",
    detail: "资讯、公告与文化专题",
    icon: Reading,
    color: "blue",
    path: "/content",
  },
]);
const quickLinks = [
  {
    label: "稿件初审",
    description: "让好作品被看见",
    path: "/submissions",
    icon: EditPen,
    color: "red",
  },
  {
    label: "内容发布",
    description: "传递家风新声音",
    path: "/content",
    icon: Reading,
    color: "gold",
  },
  {
    label: "活动管理",
    description: "让文化走入生活",
    path: "/activities",
    icon: Calendar,
    color: "green",
  },
  {
    label: "典籍编纂",
    description: "留存可传承的记忆",
    path: "/collections",
    icon: Collection,
    color: "blue",
  },
];
</script>
<template>
  <PageHeading
    title="运营工作台"
    :description="`${workspace.region}视角 · 让每一份家风故事，都被认真对待。`"
    eyebrow="WORKSPACE / 运营总览"
    ><template #actions
      ><el-button
        v-if="canVisit('/activities')"
        :icon="Calendar"
        @click="router.push('/activities')"
        >活动日历</el-button
      ><el-button
        v-if="canVisit('/content')"
        type="primary"
        :icon="Plus"
        @click="router.push('/content')"
        >内容管理</el-button
      ></template
    ></PageHeading
  >
  <section class="welcome-banner">
    <div class="welcome-copy">
      <div class="welcome-kicker"><span /> 家风相传 · 文脉共续</div>
      <h2>以一方家风，涵养万家新风</h2>
      <p>从一封家书开始，让真挚的故事被记录，让优良的家风被传承。</p>
      <button v-if="canVisit('/submissions')" @click="router.push('/submissions')">
        今日待审 <b>{{ pending.length }}</b> 篇
        <el-icon><ArrowRight /></el-icon>
      </button>
    </div>
    <div class="welcome-art" aria-hidden="true">
      <div class="arch arch-one" />
      <div class="arch arch-two" />
      <div class="arch arch-three" />
      <div class="art-book"><span>家</span><i>风</i></div>
      <div class="art-caption">修身 · 齐家 · 传承</div>
      <div class="art-circle" />
    </div>
  </section>
  <div class="stat-grid overview-metrics">
    <button
      v-for="metric in metrics.filter((item) => canVisit(item.path))"
      :key="metric.label"
      class="stat-card metric-button"
      @click="router.push(metric.path)"
    >
      <div class="metric-top">
        <span>{{ metric.label }}</span
        ><span class="metric-icon" :class="metric.color"
          ><el-icon><component :is="metric.icon" /></el-icon
        ></span>
      </div>
      <div class="metric-value">
        {{ metric.value }}<small>{{ metric.unit }}</small>
      </div>
      <div class="metric-bottom">
        <span>{{ metric.detail }}</span
        ><el-icon><ArrowRight /></el-icon>
      </div>
    </button>
  </div>
  <div class="overview-main-grid">
    <section v-if="canVisit('/analytics')" class="panel trend-panel">
      <div class="panel-header">
        <div>
          <h2><span class="heading-rule" />征集与初审趋势</h2>
          <p>
            {{ modeText("按实际业务日期汇总", "预设历史样例") }} ·
            {{ workspace.region }}
          </p>
        </div>
        <el-radio-group v-model="trendPeriod" size="small"
          ><el-radio-button value="7">近 7 日</el-radio-button
          ><el-radio-button value="14"
            >近 14 日</el-radio-button
          ></el-radio-group
        >
      </div>
      <el-empty
        v-if="isHttpMode && !historyTrend.length"
        description="暂无历史业务记录"
        :image-size="80"
      /><ChartPanel
        v-else
        :option="trendOption"
        :label="modeText('实际投稿与初审历史趋势', '预设历史趋势，非运营数据')"
        height="236px"
      />
    </section>
    <section v-if="canVisit('/analytics')" class="panel channel-panel">
      <div class="panel-header">
        <div>
          <h2><span class="heading-rule" />投稿通道分布</h2>
          <p>当前展示稿件</p>
        </div>
        <el-icon class="muted"><User /></el-icon>
      </div>
      <ChartPanel
        :option="channelOption"
        label="四类投稿通道的当前稿件分布"
        height="186px"
      />
      <div class="channel-legend">
        <div v-for="(item, index) in channelDistribution" :key="item.name">
          <span
            class="legend-dot"
            :style="{
              background: ['#ad4138', '#c8ab77', '#647e71', '#b2bba9'][index],
            }"
          />{{ item.name }}<b>{{ item.value }}<small>篇</small></b>
        </div>
      </div>
    </section>
    <section v-if="canVisit('/submissions')" class="panel pending-panel">
      <div class="panel-header">
        <h2>
          <span class="heading-rule" />待办事项
          <span class="count-pill">{{
            pending.length + pendingTasks.length
          }}</span>
        </h2>
        <el-button text type="primary" @click="router.push('/submissions')"
          >全部稿件 <el-icon><ArrowRight /></el-icon
        ></el-button>
      </div>
      <div class="pending-tabs">
        <span class="active"
          >待初审稿件 <b>{{ pending.length }}</b></span
        ><button @click="router.push('/reviews')">
          专家评审 <b>{{ pendingTasks.length }}</b>
        </button>
      </div>
      <el-table
        class="pending-desktop-table"
        :data="pending.slice(0, 4)"
        empty-text="该地区暂无待初审稿件"
        @row-click="router.push('/submissions')"
        ><el-table-column label="稿件信息" min-width="215"
          ><template #default="{ row }"
            ><div class="work-title">{{ row.title }}</div>
            <span class="work-meta"
              >{{ row.author }} <i>·</i> {{ row.genre }}</span
            ></template
          ></el-table-column
        ><el-table-column
          prop="region"
          label="所属地区"
          width="95" /><el-table-column label="状态" width="86"
          ><template #default
            ><el-tag type="warning" size="small">待初审</el-tag></template
          ></el-table-column
        ><el-table-column label="操作" width="66" align="right"
          ><template #default
            ><el-button
              type="primary"
              link
              @click.stop="router.push('/submissions')"
              >处理
              <el-icon
                ><ArrowRight /></el-icon></el-button></template></el-table-column
      ></el-table>
      <div class="pending-mobile-list">
        <div
          v-for="item in pending.slice(0, 4)"
          :key="item.id"
          class="pending-mobile-item"
        >
          <div>
            <b>{{ item.title }}</b
            ><small>{{ item.author }} · {{ item.region }}</small>
          </div>
          <el-button type="primary" link @click="router.push('/submissions')"
            >处理 <el-icon><ArrowRight /></el-icon
          ></el-button>
        </div>
        <el-empty
          v-if="!pending.length"
          description="暂无待审稿件"
          :image-size="60"
        />
      </div>
    </section>
    <section class="panel activity-panel">
      <div class="panel-header">
        <h2><span class="heading-rule" />工作动态</h2>
        <el-icon class="muted"><Clock /></el-icon>
      </div>
      <div class="timeline-list">
        <div
          v-for="(item, index) in activityLog.slice(0, 4)"
          :key="item.id"
          class="timeline-item"
        >
          <span class="timeline-dot" :class="{ first: index === 0 }" />
          <div>
            <span class="timeline-time">{{ item.time }}</span>
            <h4>{{ item.action }}</h4>
            <p>{{ item.target }}</p>
          </div>
        </div>
      </div>
      <el-button v-if="canVisit('/settings')" text class="all-log-button" @click="router.push('/settings')"
        >查看全部操作日志 <el-icon><ArrowRight /></el-icon
      ></el-button>
    </section>
  </div>
  <div class="quick-links">
    <button
      v-for="item in quickLinks.filter(item=>canVisit(item.path))"
      :key="item.path"
      @click="router.push(item.path)"
    >
      <span class="quick-icon" :class="item.color"
        ><el-icon><component :is="item.icon" /></el-icon></span
      ><span
        ><b>{{ item.label }}</b
        ><small>{{ item.description }}</small></span
      ><el-icon><ArrowRight /></el-icon>
    </button>
  </div>
</template>
<style scoped>
.pending-mobile-list {
  display: none;
}
.pending-mobile-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 17px 0;
  border-bottom: 1px solid #edf0e6;
  gap: 12px;
}
.pending-mobile-item:last-child {
  border-bottom: 0;
}
.pending-mobile-item b {
  font-size: 12px;
  font-weight: 500;
  color: #566148;
  display: block;
}
.pending-mobile-item small {
  display: block;
  font-size: 10px;
  color: #9aa38b;
  margin-top: 7px;
}
.pending-mobile-item .el-button {
  font-size: 11px;
}
.welcome-banner {
  height: 186px;
  position: relative;
  overflow: hidden;
  background: #eeeade;
  border: 1px solid #e3dfd3;
  border-radius: 9px;
  display: flex;
  justify-content: space-between;
  padding: 25px 31px;
  margin-bottom: 22px;
}
.welcome-copy {
  z-index: 2;
  position: relative;
}
.welcome-kicker {
  font-size: 10px;
  letter-spacing: 2px;
  color: #a48d63;
  display: flex;
  align-items: center;
  gap: 6px;
}
.welcome-kicker > span {
  width: 4px;
  height: 4px;
  background: #b4955b;
  transform: rotate(45deg);
}
.welcome-copy h2 {
  font-family: JiafengSerif, serif;
  font-size: 25px;
  color: #594c35;
  margin: 11px 0 9px;
  letter-spacing: 1.8px;
}
.welcome-copy p {
  font-size: 11px;
  color: #9d9784;
  margin: 0 0 17px;
}
.welcome-copy button {
  background: #fbfaf680;
  border: 1px solid #d8d0b9;
  color: #8c744b;
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 11px;
  border-radius: 4px;
}
.welcome-copy button b {
  font-size: 13px;
  font-weight: 600;
  color: #9c3e2d;
}
.welcome-art {
  position: relative;
  width: 340px;
  height: 186px;
  align-self: center;
  flex-shrink: 0;
  margin-right: 22px;
}
.arch {
  position: absolute;
  bottom: -22px;
  left: 40px;
  width: 240px;
  height: 217px;
  border: 1px solid #baad8730;
  border-radius: 120px 120px 0 0;
}
.arch-two {
  left: 62px;
  width: 196px;
  height: 194px;
}
.arch-three {
  left: 83px;
  width: 154px;
  height: 174px;
}
.art-book {
  position: absolute;
  left: 123px;
  top: 35px;
  width: 90px;
  height: 116px;
  border: 1px solid #b8a377;
  color: #9e4b36;
  box-shadow:
    inset 0 0 0 4px #eeeade,
    inset 0 0 0 5px #c2b38e;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 6px;
  transform: rotate(-7deg);
  background: #eeeade;
  z-index: 1;
}
.art-book span,
.art-book i {
  font-family: JiafengSerif, serif;
  font-size: 38px;
  font-style: normal;
  line-height: 1.25;
}
.art-caption {
  position: absolute;
  left: 236px;
  top: 44px;
  writing-mode: vertical-rl;
  color: #ad9a71;
  font-size: 10px;
  letter-spacing: 5px;
}
.art-circle {
  position: absolute;
  right: 16px;
  top: 9px;
  background: #cdb98417;
  border: 1px solid #cdb98415;
  border-radius: 50%;
  width: 80px;
  height: 80px;
}
.metric-button {
  font-family: inherit;
  text-align: left;
  transition:
    border-color 0.15s,
    transform 0.15s;
}
.metric-button:hover {
  border-color: #d9c4b2;
  transform: translateY(-2px);
}
.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #818a78;
}
.metric-icon {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-size: 17px;
}
.red {
  background: #fbede8;
  color: #af483b;
}
.gold {
  background: #f6f0e2;
  color: #ae8c4f;
}
.green {
  background: #edf3ec;
  color: #68806a;
}
.blue {
  background: #eef1f6;
  color: #687b8f;
}
.metric-value {
  font-size: 31px;
  font-weight: 600;
  color: #364133;
  margin: 9px 0 14px;
  line-height: 1;
  letter-spacing: -1px;
}
.metric-value small {
  font-size: 10px;
  font-weight: 400;
  color: #a3aa98;
  letter-spacing: 0;
  margin-left: 8px;
}
.metric-bottom {
  border-top: 1px solid #f0f1eb;
  padding-top: 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #929b86;
  font-size: 10px;
}
.metric-bottom > .el-icon {
  color: #b8c1aa;
}
.overview-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.85fr) minmax(280px, 1fr);
  gap: 20px;
}
.overview-main-grid > .panel {
  margin: 0;
}
.heading-rule {
  width: 3px;
  height: 13px;
  display: inline-block;
  background: #b5483c;
  border-radius: 2px;
}
.overview-main-grid .panel-header h2 {
  font-size: 14px;
}
.overview-main-grid .panel-header .el-button {
  font-size: 10px;
  padding: 0;
}
.overview-main-grid .panel-header p {
  padding-left: 13px;
  font-size: 10px;
}
.count-pill {
  font-size: 10px;
  padding: 2px 6px;
  background: #f5f2e9;
  color: #a19068;
  font-weight: 400;
  border-radius: 4px;
}
.channel-panel {
  padding-bottom: 20px;
}
.channel-panel .panel-header {
  margin-bottom: 0;
}
.channel-legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  font-size: 10px;
  color: #939c86;
  padding-top: 6px;
}
.channel-legend > div {
  display: flex;
  align-items: center;
  gap: 6px;
}
.channel-legend b {
  margin-left: auto;
  color: #676f5e;
  font-weight: 500;
}
.channel-legend small {
  font-size: 9px;
  color: #abb39f;
  padding-left: 4px;
}
.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 2px;
}
.pending-panel .panel-header {
  margin-bottom: 12px;
}
.pending-tabs {
  display: flex;
  gap: 23px;
  height: 40px;
  border-bottom: 1px solid #eaece2;
  margin-bottom: 4px;
  font-size: 11px;
  color: #919985;
}
.pending-tabs > span,
.pending-tabs > button {
  height: 40px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.pending-tabs .active {
  color: #a84332;
  border-bottom: 2px solid #ad4638;
}
.pending-tabs button {
  border: 0;
  padding: 0;
  background: none;
  font-size: 11px;
  color: #929d83;
}
.pending-tabs b {
  font-weight: 400;
  font-size: 9px;
}
.work-title {
  font-size: 12px;
  color: #4d5742;
  margin-bottom: 4px;
}
.work-meta {
  font-size: 10px;
  color: #99a08e;
}
.work-meta i {
  padding: 0 5px;
  font-style: normal;
}
.pending-panel :deep(.el-table__row) {
  cursor: pointer;
}
.pending-panel :deep(.el-table td.el-table__cell) {
  padding: 11px 0;
}
.timeline-list {
  padding-top: 9px;
}
.timeline-item {
  position: relative;
  display: flex;
  gap: 14px;
  padding: 0 0 22px;
}
.timeline-item:not(:last-child):before {
  content: "";
  position: absolute;
  left: 3px;
  top: 9px;
  bottom: 0;
  border-left: 1px solid #e2e6d8;
}
.timeline-dot {
  position: relative;
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border: 1px solid #c3c9b5;
  border-radius: 50%;
  background: #fff;
  margin-top: 5px;
  z-index: 1;
}
.timeline-dot.first {
  background: #b3855c;
  border-color: #b3855c;
  box-shadow: 0 0 0 3px #b3855c12;
}
.timeline-time {
  font-size: 9px;
  color: #a9b098;
  display: block;
  margin-bottom: 6px;
}
.timeline-item h4 {
  font-size: 11px;
  font-weight: 500;
  margin: 0 0 3px;
  color: #677353;
}
.timeline-item p {
  font-size: 10px;
  color: #a1a990;
  margin: 0;
  line-height: 1.6;
}
.all-log-button {
  font-size: 10px;
  width: 100%;
  color: #85916e;
  border-top: 1px solid #eaeedf;
  padding-top: 17px;
  height: 34px;
}
.quick-links {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 17px;
  margin-top: 20px;
}
.quick-links > button {
  display: flex;
  align-items: center;
  gap: 13px;
  border: 1px solid #e4e7db;
  background: #fff;
  border-radius: 8px;
  padding: 18px;
  text-align: left;
  min-width: 0;
}
.quick-links b {
  font-size: 12px;
  font-weight: 500;
  display: block;
  color: #566047;
}
.quick-links small {
  font-size: 9px;
  color: #a0a68f;
  display: block;
  margin-top: 6px;
  white-space: nowrap;
}
.quick-icon {
  width: 35px;
  height: 35px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-size: 17px;
  flex-shrink: 0;
}
.quick-links > button > .el-icon {
  font-size: 10px;
  color: #b5bba7;
  margin-left: auto;
}
.quick-links > button:hover {
  border-color: #c8ba9d;
}
@media (max-width: 1200px) {
  .overview-main-grid {
    grid-template-columns: minmax(0, 1.5fr) minmax(270px, 1fr);
  }
  .welcome-art {
    width: 280px;
    margin-right: -40px;
  }
  .quick-links {
    gap: 12px;
  }
  .quick-links > button {
    padding: 14px;
    gap: 9px;
  }
  .quick-links small {
    font-size: 8px;
  }
  .quick-links > button > .el-icon {
    display: none;
  }
}
@media (max-width: 760px) {
  .overview-main-grid {
    grid-template-columns: 1fr;
  }
  .channel-panel {
    display: none;
  }
  .quick-links {
    grid-template-columns: repeat(2, 1fr);
  }
  .welcome-art {
    position: absolute;
    right: -50px;
    opacity: 0.4;
  }
  .welcome-copy h2 {
    font-size: 23px;
  }
  .welcome-copy p {
    max-width: 340px;
  }
  .welcome-banner {
    padding: 23px;
    height: 184px;
  }
}
@media (max-width: 640px) {
  .pending-desktop-table {
    display: none;
  }
  .pending-mobile-list {
    display: block;
  }
  .welcome-banner {
    padding: 22px 18px;
    height: 192px;
  }
  .welcome-copy h2 {
    font-size: 21px;
    letter-spacing: 0.5px;
    margin-top: 15px;
  }
  .welcome-copy p {
    font-size: 10px;
    max-width: 270px;
    line-height: 1.8;
    margin-bottom: 14px;
  }
  .welcome-art {
    right: -120px;
    opacity: 0.28;
  }
  .welcome-kicker {
    font-size: 9px;
  }
  .overview-metrics .stat-card {
    padding: 14px;
  }
  .metric-top {
    font-size: 11px;
  }
  .metric-icon {
    width: 27px;
    height: 27px;
    font-size: 14px;
  }
  .metric-value {
    font-size: 29px;
    margin: 12px 0;
  }
  .metric-bottom {
    font-size: 9px;
    line-height: 1.6;
  }
  .metric-bottom .el-icon {
    display: none;
  }
  .overview-main-grid {
    gap: 15px;
  }
  .quick-links {
    gap: 10px;
    margin-top: 15px;
  }
  .quick-links > button {
    padding: 13px;
    gap: 9px;
  }
  .quick-links b {
    font-size: 11px;
  }
  .quick-icon {
    width: 29px;
    height: 29px;
    font-size: 14px;
  }
  .quick-links small {
    font-size: 8px;
  }
  .trend-panel .panel-header {
    align-items: flex-start;
  }
  .overview-main-grid .panel-header h2 {
    font-size: 13px;
  }
  .overview-main-grid .panel-header p {
    font-size: 9px;
  }
}
</style>
