<script setup lang="ts">
import { useRoute } from "vue-router";
import ReviewAlertsPanel from "../components/ReviewAlertsPanel.vue";
import ReviewWindowDialog from "../components/ReviewWindowDialog.vue";
import ReviewRubricEditor from "../components/ReviewRubricEditor.vue";
import { editableRubrics, validateRubrics } from "../domain/reviewRubrics";
import {
  beijingTime,
  windowLabel,
  scoreUnavailable,
  projectMockReviewTask,
  hasMockTimeWindow,
  mockScoreUnavailable,
} from "../domain/reviewWindow";
import { loadWorkspace } from "../services/workspaceData";
import { isHttpMode, modeText } from "../services/mode";

import { submitReview, configureReviewFlow } from "../services/actions";

import { computed, ref, watch, onUnmounted } from "vue";
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
  type ReviewTask,
} from "../domain/review";

import { can } from "../services/session";
import { connection, ApiError } from "../services/http";
const route = useRoute();
const windowOpen = ref(false);
const tab = ref(route.query.tab === "alerts" ? "alerts" : "tasks"),
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
  rubrics: editableRubrics(reviewFlow.rubrics),
});
const demoNow = ref(Date.now());
const demoClock = isHttpMode
  ? undefined
  : setInterval(() => {
      demoNow.value = Date.now();
    }, 1000);
onUnmounted(() => {
  if (demoClock !== undefined) clearInterval(demoClock);
});
const projectedTasks = computed(() =>
  isHttpMode
    ? reviewState.tasks
    : reviewState.tasks.map((task) =>
        projectMockReviewTask(task, demoNow.value),
      ),
);
const activeTask = computed(() =>
  projectedTasks.value.find((task) => task.id === activeId.value),
);
const activeSubmission = computed(() =>
  reviewState.submissions.find(
    (item) => item.id === activeTask.value?.submissionId,
  ),
);
const canScore = computed(() => activeTask.value?.canScore === true);
const taskDimensions = computed(() => isHttpMode ? activeTask.value?.dimensions ?? [] : scoringDimensions);
const totalScore = computed(() =>
  scores.value.reduce(
    (sum, score) => sum + (Number.isFinite(score) ? score : 0),
    0,
  ),
);
const scoped = computed(() =>
  projectedTasks.value.filter((task) => matchesRegion(task.region)),
);
const enriched = computed(() =>
  scoped.value.map((task) => ({
    ...task,
    submission: isHttpMode ? { title: task.title || task.submissionId } : reviewState.submissions.find(
      (item) => item.id === task.submissionId,
    ),
    expert: isHttpMode ? { name: task.expertName || task.expertId, group: "" } : reviewState.experts.find((item) => item.id === task.expertId),
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
const expertOptions = computed(() => isHttpMode
  ? [...new Map(scoped.value.map(task => [task.expertId, { id: task.expertId, name: task.expertName || task.expertId }])).values()]
  : reviewState.experts);
const rows = computed(() =>
  isHttpMode ? filtered.value : filtered.value.slice(
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
  return task.windowStatus === "overdue";
}
const overdue = computed(() => scoped.value.filter(isOverdue).length);
watch([search, taskStatus, expert, () => workspace.region, limit], () => {
  page.value = 1;
});
function openTask(task: ReviewTask) {
  activeId.value = task.id;
  scores.value = task.scores ? [...task.scores] : (isHttpMode ? task.dimensions ?? [] : scoringDimensions).map(() => 0);
  comment.value = task.comment || "";
  scoreError.value = "";
  drawer.value = true;
}
async function submit() {
  if (!isHttpMode) demoNow.value = Date.now();
  if (!activeTask.value || !canScore.value) return;
  try {
    const result = await submitReview(
      activeTask.value.id,
      scores.value,
      comment.value,
    );
    if (!result.ok) {
      scoreError.value = result.message;
      return;
    }
    scoreError.value = "";
    ElMessage.success(result.message);
  } catch (error) {
    scoreError.value =
      error instanceof Error ? error.message : "评分未提交，请重试。";
    if (
      error instanceof ApiError &&
      [
        "TASK_EXPIRED",
        "TASK_NOT_STARTED",
        "TASK_COMPLETED",
        "VERSION_CONFLICT",
      ].includes(error.code)
    ) {
      try {
        await loadWorkspace();
      } catch {
        /* Keep the score draft and original failure visible. */
      }
    }
  }
}
async function openTaskById(id: string) {
  let task = reviewState.tasks.find((item) => item.id === id);
  if (!task && isHttpMode) {
    await loadWorkspace();
    task = reviewState.tasks.find((item) => item.id === id);
  }
  if (task) openTask(task);
  else ElMessage.warning("任务已不可访问，请刷新列表或联系管理员。");
}
watch(
  () => [route.query.taskId, route.query.tab, reviewState.tasks.length],
  () => {
    if (route.query.tab === "alerts") tab.value = "alerts";
    if (typeof route.query.taskId === "string")
      void openTaskById(route.query.taskId);
  },
  { immediate: true },
);
async function refreshTasks() {
  try {
    await loadWorkspace();
  } catch {
    /* The shared connection banner shows the server error. */
  }
}
function configure() {
  flowDraft.value = {
    blind: isHttpMode ? true : reviewFlow.blind,
    deadlineDays: reviewFlow.deadlineDays,
    enabled: reviewFlow.stages.map((stage) => stage.enabled),
    rubrics: editableRubrics(reviewFlow.rubrics),
  };
  configurationError.value = "";
  configureOpen.value = true;
}
async function saveConfiguration() {
  if (isHttpMode) {
    configurationError.value = validateRubrics(flowDraft.value.rubrics);
    if (configurationError.value) return;
  }
  const result = await configureReviewFlow(flowDraft.value);
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
        ><el-button
          v-if="isHttpMode"
          :loading="connection.loading"
          @click="refreshTasks"
          >刷新任务</el-button
        ><el-button
          :icon="Setting"
          v-if="can('reviews:configure')"
          @click="configure"
          >评审流程配置</el-button
        ></template
      ></PageHeading
    >
    <div class="review-overview">
      <div class="review-summary">
        <span class="summary-eyebrow">评审任务 · {{ workspace.region }}</span>
        <div class="summary-number">
          {{ scoped.length }}<small>项任务</small>
        </div>
        <p>任务进度随本次操作即时更新</p>
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
                value="已完成" /><el-option
                label="已取消"
                value="已取消" /></el-select
            ><el-select
              v-model="expert"
              clearable
              placeholder="全部专家"
              aria-label="评审专家"
              ><el-option
                v-for="item in expertOptions"
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
            <el-table-column label="评审时间（北京时间）" min-width="250"
              ><template #default="{ row }"
                ><div v-if="row.startsAt">
                  开始 {{ beijingTime(row.startsAt) }}
                </div>
                <span :class="{ 'overdue-text': isOverdue(row) }"
                  >截止 {{ beijingTime(row.dueAt) }}</span
                >
                <div v-if="isOverdue(row)" class="cell-secondary overdue-text">
                  已逾期 · 待跟进
                </div></template
              ></el-table-column
            >
            <el-table-column label="状态" width="100"
              ><template #default="{ row }"
                ><el-tag
                  :type="row.status === '已完成' ? 'success' : 'warning'"
                  >{{ windowLabel(row) }}</el-tag
                ></template
              ></el-table-column
            >
            <el-table-column label="操作" fixed="right" width="112"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="openTask(row)">{{
                  row.status === "待评分" && row.canScore
                    ? "进入评分"
                    : "查看任务"
                }}</el-button></template
              ></el-table-column
            >
          </el-table>
          <Pagination
            v-if="!isHttpMode"
            v-model:page="page"
            v-model:limit="limit"
            :total="filtered.length"
          />
        </el-tab-pane>
        <el-tab-pane label="评审预警" name="alerts"
          ><ReviewAlertsPanel v-if="tab === 'alerts'" @open="openTaskById"
        /></el-tab-pane>
        <el-tab-pane label="流程与评分规则" name="flow">
          <div class="flow-heading">
            <div>
              <h2>{{ reviewFlow.name }}</h2>
              <p>{{ modeText('六个可配置节点 · 稿件按提交时的流程与量表版本评审', '原文六级流程 · 最终节点及晋级规则待业务确认') }}</p>
            </div>
            <el-tag type="info" effect="plain">{{ modeText('当前发布版本', '讨论方案') }}</el-tag>
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
                >{{ stage.enabled ? modeText("已启用", "示意启用") : modeText("已关闭", "示意关闭") }}</el-tag
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
            :title="modeText('新稿件版本绑定发布时的配置；已绑定稿件、量表与既有任务不随配置修改。专家评分完成后仍需人工决定和发布结果。', '配置用于界面讨论，不执行流程引擎。评分完成后也不会自动入围、公示或签发证书。')"
            type="info"
            :closable="false"
            show-icon
          />
        </el-tab-pane>
      </el-tabs>
    </section>
    <p class="footnote">
      {{
        modeText(
          "评分和评语由服务端保存并锁定；专家只读取已分配任务的脱敏材料。流程发布新版本后影响后续实例。",
          "新建模拟任务按本机时间窗限制评分，历史仅日期样例保留原体验。延期、预警与自动通知仅真实服务提供；本地评分和配置刷新后恢复示例，未执行服务端鉴权。",
        )
      }}
    </p>

    <el-drawer
      v-model="drawer"
      :title="activeTask?.status === '已完成' ? '评审记录' : '专家评分'"
      size="min(720px, 100vw)"
      destroy-on-close
    >
      <template v-if="activeTask && (isHttpMode || activeSubmission)">
        <div class="scoring-heading">
          <el-tag
            :type="activeTask.status === '已完成' ? 'success' : 'warning'"
            >{{ activeTask.status }}</el-tag
          >
          <h2>{{ isHttpMode ? activeTask.title : activeSubmission?.title }}</h2>
          <p>
            {{
              isHttpMode ? '作者信息已隐藏 · 仅使用脱敏评审材料' : reviewFlow.blind
                ? "作者信息已隐藏 · 匿名展示示例"
                : `${activeSubmission?.author} · ${activeSubmission?.region}`
            }}<br />{{ activeSubmission?.genre }} · {{ activeTask.submissionId
            }}<span v-if="activeTask.ruleVersion">
              · 量表 {{ activeTask.ruleVersion }}</span
            >
          </p>
        </div>
        <el-alert
          v-if="!isHttpMode && !hasMockTimeWindow(activeTask)"
          title="历史日期样例：日期仅供展示，不作为评分时间限制。新分配的完整时间窗口按本机时钟校验；延期和自动提醒需真实服务。"
          type="info"
          :closable="false"
        />
        <div class="review-window-summary">
          <p>开始：{{ beijingTime(activeTask.startsAt) }}</p>
          <p>截止：{{ beijingTime(activeTask.dueAt) }}</p>
          <p>
            时间状态：{{ windowLabel(activeTask)
            }}<span v-if="activeTask.windowVersion">
              · 时间版本 {{ activeTask.windowVersion }}</span
            >
          </p>
          <el-button
            v-if="
              isHttpMode &&
              can('reviews:manage') &&
              activeTask.status === '待评分'
            "
            @click="windowOpen = true"
            >调整评审时间</el-button
          >
        </div>
        <el-alert
          v-if="!canScore"
          :title="
            isHttpMode
              ? scoreUnavailable(activeTask)
              : mockScoreUnavailable(activeTask)
          "
          type="info"
          :closable="false"
          show-icon
        />
        <el-collapse
          ><el-collapse-item title="展开阅读作品内容" name="content"
            ><div class="review-manuscript">
              {{
                isHttpMode
                  ? activeTask.content
                  : activeSubmission?.content
              }}
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
            v-for="(dimension, index) in taskDimensions"
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
              :disabled="activeTask.status !== '待评分' || !canScore"
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
              :disabled="activeTask.status !== '待评分' || !canScore"
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
          <span>{{
            modeText(
              "评分保存后锁定，结果由管理员另行确认",
              "仅为示例评分，不构成正式评审意见",
            )
          }}</span
          ><el-button
            v-has-permi="'reviews:score'"
            v-if="activeTask?.status === '待评分' && canScore"
            type="primary"
            @click="submit"
            >确认提交评分</el-button
          ><el-button v-else @click="drawer = false">关闭记录</el-button>
        </div></template
      >
    </el-drawer>
    <ReviewWindowDialog v-model="windowOpen" :task="activeTask" />
    <el-dialog
      v-model="configureOpen"
      title="评审流程配置"
      width="min(620px, 92vw)"
      ><p class="dialog-description">
        {{
          modeText(
            "保存后发布新的流程和节点量表版本，仅绑定后续新提交的稿件版本。",
            "配置讨论方案的展示方式，不执行真实工作流。",
          )
        }}
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
            :disabled="isHttpMode"
            aria-label="匿名展示"
          />
          <span v-if="isHttpMode" class="muted">本期采用匿名评审</span>
        </el-form-item>
        <ReviewRubricEditor v-if="isHttpMode" :rubrics="flowDraft.rubrics" :stages="reviewFlow.stages" />
        </el-form
      ><el-alert
        v-if="configurationError"
        :title="configurationError"
        type="error"
        :closable="false"
      /><template #footer
        ><el-button @click="configureOpen = false">取消</el-button
        ><el-button
          v-has-permi="'reviews:configure'"
          type="primary"
          @click="saveConfiguration"
          >{{ modeText("发布流程配置", "保存讨论方案") }}</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>

<style scoped>
.review-window-summary {
  margin: 18px 0;
  padding: 16px;
  background: #f6f7f3;
  line-height: 1.7;
}
.review-window-summary p {
  margin: 0 0 6px;
  overflow-wrap: anywhere;
}
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
