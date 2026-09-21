<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  Search,
  Setting,
  ArrowRight,
  CircleCheck,
  Clock,
  EditPen,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import Pagination from "../components/upstream/Pagination.vue";
import { workspace, matchesRegion } from "../domain/workspace";
import {
  reviewState,
  reviewFlow,
  scoringDimensions,
  submitReview,
  configureReviewFlow,
  type ReviewTask,
} from "../domain/review";

const tab = ref("tasks"),
  search = ref(""),
  taskStatus = ref(""),
  expert = ref(""),
  page = ref(1),
  limit = ref(10);
const drawer = ref(false),
  activeId = ref(""),
  scores = ref<number[]>([0, 0, 0, 0]),
  comment = ref(""),
  scoreError = ref("");
const configureOpen = ref(false),
  configurationError = ref("");
const flowDraft = ref({
  blind: true,
  deadlineDays: 7,
  enabled: reviewFlow.stages.map((stage) => stage.enabled),
});
const activeTask = computed(() =>
  reviewState.tasks.find((task) => task.id === activeId.value),
);
const activeSubmission = computed(() =>
  reviewState.submissions.find(
    (item) => item.id === activeTask.value?.submissionId,
  ),
);
const totalScore = computed(() =>
  scores.value.reduce(
    (sum, score) => sum + (Number.isFinite(score) ? score : 0),
    0,
  ),
);
const scoped = computed(() =>
  reviewState.tasks.filter((task) => matchesRegion(task.region)),
);
const enriched = computed(() =>
  scoped.value.map((task) => ({
    ...task,
    submission: reviewState.submissions.find(
      (item) => item.id === task.submissionId,
    ),
    expert: reviewState.experts.find((item) => item.id === task.expertId),
  })),
);
const filtered = computed(() =>
  enriched.value.filter(
    (task) =>
      (!search.value ||
        `${task.submission?.title}${task.id}`.includes(search.value.trim())) &&
      (!taskStatus.value || task.status === taskStatus.value) &&
      (!expert.value || task.expertId === expert.value),
  ),
);
const rows = computed(() =>
  filtered.value.slice(
    (page.value - 1) * limit.value,
    page.value * limit.value,
  ),
);
const pending = computed(
  () => scoped.value.filter((task) => task.status === "待评分").length,
);
const complete = computed(
  () => scoped.value.filter((task) => task.status === "已完成").length,
);
function isOverdue(task: ReviewTask) {
  return (
    task.status === "待评分" &&
    new Date(`${task.dueAt}T23:59:59`).getTime() < Date.now()
  );
}
const overdue = computed(() => scoped.value.filter(isOverdue).length);
watch([search, taskStatus, expert, () => workspace.region, limit], () => {
  page.value = 1;
});
function openTask(task: ReviewTask) {
  activeId.value = task.id;
  scores.value = task.scores ? [...task.scores] : [0, 0, 0, 0];
  comment.value = task.comment || "";
  scoreError.value = "";
  drawer.value = true;
}
function submit() {
  if (!activeTask.value) return;
  const result = submitReview(activeTask.value.id, scores.value, comment.value);
  if (!result.ok) {
    scoreError.value = result.message;
    return;
  }
  scoreError.value = "";
  ElMessage.success(result.message);
}
function configure() {
  flowDraft.value = {
    blind: reviewFlow.blind,
    deadlineDays: reviewFlow.deadlineDays,
    enabled: reviewFlow.stages.map((stage) => stage.enabled),
  };
  configurationError.value = "";
  configureOpen.value = true;
}
function saveConfiguration() {
  const result = configureReviewFlow(flowDraft.value);
  if (!result.ok) {
    configurationError.value = result.message;
    return;
  }
  configureOpen.value = false;
  ElMessage.success(result.message);
}
</script>

<template>
  <div class="reviews-view">
    <PageHeading
      title="评审管理"
      description="有序分配，认真评阅。清晰掌握每一轮评审的进展。"
      eyebrow="评审中心 / 评审管理"
      ><template #actions
        ><el-button :icon="Setting" @click="configure"
          >流程示意配置</el-button
        ></template
      ></PageHeading
    >
    <div class="review-overview">
      <div class="review-summary">
        <span class="summary-eyebrow">评审任务 · {{ workspace.region }}</span>
        <div class="summary-number">
          {{ scoped.length }}<small>项任务</small>
        </div>
        <p>示例任务进度随本次操作即时更新</p>
      </div>
      <div class="review-metric">
        <el-icon><EditPen /></el-icon><strong>{{ pending }}</strong
        ><span>待专家评分</span>
      </div>
      <div class="review-metric">
        <el-icon><CircleCheck /></el-icon><strong>{{ complete }}</strong
        ><span>已完成评分</span>
      </div>
      <div class="review-metric overdue">
        <el-icon><Clock /></el-icon><strong>{{ overdue }}</strong
        ><span>已超过截止日期</span>
      </div>
    </div>
    <section class="panel review-panel">
      <el-tabs v-model="tab" class="review-tabs">
        <el-tab-pane label="评审任务" name="tasks">
          <div class="filter-bar review-filters">
            <el-input
              v-model="search"
              clearable
              :prefix-icon="Search"
              placeholder="搜索作品或任务编号"
              aria-label="搜索评审任务"
            /><el-select
              v-model="taskStatus"
              clearable
              placeholder="全部任务状态"
              aria-label="任务状态"
              ><el-option label="待评分" value="待评分" /><el-option
                label="已完成"
                value="已完成" /></el-select
            ><el-select
              v-model="expert"
              clearable
              placeholder="全部专家"
              aria-label="评审专家"
              ><el-option
                v-for="item in reviewState.experts"
                :key="item.id"
                :label="item.name"
                :value="item.id" /></el-select
            ><el-button
              @click="
                search = '';
                taskStatus = '';
                expert = '';
              "
              >重置</el-button
            >
          </div>
          <el-table
            :data="rows"
            empty-text="没有匹配的评审任务，可在投稿作品中分配专家。"
          >
            <el-table-column label="评审作品" min-width="230"
              ><template #default="{ row }"
                ><button class="title-link" @click="openTask(row)">
                  {{ row.submission?.title }}
                </button>
                <div class="cell-secondary">
                  {{ row.submissionId }}
                </div></template
              ></el-table-column
            >
            <el-table-column label="负责专家" min-width="145"
              ><template #default="{ row }"
                ><div class="expert-name">
                  <span class="mini-avatar">{{
                    row.expert?.name.slice(0, 1)
                  }}</span>
                  <div>
                    {{ row.expert?.name }}
                    <div class="cell-secondary">{{ row.expert?.group }}</div>
                  </div>
                </div></template
              ></el-table-column
            >
            <el-table-column prop="stage" label="评审节点" min-width="135" />
            <el-table-column label="截止日期" min-width="130"
              ><template #default="{ row }"
                ><span :class="{ 'overdue-text': isOverdue(row) }">{{
                  row.dueAt
                }}</span>
                <div v-if="isOverdue(row)" class="cell-secondary overdue-text">
                  已逾期 · 待跟进
                </div></template
              ></el-table-column
            >
            <el-table-column label="状态" width="100"
              ><template #default="{ row }"
                ><el-tag
                  :type="row.status === '已完成' ? 'success' : 'warning'"
                  >{{ row.status }}</el-tag
                ></template
              ></el-table-column
            >
            <el-table-column label="操作" fixed="right" width="112"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="openTask(row)">{{
                  row.status === "待评分" ? "进入评分" : "查看评语"
                }}</el-button></template
              ></el-table-column
            >
          </el-table>
          <Pagination
            v-model:page="page"
            v-model:limit="limit"
            :total="filtered.length"
          />
        </el-tab-pane>
        <el-tab-pane label="流程与评分规则" name="flow">
          <div class="flow-heading">
            <div>
              <h2>{{ reviewFlow.name }}</h2>
              <p>原文六级流程 · 最终节点及晋级规则待业务确认</p>
            </div>
            <el-tag type="warning" effect="plain">讨论方案</el-tag>
          </div>
          <div class="flow-grid">
            <div
              v-for="(stage, index) in reviewFlow.stages"
              :key="stage.name"
              :class="['flow-node', { disabled: !stage.enabled }]"
            >
              <span class="node-number">0{{ index + 1 }}</span
              ><strong>{{ stage.name }}</strong
              ><span>{{ stage.owner }}</span
              ><el-tag
                size="small"
                :type="stage.enabled ? 'success' : 'info'"
                effect="plain"
                >{{ stage.enabled ? "示意启用" : "示意关闭" }}</el-tag
              ><el-icon v-if="index < 5" class="node-arrow"
                ><ArrowRight
              /></el-icon>
            </div>
          </div>
          <div class="rule-summary">
            <span
              >匿名展示
              <b>{{ reviewFlow.blind ? "已开启" : "已关闭" }}</b></span
            ><span
              >建议评审时限 <b>{{ reviewFlow.deadlineDays }} 天</b></span
            ><span>总分 <b>100 分</b></span>
          </div>
          <h3 class="rule-title">评分维度</h3>
          <div class="scoring-rules">
            <div v-for="dimension in scoringDimensions" :key="dimension.label">
              <span class="rule-max">{{ dimension.max }}<small>分</small></span>
              <div>
                <h4>{{ dimension.label }}</h4>
                <p>{{ dimension.description }}</p>
              </div>
            </div>
          </div>
          <el-alert
            title="配置用于界面讨论，不执行流程引擎。修改节点和时限不会迁移或重算已分配任务；评分完成后也不会自动入围、公示或签发证书。"
            type="info"
            :closable="false"
            show-icon
          />
        </el-tab-pane>
      </el-tabs>
    </section>
    <p class="footnote">
      评分、评语与流程配置仅保存在当前页面会话，刷新恢复示例。匿名展示只是界面演示，真实盲审字段与访问权限仍需服务端控制。
    </p>

    <el-drawer
      v-model="drawer"
      :title="activeTask?.status === '已完成' ? '评审记录' : '专家评分'"
      size="min(720px, 100vw)"
      destroy-on-close
    >
      <template v-if="activeTask && activeSubmission">
        <div class="scoring-heading">
          <el-tag
            :type="activeTask.status === '已完成' ? 'success' : 'warning'"
            >{{ activeTask.status }}</el-tag
          >
          <h2>{{ activeSubmission.title }}</h2>
          <p>
            {{
              reviewFlow.blind
                ? "作者信息已隐藏 · 匿名展示示例"
                : `${activeSubmission.author} · ${activeSubmission.region}`
            }}<br />{{ activeSubmission.genre }} · {{ activeSubmission.id }}
          </p>
        </div>
        <el-collapse
          ><el-collapse-item title="展开阅读作品内容" name="content"
            ><div class="review-manuscript">
              {{ activeSubmission.content }}
            </div></el-collapse-item
          ></el-collapse
        >
        <div class="score-total">
          <div>
            <span>本次评审总分</span>
            <p>请结合每项标准独立评分</p>
          </div>
          <strong>{{ totalScore }}<small>/ 100</small></strong>
        </div>
        <el-form label-position="top" class="score-form"
          ><div
            v-for="(dimension, index) in scoringDimensions"
            :key="dimension.label"
            class="score-row"
          >
            <div>
              <label :for="`score-${index}`"
                >{{ dimension.label }}
                <small>满分 {{ dimension.max }} 分</small></label
              >
              <p>{{ dimension.description }}</p>
            </div>
            <el-input-number
              :id="`score-${index}`"
              v-model="scores[index]"
              :min="0"
              :max="dimension.max"
              :precision="0"
              :disabled="activeTask.status === '已完成'"
              controls-position="right"
              :aria-label="dimension.label"
            />
          </div>
          <el-form-item label="评审意见" required
            ><el-input
              v-model="comment"
              type="textarea"
              :rows="4"
              maxlength="1000"
              show-word-limit
              :disabled="activeTask.status === '已完成'"
              placeholder="请填写不少于 10 字的具体评语，可说明作品亮点与完善建议。" /></el-form-item
        ></el-form>
        <el-alert
          v-if="scoreError"
          :title="scoreError"
          type="error"
          :closable="false"
          show-icon
        /><el-alert
          v-if="activeTask.status === '已完成'"
          title="本任务已完成，评分与评语锁定，作品等待后续评审处理。"
          type="success"
          :closable="false"
          show-icon
        />
      </template>
      <template #footer
        ><div class="score-footer">
          <span>仅为示例评分，不构成正式评审意见</span
          ><el-button
            v-if="activeTask?.status === '待评分'"
            type="primary"
            @click="submit"
            >确认提交评分</el-button
          ><el-button v-else @click="drawer = false">关闭记录</el-button>
        </div></template
      >
    </el-drawer>
    <el-dialog
      v-model="configureOpen"
      title="流程示意配置"
      width="min(620px, 92vw)"
      ><p class="dialog-description">
        配置讨论方案的展示方式。此处不创建、执行或变更真实工作流。
      </p>
      <el-form label-position="top"
        ><el-form-item label="流程节点"
          ><div class="config-stages">
            <div v-for="(stage, index) in reviewFlow.stages" :key="stage.name">
              <span>{{ index + 1 }}. {{ stage.name }}</span
              ><el-switch
                v-model="flowDraft.enabled[index]"
                :aria-label="`${stage.name}开关`"
              />
            </div></div></el-form-item
        ><el-form-item label="建议评审时限（天）"
          ><el-input-number
            v-model="flowDraft.deadlineDays"
            :min="1"
            :max="90"
            :precision="0" /></el-form-item
        ><el-form-item label="在评分界面隐藏作者信息"
          ><el-switch
            v-model="flowDraft.blind"
            aria-label="匿名展示" /></el-form-item></el-form
      ><el-alert
        v-if="configurationError"
        :title="configurationError"
        type="error"
        :closable="false"
      /><template #footer
        ><el-button @click="configureOpen = false">取消</el-button
        ><el-button type="primary" @click="saveConfiguration"
          >保存讨论方案</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>

<style scoped>
.review-overview {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr;
  background: #fff;
  border: 1px solid #e8eae3;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 24px;
}
.review-summary {
  background: #eef2eb;
  padding: 26px 28px;
}
.summary-eyebrow {
  color: #617161;
  font-size: 12px;
}
.summary-number {
  font-size: 40px;
  color: #2e4837;
  line-height: 1.3;
  margin: 10px 0;
  font-weight: 650;
}
.summary-number small {
  font-size: 12px;
  font-weight: 400;
  color: #879384;
  margin-left: 12px;
}
.review-summary p {
  font-size: 11px;
  color: #8a9386;
  margin: 0;
}
.review-metric {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  position: relative;
}
.review-metric + .review-metric:before {
  content: "";
  position: absolute;
  left: 0;
  height: 64px;
  width: 1px;
  background: #ecede7;
}
.review-metric .el-icon {
  font-size: 20px;
  color: #788d76;
}
.review-metric strong {
  font-size: 28px;
  color: #344438;
  font-weight: 600;
}
.review-metric span {
  font-size: 12px;
  color: #8c9289;
}
.review-metric.overdue .el-icon,
.review-metric.overdue strong {
  color: #b07e45;
}
.review-tabs {
  padding: 0 24px 12px;
}
.review-tabs :deep(.el-tabs__header) {
  margin-bottom: 22px;
}
.review-tabs :deep(.el-tabs__item) {
  height: 58px;
}
.review-filters .el-input {
  width: 280px;
}
.review-filters .el-select {
  width: 170px;
}
.cell-secondary {
  font-size: 12px;
  color: #8e978e;
  line-height: 1.7;
  margin-top: 4px;
}
.title-link {
  padding: 0;
  background: none;
  border: 0;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  color: #324334;
  font-size: 14px;
  line-height: 1.6;
}
.title-link:hover {
  color: var(--el-color-primary);
}
.expert-name {
  display: flex;
  gap: 10px;
  align-items: center;
}
.mini-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f2eee3;
  color: #9f865e;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}
.overdue-text {
  color: #b67b43;
}
.flow-heading {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  align-items: center;
  margin: 4px 0 28px;
}
.flow-heading h2 {
  font-size: 17px;
  margin: 0 0 8px;
  color: #334234;
}
.flow-heading p {
  font-size: 12px;
  margin: 0;
  color: #939a8e;
}
.flow-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 24px;
}
.flow-node {
  position: relative;
  border: 1px solid #dfe7dc;
  border-radius: 8px;
  padding: 18px 14px;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 12px;
  background: #fafbf8;
}
.node-number {
  font-size: 22px;
  color: #a7b2a0;
  font-weight: 500;
}
.flow-node strong {
  font-size: 13px;
  color: #475842;
}
.flow-node > span:not(.node-number) {
  font-size: 11px;
  color: #929b8c;
}
.flow-node .el-tag {
  font-size: 10px;
}
.flow-node.disabled {
  opacity: 0.45;
}
.node-arrow {
  position: absolute;
  right: -18px;
  top: 50%;
  font-size: 15px;
  color: #a4b19c;
}
.rule-summary {
  display: flex;
  gap: 40px;
  padding: 16px 20px;
  background: #f6f7f2;
  border-radius: 6px;
  color: #86907f;
  font-size: 12px;
}
.rule-summary b {
  color: #57684f;
  margin-left: 8px;
  font-weight: 500;
}
.rule-title {
  font-size: 15px;
  margin: 30px 0 16px;
  color: #394735;
}
.scoring-rules {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 30px;
  margin-bottom: 30px;
}
.scoring-rules > div {
  display: flex;
  gap: 18px;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #edf0e8;
}
.rule-max {
  font-size: 27px;
  min-width: 65px;
  color: #9d8154;
}
.rule-max small {
  font-size: 12px;
  margin-left: 4px;
}
.scoring-rules h4 {
  margin: 0 0 7px;
  font-size: 13px;
  color: #43513e;
}
.scoring-rules p {
  margin: 0;
  font-size: 12px;
  color: #939a8e;
  line-height: 1.7;
}
.footnote {
  font-size: 12px;
  color: #93998f;
  line-height: 1.8;
  margin: 18px 0;
}
.scoring-heading h2 {
  font-size: 25px;
  color: #334832;
  line-height: 1.4;
}
.scoring-heading p {
  font-size: 12px;
  color: #8d9588;
  line-height: 1.9;
}
.review-manuscript {
  white-space: pre-line;
  line-height: 2;
  font-size: 14px;
  color: #617057;
  padding: 10px 0;
}
.score-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22px 20px;
  background: #f4f6ee;
  border-radius: 8px;
  margin: 24px 0 10px;
}
.score-total span {
  font-size: 13px;
  color: #5d6b53;
}
.score-total p {
  font-size: 11px;
  color: #909b84;
  margin: 8px 0 0;
}
.score-total strong {
  font-size: 35px;
  color: #52694a;
}
.score-total small {
  font-size: 14px;
  font-weight: 400;
  color: #9aa58e;
  margin-left: 6px;
}
.score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid #edf0e6;
}
.score-row label {
  font-size: 14px;
  color: #405434;
}
.score-row label small {
  font-size: 11px;
  color: #929d86;
  margin-left: 6px;
}
.score-row p {
  font-size: 11px;
  color: #929a89;
  margin: 8px 0 0;
  line-height: 1.7;
}
.score-row .el-input-number {
  width: 110px;
  flex-shrink: 0;
}
.score-form .el-form-item {
  margin-top: 24px;
}
.score-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}
.score-footer span {
  color: #91998a;
  font-size: 11px;
}
.dialog-description {
  font-size: 13px;
  color: #8e9688;
  line-height: 1.8;
  margin: 0 0 24px;
}
.config-stages {
  width: 100%;
  border: 1px solid #e8ede1;
  border-radius: 6px;
  padding: 8px 16px;
}
.config-stages > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  font-size: 13px;
  color: #606f55;
}
@media (max-width: 900px) {
  .flow-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .node-arrow {
    display: none;
  }
  .review-overview {
    grid-template-columns: repeat(3, 1fr);
  }
  .review-summary {
    grid-column: 1/-1;
  }
  .review-metric {
    padding: 22px 10px;
  }
  .rule-summary {
    gap: 15px;
    flex-wrap: wrap;
  }
}
@media (max-width: 600px) {
  .review-tabs {
    padding: 0 14px 12px;
  }
  .review-filters .el-input {
    width: 100%;
  }
  .review-filters .el-select {
    width: calc(50% - 8px);
  }
  .review-summary {
    padding: 20px;
  }
  .review-metric span {
    font-size: 10px;
  }
  .review-metric strong {
    font-size: 24px;
  }
  .flow-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .flow-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .scoring-rules {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .score-row {
    align-items: flex-start;
  }
  .score-row label small {
    display: block;
    margin: 7px 0 0;
  }
  .score-row p {
    max-width: 190px;
  }
  .score-footer {
    align-items: flex-start;
    flex-direction: column;
  }
  .score-total {
    padding: 16px;
  }
  .flow-node {
    padding: 14px;
  }
}
</style>
