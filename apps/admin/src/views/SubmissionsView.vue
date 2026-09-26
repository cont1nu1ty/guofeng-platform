<script setup lang="ts">
import { isHttpMode, modeText } from "../services/mode";

import {
  approveSubmission,
  batchApproveSubmissions,
  returnSubmission,
  assignReview,
} from "../services/actions";

import { computed, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Search,
  Document,
  CircleCheck,
  RefreshLeft,
  User,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import Pagination from "../components/upstream/Pagination.vue";
import RightToolbar from "../components/upstream/RightToolbar.vue";
import { workspace, matchesRegion } from "../domain/workspace";
import {
  reviewState,
  submissionStatuses,
  type Submission,
  type SubmissionStatus,
} from "../domain/review";

const search = ref(""),
  status = ref(""),
  region = ref(""),
  source = ref("");
const showSearch = ref(true);
const page = ref(1),
  limit = ref(10),
  selected = ref<Submission[]>([]);
const tableRef = ref<{ clearSelection: () => void }>();
const activeId = ref(""),
  drawer = ref(false),
  returnOpen = ref(false),
  assignmentOpen = ref(false);
const reason = ref(""),
  expertId = ref(""),
  dueAt = ref("");
const returnError = ref(""),
  assignmentError = ref("");
const active = computed(() =>
  reviewState.submissions.find((item) => item.id === activeId.value),
);
const scoped = computed(() =>
  reviewState.submissions.filter((item) => matchesRegion(item.region)),
);
const filtered = computed(() =>
  scoped.value.filter(
    (item) =>
      (!search.value ||
        `${item.id}${item.title}${item.author}`.includes(
          search.value.trim(),
        )) &&
      (!status.value || item.status === status.value) &&
      (!region.value || item.region === region.value) &&
      (!source.value || item.source === source.value),
  ),
);
const rows = computed(() =>
  filtered.value.slice(
    (page.value - 1) * limit.value,
    page.value * limit.value,
  ),
);
const availableExperts = computed(() =>
  reviewState.experts.filter((item) => item.availability === "可分配"),
);
const activeTasks = computed(() =>
  reviewState.tasks.filter((task) => task.submissionId === activeId.value),
);
const stats = computed(() => [
  {
    label: "全部稿件",
    count: scoped.value.length,
    note: "当前范围 · 作品",
    icon: Document,
    color: "ink",
  },
  {
    label: "待初审",
    count: scoped.value.filter((item) => item.status === "待初审").length,
    note: "需要核对资料与内容",
    icon: CircleCheck,
    color: "gold",
  },
  {
    label: "评审中",
    count: scoped.value.filter((item) => item.status === "评审中").length,
    note: "分配专家并跟进进度",
    icon: User,
    color: "red",
  },
  {
    label: "退回修改",
    count: scoped.value.filter((item) => item.status === "退回修改").length,
    note: "等待投稿人补充完善",
    icon: RefreshLeft,
    color: "gray",
  },
]);
function tagType(value: SubmissionStatus) {
  return (
    {
      待初审: "warning",
      评审中: "primary",
      退回修改: "danger",
      已入围: "success",
      已获奖: "success",
      已入藏: "success",
      未入围: "info",
    } as const
  )[value];
}
watch([search, status, region, source, () => workspace.region, limit], () => {
  page.value = 1;
  selected.value = [];
  tableRef.value?.clearSelection();
});
watch(
  () => filtered.value.length,
  () => {
    page.value = Math.min(
      page.value,
      Math.max(1, Math.ceil(filtered.value.length / limit.value)),
    );
  },
);
function reset() {
  search.value = "";
  status.value = "";
  region.value = "";
  source.value = "";
}
function openDetail(row: Submission) {
  activeId.value = row.id;
  drawer.value = true;
}
async function approve() {
  if (!active.value) return;
  const result = await approveSubmission(active.value.id);
  result.ok
    ? ElMessage.success(result.message)
    : ElMessage.error(result.message);
}
async function batchApprove() {
  try {
    await ElMessageBox.confirm(
      `将所选 ${selected.value.length} 篇稿件通过初审并转入评审中，随后仍需分配专家。${modeText("操作将保存至服务端。", "此操作仅影响本次演示。")}`,
      "批量通过初审",
      {
        confirmButtonText: "通过初审",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    const result = await batchApproveSubmissions(
      selected.value.map((item) => item.id),
    );
    result.ok
      ? ElMessage.success(result.message)
      : ElMessage.error(result.message);
    if (result.ok) {
      selected.value = [];
      tableRef.value?.clearSelection();
    }
  } catch {
    /* dialog dismissed */
  }
}
function openReturn() {
  reason.value = "";
  returnError.value = "";
  returnOpen.value = true;
}
async function confirmReturn() {
  if (!active.value) return;
  const result = await returnSubmission(active.value.id, reason.value);
  if (!result.ok) {
    returnError.value = result.message;
    return;
  }
  ElMessage.success(result.message);
  returnOpen.value = false;
}
function openAssignment(row: Submission) {
  activeId.value = row.id;
  expertId.value = "";
  dueAt.value = "";
  assignmentError.value = "";
  assignmentOpen.value = true;
}
async function confirmAssignment() {
  if (!active.value) return;
  const result = await assignReview(
    active.value.id,
    expertId.value,
    dueAt.value,
  );
  if (!result.ok) {
    assignmentError.value = result.message;
    return;
  }
  ElMessage.success(result.message);
  assignmentOpen.value = false;
}
import { command } from "../services/workspaceData";
import { downloadFile } from "../services/files";
const materialOpen = ref(false),
  materialContent = ref(""),
  materialConfirmed = ref(false);
const decisionOpen = ref(false),
  decision = ref("shortlisted"),
  decisionNote = ref("");
function prepareMaterial() {
  if (!active.value) return;
  materialContent.value = active.value.blindContent || active.value.content;
  materialConfirmed.value = false;
  materialOpen.value = true;
}
async function saveMaterial() {
  if (
    !active.value ||
    !materialConfirmed.value ||
    materialContent.value.trim().length < 10
  )
    return ElMessage.warning("请填写脱敏正文并确认已人工核对");
  await command(
    "prepareBlindMaterial",
    { content: materialContent.value, confirmed: true },
    active.value.id,
  );
  materialOpen.value = false;
  ElMessage.success("脱敏材料已保存");
}
async function decide() {
  if (!active.value) return;
  await command(
    "decideSubmission",
    { result: decision.value, note: decisionNote.value },
    active.value.id,
  );
  decisionOpen.value = false;
  ElMessage.success("评审结果已确认");
}
async function publishResult() {
  if (!active.value) return;
  await ElMessageBox.confirm(
    active.value.published
      ? "撤回该作品的公开发布？"
      : "确认将该作品及结果公开发布？请先核对授权与个人信息。",
    "发布确认",
    { type: "warning" },
  );
  await command(
    "publishSubmission",
    { published: !active.value.published },
    active.value.id,
  );
  ElMessage.success("发布状态已更新");
}
</script>

<template>
  <div class="submissions-view">
    <PageHeading
      title="投稿作品"
      description="从作品归集到初审、分配，让每一份家风记忆得到认真对待。"
      eyebrow="内容管理 / 投稿作品"
    >
      <template #actions
        ><el-tag effect="plain" type="info"
          >{{ workspace.region }} · 工作空间</el-tag
        ></template
      >
    </PageHeading>
    <div class="stat-grid submission-stats">
      <div v-for="stat in stats" :key="stat.label" class="stat-card">
        <div class="stat-top">
          <span>{{ stat.label }}</span
          ><el-icon :class="['stat-icon', stat.color]"
            ><component :is="stat.icon"
          /></el-icon>
        </div>
        <strong>{{ stat.count.toString().padStart(2, "0") }}</strong
        ><small>{{ stat.note }}</small>
      </div>
    </div>
    <section class="panel manuscript-panel">
      <div class="panel-header">
        <div>
          <h2 class="section-title">作品库</h2>
          <p class="muted">
            {{
              modeText(
                "筛选、初审与专家分配 · 服务端持久保存",
                "筛选、初审与专家分配 · 刷新后恢复示例",
              )
            }}
          </p>
        </div>
        <RightToolbar v-model:show-search="showSearch" @query-table="reset" />
      </div>
      <div v-show="showSearch" class="filter-bar submission-filters">
        <el-input
          v-model="search"
          placeholder="搜索作品标题、编号或作者"
          :prefix-icon="Search"
          clearable
          aria-label="搜索稿件"
          class="search-input"
        />
        <el-select
          v-model="status"
          placeholder="全部状态"
          clearable
          aria-label="稿件状态"
          ><el-option
            v-for="value in submissionStatuses"
            :key="value"
            :label="value"
            :value="value"
        /></el-select>
        <el-select
          v-model="region"
          placeholder="全部地区"
          clearable
          aria-label="稿件地区"
          ><el-option
            v-for="value in ['北京市', '浙江省', '四川省', '江苏省', '广东省']"
            :key="value"
            :label="value"
            :value="value"
        /></el-select>
        <el-select
          v-model="source"
          placeholder="全部来源"
          clearable
          aria-label="稿件来源"
          ><el-option label="小程序投稿" value="小程序投稿" /><el-option
            label="线下归集"
            value="线下归集"
        /></el-select>
        <el-button @click="reset">重置</el-button>
      </div>
      <div class="table-tools">
        <div class="selection-note">
          已选 <b>{{ selected.length }}</b> 篇
          <span class="muted">· 仅待初审稿件可批量处理</span>
        </div>
        <el-button
          v-has-permi="'submissions:write'"
          :disabled="selected.length === 0"
          :icon="CircleCheck"
          size="small"
          @click="batchApprove"
          >批量通过初审</el-button
        >
      </div>
      <el-table
        ref="tableRef"
        :data="rows"
        row-key="id"
        @selection-change="selected = $event"
        empty-text="没有匹配的稿件，请调整关键词或筛选条件。"
      >
        <el-table-column
          type="selection"
          width="44"
          :selectable="(row: Submission) => row.status === '待初审'"
        />
        <el-table-column label="作品 / 编号" min-width="260"
          ><template #default="{ row }"
            ><button class="title-link" @click="openDetail(row)">
              {{ row.title }}
            </button>
            <div class="cell-secondary">
              {{ row.id }} <span class="version">V{{ row.version }}</span>
            </div></template
          ></el-table-column
        >
        <el-table-column label="作者 / 地区" min-width="130"
          ><template #default="{ row }"
            ><span>{{ row.author }}</span>
            <div class="cell-secondary">{{ row.region }}</div></template
          ></el-table-column
        >
        <el-table-column label="体裁 / 主题" min-width="150"
          ><template #default="{ row }"
            ><span>{{ row.genre }}</span>
            <div class="cell-secondary">{{ row.theme }}</div></template
          ></el-table-column
        >
        <el-table-column label="状态" width="112"
          ><template #default="{ row }"
            ><el-tag :type="tagType(row.status)" effect="light">{{
              row.status
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="投稿时间" min-width="146"
          ><template #default="{ row }"
            ><span>{{ row.submittedAt.slice(0, 10) }}</span>
            <div class="cell-secondary">{{ row.source }}</div></template
          ></el-table-column
        >
        <el-table-column label="操作" width="144" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openDetail(row)">{{
              row.status === "待初审" ? "初审" : "详情"
            }}</el-button
            ><el-button
              v-has-permi="'submissions:write'"
              v-if="row.status === '评审中'"
              link
              type="primary"
              @click="openAssignment(row)"
              >分配</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <Pagination
        v-model:page="page"
        v-model:limit="limit"
        :total="filtered.length"
      />
    </section>
    <p class="footnote">
      {{
        modeText(
          "初审通过仅转入评审，不会自动入围或公开发布。",
          "作品、作者、附件及统计均为虚构样例。初审通过仅转入评审，不会自动入围或公开发布。",
        )
      }}
    </p>

    <el-drawer
      v-model="drawer"
      title="稿件详情"
      size="min(720px, 100vw)"
      destroy-on-close
    >
      <template v-if="active">
        <div class="detail-heading">
          <el-tag :type="tagType(active.status)">{{ active.status }}</el-tag
          ><span class="muted">{{ active.id }} · V{{ active.version }}</span>
          <h2>{{ active.title }}</h2>
          <p>
            {{ active.author }} <span>·</span> {{ active.region }}
            <span>·</span> {{ active.genre }}
          </p>
        </div>
        <el-alert
          v-if="isHttpMode"
          :title="`脱敏材料：${active.blindConfirmed ? '已确认' : '待准备'} · 评审结果：${active.result || '待决定'} · ${active.published ? '已公开发布' : '未公开'}`"
          type="info"
          :closable="false"
        />
        <div
          v-if="isHttpMode"
          class="real-review-actions"
          v-has-permi="'submissions:write'"
        >
          <el-button @click="prepareMaterial">准备脱敏材料</el-button
          ><el-button @click="decisionOpen = true">确认评审结果</el-button
          ><el-button
            v-has-permi="'submissions:write'"
            @click="publishResult"
            >{{ active.published ? "撤回发布" : "发布作品" }}</el-button
          >
        </div>
        <el-tabs>
          <el-tab-pane label="作品内容">
            <el-descriptions :column="2" border size="small"
              ><el-descriptions-item label="投稿通道">{{
                active.channel
              }}</el-descriptions-item
              ><el-descriptions-item label="主题">{{
                active.theme
              }}</el-descriptions-item
              ><el-descriptions-item label="来源">{{
                active.source
              }}</el-descriptions-item
              ><el-descriptions-item label="投稿时间">{{
                active.submittedAt
              }}</el-descriptions-item></el-descriptions
            >
            <div class="manuscript-content">{{ active.content }}</div>
            <div class="attachment-box">
              <h3>附件与版权记录</h3>
              <p v-for="file in active.files || []" :key="file.fileId">
                <el-button
                  link
                  type="primary"
                  @click="downloadFile(file.fileId)"
                  >{{ file.name }}</el-button
                >
              </p>
              <p
                v-for="file in !isHttpMode ? active.attachments : []"
                :key="file"
              >
                <el-icon><Document /></el-icon> {{ file }}
                <el-tag size="small" type="info">仅元信息</el-tag>
              </p>
              <p v-if="!active.attachments.length" class="muted">
                此稿件没有示例附件。
              </p>
              <p class="muted">
                {{
                  modeText(
                    "协议确认记录仅代表投稿须知确认；未接入正式签署或查重服务。",
                    "版权勾选：已确认演示须知；尚未接入正式签署或查重服务。",
                  )
                }}
              </p>
            </div>
          </el-tab-pane>
          <el-tab-pane label="流转记录"
            ><el-timeline class="submission-timeline"
              ><el-timeline-item
                v-for="(event, index) in [...active.history].reverse()"
                :key="index"
                :timestamp="event.time"
                :type="index === 0 ? 'primary' : 'info'"
                placement="top"
                ><h4>{{ event.title }}</h4>
                <p>{{ event.detail }}</p></el-timeline-item
              ></el-timeline
            ></el-tab-pane
          >
          <el-tab-pane :label="`评审任务 (${activeTasks.length})`"
            ><div v-for="task in activeTasks" :key="task.id" class="task-entry">
              <div>
                <b>{{
                  reviewState.experts.find(
                    (expert) => expert.id === task.expertId,
                  )?.name
                }}</b
                ><span class="muted"
                  >{{ task.stage }} · 截止 {{ task.dueAt }}</span
                >
              </div>
              <el-tag
                :type="task.status === '已完成' ? 'success' : 'warning'"
                >{{ task.status }}</el-tag
              >
            </div>
            <el-empty
              v-if="!activeTasks.length"
              description="尚未分配专家任务"
              :image-size="90"
          /></el-tab-pane>
        </el-tabs>
      </template>
      <template #footer
        ><div v-if="active" class="drawer-actions">
          <span class="muted">{{
            modeText("操作由服务端验证并保存", "操作仅在本次会话生效")
          }}</span>
          <div>
            <el-button
              v-has-permi="'submissions:write'"
              v-if="active.status === '待初审'"
              @click="openReturn"
              >退回修改</el-button
            ><el-button
              v-has-permi="'submissions:write'"
              v-if="active.status === '待初审'"
              type="primary"
              @click="approve"
              >通过初审</el-button
            ><el-button
              v-has-permi="'submissions:write'"
              v-if="active.status === '评审中'"
              type="primary"
              @click="openAssignment(active)"
              >分配评审专家</el-button
            ><el-button
              v-if="!['待初审', '评审中'].includes(active.status)"
              @click="drawer = false"
              >关闭详情</el-button
            >
          </div>
        </div></template
      >
    </el-drawer>
    <el-dialog v-model="returnOpen" title="退回修改" width="min(620px, 92vw)"
      ><p class="dialog-description">
        为《{{ active?.title }}》填写具体修改要求，帮助投稿人完善作品。
      </p>
      <el-form label-position="top"
        ><el-form-item label="退回理由" required :error="returnError"
          ><el-input
            v-model="reason"
            type="textarea"
            :rows="5"
            maxlength="500"
            show-word-limit
            placeholder="例如：请补充文中引用家训的出处，并核对附件与正文版本。至少 5 字。" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="returnOpen = false">取消</el-button
        ><el-button
          v-has-permi="'submissions:write'"
          type="primary"
          @click="confirmReturn"
          >确认退回</el-button
        ></template
      ></el-dialog
    >
    <el-dialog
      v-model="assignmentOpen"
      title="分配评审专家"
      width="min(620px, 92vw)"
      ><p class="dialog-description">
        {{ active?.title }}<br /><span class="muted">{{
          modeText(
            "可分配专家以服务端返回的授权范围为准。",
            "专家范围为全部专家档案；地区筛选不构成真实权限隔离。",
          )
        }}</span>
      </p>
      <el-form label-position="top"
        ><el-form-item label="评审专家" required
          ><el-select
            v-model="expertId"
            placeholder="选择可接单的专家"
            filterable
            style="width: 100%"
            ><el-option
              v-for="expert in availableExperts"
              :key="expert.id"
              :value="expert.id"
              :label="`${expert.name} · ${expert.group}`" /></el-select></el-form-item
        ><el-form-item label="截止日期" required
          ><el-date-picker
            v-model="dueAt"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="请选择日期"
            style="width: 100%" /></el-form-item></el-form
      ><el-alert
        v-if="assignmentError"
        :title="assignmentError"
        type="error"
        :closable="false"
      /><template #footer
        ><el-button @click="assignmentOpen = false">取消</el-button
        ><el-button
          v-has-permi="'submissions:write'"
          type="primary"
          @click="confirmAssignment"
          >分配任务</el-button
        ></template
      ></el-dialog
    >
    <el-dialog
      v-model="materialOpen"
      title="准备匿名评审材料"
      width="min(700px,94vw)"
      ><el-alert
        title="请人工删除正文中的作者、联系方式及可识别身份的信息。原附件不直接提供给盲审专家。"
        :closable="false"
        type="warning"
      /><el-input
        v-model="materialContent"
        type="textarea"
        :rows="14"
        maxlength="20000"
        show-word-limit
      /><el-checkbox v-model="materialConfirmed"
        >已人工核对并确认可用于匿名评审</el-checkbox
      ><template #footer
        ><el-button @click="materialOpen = false">取消</el-button
        ><el-button
          v-has-permi="'submissions:write'"
          type="primary"
          @click="saveMaterial"
          >保存脱敏材料</el-button
        ></template
      ></el-dialog
    >
    <el-dialog
      v-model="decisionOpen"
      title="确认评审结果"
      width="min(520px,94vw)"
      ><el-form label-position="top"
        ><el-form-item label="结果" required
          ><el-select v-model="decision"
            ><el-option label="入围" value="shortlisted" /><el-option
              label="未入围"
              value="rejected" /><el-option
              label="获奖"
              value="awarded" /><el-option
              label="典藏"
              value="collected" /></el-select></el-form-item
        ><el-form-item label="决定说明" required
          ><el-input
            v-model="decisionNote"
            type="textarea"
            :rows="4"
            maxlength="1000" /></el-form-item></el-form
      ><el-alert
        title="确认结果不会自动公开发布，发布需另行操作。"
        :closable="false"
      /><template #footer
        ><el-button @click="decisionOpen = false">取消</el-button
        ><el-button
          v-has-permi="'submissions:write'"
          type="primary"
          @click="decide"
          >确认结果</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>

<style scoped>
.real-review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
}
.real-review-actions .el-button {
  margin-left: 0;
}

.submission-stats {
  margin-bottom: 24px;
}
.stat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #6e716f;
  font-size: 13px;
}
.stat-icon {
  font-size: 20px;
}
.stat-icon.gold {
  color: #ac8540;
}
.stat-icon.red {
  color: #9d3835;
}
.stat-icon.ink {
  color: #496366;
}
.stat-icon.gray {
  color: #8a8c88;
}
.stat-card strong {
  display: block;
  font-size: 32px;
  line-height: 1.3;
  margin: 14px 0 8px;
  letter-spacing: -1px;
  font-weight: 650;
  color: #28372f;
}
.stat-card small {
  color: #8a8e87;
  font-size: 12px;
}
.library-count {
  background: #f3f4ef;
  color: #637060;
  padding: 6px 12px;
  border-radius: 5px;
  font-size: 12px;
  white-space: nowrap;
}
.submission-filters {
  gap: 12px;
}
.submission-filters .el-select {
  width: 140px;
}
.submission-filters .search-input {
  width: 280px;
}
.selection-note {
  font-size: 12px;
  color: #667269;
}
.selection-note b {
  color: var(--el-color-primary);
}
.title-link {
  background: none;
  border: none;
  padding: 0;
  color: #2b3a31;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  line-height: 1.6;
}
.title-link:hover {
  color: var(--el-color-primary);
}
.cell-secondary {
  font-size: 12px;
  color: #89928c;
  line-height: 1.7;
  margin-top: 4px;
}
.version {
  font-size: 10px;
  background: #f1f3ef;
  padding: 2px 4px;
  border-radius: 3px;
  margin-left: 4px;
}
.footnote {
  font-size: 12px;
  color: #8b918b;
  margin: 18px 0;
  line-height: 1.8;
}
.detail-heading {
  margin-bottom: 20px;
}
.detail-heading > .muted {
  margin-left: 10px;
  font-size: 12px;
}
.detail-heading h2 {
  font-size: 26px;
  margin: 20px 0 10px;
  color: #28392f;
}
.detail-heading p {
  color: #7a847b;
  font-size: 13px;
}
.detail-heading p span {
  margin: 0 10px;
}
.manuscript-content {
  white-space: pre-line;
  line-height: 2.1;
  font-size: 15px;
  padding: 25px 5px;
  color: #48574c;
}
.attachment-box {
  background: #f7f8f4;
  border: 1px solid #e9ede4;
  border-radius: 8px;
  padding: 18px;
  font-size: 13px;
}
.attachment-box h3 {
  font-size: 14px;
  margin: 0 0 12px;
}
.attachment-box p {
  line-height: 1.8;
}
.submission-timeline {
  padding: 20px 10px;
}
.submission-timeline h4 {
  margin: 0 0 8px;
  font-size: 14px;
}
.submission-timeline p {
  font-size: 13px;
  line-height: 1.8;
  margin: 0;
  color: #7a847b;
}
.task-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #edf0e9;
  padding: 20px 0;
}
.task-entry .muted {
  display: block;
  font-size: 12px;
  margin-top: 8px;
}
.drawer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.drawer-actions > .muted {
  font-size: 12px;
}
.dialog-description {
  font-size: 14px;
  color: #667368;
  line-height: 1.8;
  margin: 0 0 22px;
}
.dialog-description .muted {
  font-size: 12px;
}
@media (max-width: 600px) {
  .submission-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .submission-filters .search-input {
    width: 100%;
  }
  .submission-filters .el-select {
    width: calc(50% - 6px);
  }
  .table-tools {
    align-items: flex-start;
    gap: 10px;
    flex-wrap: wrap;
  }
  .selection-note .muted {
    display: none;
  }
  .drawer-actions {
    align-items: flex-start;
    flex-direction: column;
  }
  .detail-heading h2 {
    font-size: 22px;
  }
  .detail-heading > .muted {
    display: block;
    margin: 10px 0 0;
  }
  .stat-card strong {
    font-size: 28px;
  }
  .stat-card small {
    font-size: 11px;
  }
  .manuscript-content {
    padding: 20px 0;
  }
}
</style>
