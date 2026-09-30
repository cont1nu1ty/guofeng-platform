<script setup lang="ts">
import {
  beijingInput,
  beijingTime,
  windowInstant,
  windowError,
} from "../domain/reviewWindow";
import { reviewFlow } from "../domain/review";
import { isHttpMode, modeText } from "../services/mode";

import { updateExpert, assignReview } from "../services/actions";

import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  Search,
  User,
  Collection,
  CircleCheck,
  EditPen,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import Pagination from "../components/upstream/Pagination.vue";
import { workspace, matchesRegion } from "../domain/workspace";
import { reviewState, expertGroups, type Expert } from "../domain/review";
import { hasBlockingReviewTask } from "../domain/assignment";

const immediateStart = ref(true),
  defaultDueAt = ref("");
const search = ref(""),
  group = ref(""),
  availability = ref(""),
  page = ref(1),
  limit = ref(10);
const activeId = ref(""),
  drawer = ref(false),
  editOpen = ref(false),
  assignmentOpen = ref(false);
const draftGroup = ref(""),
  draftAvailability = ref<Expert["availability"]>("可分配"),
  editError = ref("");
const submissionId = ref(""),
  startsAt = ref(""),
  dueAt = ref(""),
  assignmentError = ref("");
const assignmentOpenedAt = ref(Date.now());
const active = computed(() =>
  reviewState.experts.find((item) => item.id === activeId.value),
);
const assignmentDays = computed(
  () =>
    reviewState.submissions.find((item) => item.id === submissionId.value)
      ?.flowSnapshot?.deadlineDays ?? reviewFlow.deadlineDays,
);
watch([startsAt, immediateStart, assignmentDays], () => {
  if (dueAt.value !== defaultDueAt.value) return;
  const start = immediateStart.value
    ? Date.now()
    : Date.parse(windowInstant(startsAt.value));
  if (Number.isFinite(start)) {
    dueAt.value = beijingInput(
      new Date(start + assignmentDays.value * 86400000).toISOString(),
    );
    defaultDueAt.value = dueAt.value;
  }
});
const scoped = computed(() =>
  reviewState.experts.filter((item) => matchesRegion(item.region)),
);
const filtered = computed(() =>
  scoped.value.filter(
    (item) =>
      (!search.value ||
        `${item.name}${item.organization}${item.specialties.join("")}`.includes(
          search.value.trim(),
        )) &&
      (!group.value || item.group === group.value) &&
      (!availability.value || item.availability === availability.value),
  ),
);
const rows = computed(() =>
  filtered.value.slice(
    (page.value - 1) * limit.value,
    page.value * limit.value,
  ),
);
const tasksFor = (id: string) =>
  reviewState.tasks.filter((task) => task.expertId === id);
const activeTasks = computed(() => tasksFor(activeId.value));
const availableSubmissions = computed(() =>
  reviewState.submissions.filter(
    (item) =>
      item.status === "评审中" &&
      matchesRegion(item.region) &&
      !hasBlockingReviewTask(
        reviewState.tasks,
        item.id,
        activeId.value,
        isHttpMode,
        assignmentOpenedAt.value,
      ),
  ),
);
const colors = ["#eaf0e8", "#f4ecdf", "#e9edf3", "#f2e9e7", "#e9eeee"];
watch([search, group, availability, () => workspace.region, limit], () => {
  page.value = 1;
});
function openDetail(expert: Expert) {
  activeId.value = expert.id;
  drawer.value = true;
}
function edit(expert: Expert) {
  activeId.value = expert.id;
  draftGroup.value = expert.group;
  draftAvailability.value = expert.availability;
  editError.value = "";
  editOpen.value = true;
}
async function save() {
  if (!active.value) return;
  const result = await updateExpert(
    active.value.id,
    draftGroup.value,
    draftAvailability.value,
  );
  if (!result.ok) {
    editError.value = result.message;
    return;
  }
  ElMessage.success(result.message);
  editOpen.value = false;
}
function openAssignment(expert: Expert) {
  assignmentOpenedAt.value = Date.now();
  activeId.value = expert.id;
  submissionId.value = "";
  immediateStart.value = true;
  startsAt.value = beijingInput(new Date(Date.now() + 5 * 60000).toISOString());
  dueAt.value = beijingInput(
    new Date(Date.now() + assignmentDays.value * 86400000).toISOString(),
  );
  defaultDueAt.value = dueAt.value;
  assignmentError.value = "";
  assignmentOpen.value = true;
}
async function assign() {
  const start = immediateStart.value
    ? beijingInput(new Date().toISOString())
    : startsAt.value;
  assignmentError.value = windowError(start, dueAt.value);
  if (
    !assignmentError.value &&
    !immediateStart.value &&
    Date.parse(windowInstant(start)) <= Date.now()
  )
    assignmentError.value = "开始时间不能早于当前时间。";
  if (assignmentError.value) return;
  const result = await assignReview(
    submissionId.value,
    activeId.value,
    dueAt.value === defaultDueAt.value ? "" : windowInstant(dueAt.value),
    immediateStart.value ? undefined : windowInstant(startsAt.value),
  );
  if (!result.ok) {
    assignmentError.value = result.message;
    return;
  }
  ElMessage.success(result.message);
  assignmentOpen.value = false;
}
</script>

<template>
  <div class="experts-view">
    <PageHeading
      title="专家库"
      description="连接专业力量，为家风作品建立可信、清晰的评审协作。"
      eyebrow="评审中心 / 专家库"
      ><template #actions
        ><el-tag type="info" effect="plain"
          >{{ workspace.region }} · 专家档案</el-tag
        ></template
      ></PageHeading
    >
    <div class="expert-summary-grid">
      <div class="expert-summary">
        <span class="summary-icon"
          ><el-icon><User /></el-icon
        ></span>
        <div>
          <span>专家总数</span>
          <p>{{ scoped.length }}<small>位</small></p>
        </div>
      </div>
      <div class="expert-summary">
        <span class="summary-icon gold"
          ><el-icon><Collection /></el-icon
        ></span>
        <div>
          <span>专业分组</span>
          <p>
            {{ new Set(scoped.map((item) => item.group)).size
            }}<small>组</small>
          </p>
        </div>
      </div>
      <div class="expert-summary">
        <span class="summary-icon sage"
          ><el-icon><CircleCheck /></el-icon
        ></span>
        <div>
          <span>当前可分配</span>
          <p>
            {{ scoped.filter((item) => item.availability === "可分配").length
            }}<small>位</small>
          </p>
        </div>
      </div>
    </div>
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2 class="section-title">专家档案</h2>
          <p class="muted">按专业匹配作品，结合当前任务量安排评审</p>
        </div>
        <el-tag type="info" size="small">{{ filtered.length }} 位专家</el-tag>
      </div>
      <div class="filter-bar expert-filters">
        <el-input
          v-model="search"
          :prefix-icon="Search"
          clearable
          placeholder="搜索专家、机构或擅长领域"
          aria-label="搜索专家"
        /><el-select
          v-model="group"
          clearable
          placeholder="全部专业组"
          aria-label="专家分组"
          ><el-option
            v-for="item in expertGroups"
            :key="item"
            :label="item"
            :value="item" /></el-select
        ><el-select
          v-model="availability"
          clearable
          placeholder="全部接单状态"
          aria-label="专家接单状态"
          ><el-option label="可分配" value="可分配" /><el-option
            label="暂不接单"
            value="暂不接单" /></el-select
        ><el-button
          @click="
            search = '';
            group = '';
            availability = '';
          "
          >重置</el-button
        >
      </div>
      <el-table
        :data="rows"
        empty-text="没有匹配的专家，试试调整地区、专业组或关键词。"
      >
        <el-table-column label="专家" min-width="220"
          ><template #default="{ row, $index }"
            ><div class="expert-identity">
              <span
                class="expert-avatar"
                :style="{ background: colors[$index % colors.length] }"
                >{{ row.name.slice(0, 1) }}</span
              >
              <div>
                <button class="expert-link" @click="openDetail(row)">
                  {{ row.name }}
                </button>
                <div class="cell-secondary">
                  {{ row.title }} · {{ row.region }}
                </div>
              </div>
            </div></template
          ></el-table-column
        >
        <el-table-column label="专业组 / 擅长领域" min-width="235"
          ><template #default="{ row }"
            ><span>{{ row.group }}</span>
            <div class="specialty-list">
              <span v-for="specialty in row.specialties" :key="specialty">{{
                specialty
              }}</span>
            </div></template
          ></el-table-column
        >
        <el-table-column label="任务负荷" min-width="150"
          ><template #default="{ row }"
            ><div class="workload">
              <span
                ><b>{{
                  tasksFor(row.id).filter((task) => task.status === "待评分")
                    .length
                }}</b>
                待评</span
              ><i></i
              ><span
                ><b>{{
                  tasksFor(row.id).filter((task) => task.status === "已完成")
                    .length
                }}</b>
                已评</span
              >
            </div></template
          ></el-table-column
        >
        <el-table-column label="接单状态" width="112"
          ><template #default="{ row }"
            ><el-tag
              :type="row.availability === '可分配' ? 'success' : 'info'"
              effect="light"
              >{{ row.availability }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column label="操作" fixed="right" width="160"
          ><template #default="{ row }"
            ><el-button
              v-has-permi="'experts:write'"
              type="primary"
              link
              @click="edit(row)"
              >编辑</el-button
            ><el-button
              v-has-permi="'experts:write'"
              type="primary"
              link
              :disabled="row.availability !== '可分配'"
              @click="openAssignment(row)"
              >分配任务</el-button
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
    <div class="expert-guidance">
      <el-icon><Collection /></el-icon>
      <div>
        <h3>专家资料与分组先行，真实审核与授权后续接入</h3>
        <p>
          {{
            modeText(
              "编辑将更新专家分组与接单状态；暂停接单不会撤销已有任务。开发专家档案不代表正式身份认证。",
              "当前专家及机构均为虚构示例。编辑仅调整本次会话的分组和接单状态，不处理真实入驻审核；暂停接单不会撤销已有任务。",
            )
          }}
        </p>
      </div>
    </div>

    <el-drawer
      v-model="drawer"
      title="专家档案"
      size="min(720px, 100vw)"
      destroy-on-close
    >
      <template v-if="active"
        ><div class="profile-heading">
          <span class="profile-avatar">{{ active.name.slice(0, 1) }}</span>
          <div>
            <h2>
              {{ active.name
              }}<el-tag
                :type="active.availability === '可分配' ? 'success' : 'info'"
                >{{ active.availability }}</el-tag
              >
            </h2>
            <p>{{ active.title }} · {{ active.region }}</p>
            <p>{{ active.organization }}</p>
          </div>
        </div>
        <div class="profile-tags">
          <el-tag effect="plain">{{ active.group }}</el-tag
          ><el-tag
            v-for="specialty in active.specialties"
            :key="specialty"
            type="info"
            effect="plain"
            >{{ specialty }}</el-tag
          >
        </div>
        <h3 class="profile-section-title">专家简介</h3>
        <p class="biography">{{ active.biography }}</p>
        <h3 class="profile-section-title">
          分配任务 <span>{{ activeTasks.length }}</span>
        </h3>
        <div v-for="task in activeTasks" :key="task.id" class="profile-task">
          <div>
            <b>{{
              reviewState.submissions.find(
                (item) => item.id === task.submissionId,
              )?.title
            }}</b>
            <p>{{ task.stage }} · 截止 {{ beijingTime(task.dueAt) }}</p>
          </div>
          <el-tag :type="task.status === '已完成' ? 'success' : 'warning'">{{
            task.status
          }}</el-tag>
        </div>
        <el-empty
          v-if="!activeTasks.length"
          description="还没有分配任务"
          :image-size="90"
        />
        <el-alert
          class="profile-alert"
          :title="
            modeText(
              '专家资料不代表已完成实名核验或正式聘任。',
              '专家档案为演示信息，不代表真实身份认证、正式聘任或授权。',
            )
          "
          type="info"
          :closable="false"
          show-icon
        /> </template
      ><template #footer
        ><div v-if="active">
          <el-button
            v-has-permi="'experts:write'"
            :icon="EditPen"
            @click="edit(active)"
            >编辑档案</el-button
          ><el-button
            v-has-permi="'experts:write'"
            type="primary"
            :disabled="active.availability !== '可分配'"
            @click="openAssignment(active)"
            >分配任务</el-button
          >
        </div></template
      >
    </el-drawer>
    <el-dialog v-model="editOpen" title="编辑专家档案" width="min(620px, 92vw)"
      ><p class="dialog-description">
        {{ active?.name }} · {{ active?.title }}<br /><span>{{
          modeText(
            "分组与接单状态保存至服务端。",
            "本次仅演示分组与接单状态，修改后刷新恢复。",
          )
        }}</span>
      </p>
      <el-form label-position="top"
        ><el-form-item label="专业分组" required
          ><el-select v-model="draftGroup" style="width: 100%"
            ><el-option
              v-for="item in expertGroups"
              :key="item"
              :label="item"
              :value="item" /></el-select></el-form-item
        ><el-form-item label="接单状态" required
          ><el-radio-group v-model="draftAvailability"
            ><el-radio value="可分配">可分配新任务</el-radio
            ><el-radio value="暂不接单">暂不接单</el-radio></el-radio-group
          ></el-form-item
        ></el-form
      ><el-alert
        v-if="editError"
        :title="editError"
        type="error"
        :closable="false"
      /><template #footer
        ><el-button @click="editOpen = false">取消</el-button
        ><el-button v-has-permi="'experts:write'" type="primary" @click="save"
          >保存修改</el-button
        ></template
      ></el-dialog
    >
    <el-dialog
      v-model="assignmentOpen"
      title="分配评审任务"
      width="min(620px, 92vw)"
      ><p class="dialog-description">
        为 {{ active?.name }} 分配稿件<br /><span>{{
          modeText(
            "仅显示当前地区评审中且没有有效待评分任务的作品；已完成、取消或到期后可重新分配。",
            "仅显示当前地区已通过初审、尚未分配给此专家的作品。",
          )
        }}</span>
      </p>
      <el-form label-position="top"
        ><el-form-item label="评审稿件" required
          ><el-select
            v-model="submissionId"
            filterable
            style="width: 100%"
            placeholder="请选择稿件"
            no-data-text="当前范围没有可分配稿件"
            ><el-option
              v-for="item in availableSubmissions"
              :key="item.id"
              :label="`${item.title} · ${item.region}`"
              :value="item.id" /></el-select></el-form-item
        ><el-form-item label="开始时间（北京时间）" required
          ><el-checkbox v-model="immediateStart"
            >立即开始（以保存时的服务器时间为准）</el-checkbox
          >
          <el-date-picker
            v-if="!immediateStart"
            v-model="startsAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择未来的开始时间"
            style="width: 100%" /></el-form-item
        ><el-form-item label="截止时间（北京时间）" required
          ><el-date-picker
            v-model="dueAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择截止时间"
            style="width: 100%"
        /></el-form-item>
        <p class="muted">
          未修改截止时间时，默认从开始起计
          {{ assignmentDays }}
          天。{{
            modeText(
              "开始前不可评分；截止后需管理员延期才能继续。",
              "本地模拟按本机时间限制评分；延期与自动提醒需真实服务。",
            )
          }}
        </p></el-form
      ><el-alert
        v-if="assignmentError"
        :title="assignmentError"
        type="error"
        :closable="false"
      /><template #footer
        ><el-button @click="assignmentOpen = false">取消</el-button
        ><el-button
          v-has-permi="'experts:write'"
          type="primary"
          :disabled="!availableSubmissions.length"
          @click="assign"
          >确认分配</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>

<style scoped>
.expert-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}
.expert-summary {
  display: flex;
  align-items: center;
  gap: 20px;
  border: 1px solid #e7eae1;
  border-radius: 9px;
  background: #fff;
  padding: 24px;
}
.summary-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  width: 52px;
  height: 52px;
  background: #eaf0e7;
  color: #6e8666;
  font-size: 23px;
  flex-shrink: 0;
}
.summary-icon.gold {
  background: #f7f0e2;
  color: #b18e4b;
}
.summary-icon.sage {
  background: #edf1ee;
  color: #6c8878;
}
.expert-summary > div > span {
  font-size: 12px;
  color: #8b9584;
}
.expert-summary p {
  margin: 10px 0 0;
  font-size: 29px;
  color: #3e5035;
  font-weight: 600;
  line-height: 1;
}
.expert-summary small {
  font-weight: 400;
  font-size: 11px;
  margin-left: 10px;
  color: #a0a892;
}
.expert-filters .el-input {
  width: 300px;
}
.expert-filters .el-select {
  width: 170px;
}
.expert-identity {
  display: flex;
  align-items: center;
  gap: 14px;
}
.expert-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  color: #63715b;
  flex-shrink: 0;
  font-size: 17px;
  font-family: serif;
}
.expert-link {
  border: 0;
  background: none;
  padding: 0;
  font-size: 14px;
  font-weight: 600;
  color: #3d5034;
  cursor: pointer;
}
.expert-link:hover {
  color: var(--el-color-primary);
}
.cell-secondary {
  font-size: 12px;
  color: #909985;
  line-height: 1.8;
  margin-top: 5px;
}
.specialty-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
}
.specialty-list span {
  background: #f4f5ef;
  color: #8a947e;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 3px;
}
.workload {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #a1a994;
  font-size: 11px;
}
.workload b {
  font-size: 16px;
  color: #77876a;
  font-weight: 500;
}
.workload i {
  height: 16px;
  width: 1px;
  background: #e7ecdf;
}
.expert-guidance {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 24px;
  margin-top: 22px;
  border: 1px dashed #d7dfcf;
  border-radius: 8px;
  background: #f6f8f1;
}
.expert-guidance > .el-icon {
  font-size: 22px;
  color: #8c9b7c;
  margin-top: 2px;
  flex-shrink: 0;
}
.expert-guidance h3 {
  font-size: 13px;
  color: #6d7c5e;
  font-weight: 500;
  margin: 0 0 10px;
}
.expert-guidance p {
  font-size: 12px;
  color: #9ba58d;
  margin: 0;
  line-height: 1.9;
}
.profile-heading {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 6px 0 22px;
}
.profile-avatar {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: #edf2e5;
  color: #7b9067;
  font-size: 29px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: serif;
}
.profile-heading h2 {
  font-size: 25px;
  margin: 0 0 10px;
  color: #3c5130;
  display: flex;
  gap: 14px;
  align-items: center;
}
.profile-heading p {
  margin: 5px 0;
  color: #969f8a;
  font-size: 12px;
  line-height: 1.7;
}
.profile-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.profile-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #5a6c49;
  margin: 30px 0 16px;
}
.profile-section-title span {
  font-size: 12px;
  font-weight: 400;
  color: #9fac8c;
  margin-left: 8px;
}
.biography {
  line-height: 2;
  color: #87977a;
  font-size: 14px;
  background: #f8faf3;
  padding: 18px;
  border-radius: 6px;
}
.profile-task {
  padding: 20px 0;
  border-bottom: 1px solid #edf0e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.profile-task b {
  font-size: 14px;
  font-weight: 500;
  color: #607450;
}
.profile-task p {
  font-size: 11px;
  color: #9aa78c;
  margin: 9px 0 0;
}
.profile-alert {
  margin-top: 24px;
}
.dialog-description {
  font-size: 14px;
  color: #677957;
  line-height: 1.9;
  margin: 0 0 22px;
}
.dialog-description span {
  font-size: 12px;
  color: #9aa78e;
}
@media (max-width: 800px) {
  .expert-summary {
    padding: 20px 16px;
    gap: 12px;
  }
  .summary-icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
  .expert-summary-grid {
    gap: 12px;
  }
}
@media (max-width: 600px) {
  .expert-summary-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .expert-summary {
    padding: 16px 20px;
  }
  .expert-summary > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 1;
  }
  .expert-summary p {
    margin: 0;
  }
  .expert-summary .summary-icon {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }
  .expert-filters .el-input {
    width: 100%;
  }
  .expert-filters .el-select {
    width: calc(50% - 8px);
  }
  .expert-guidance {
    padding: 18px 16px;
    gap: 12px;
  }
  .profile-heading {
    gap: 14px;
  }
  .profile-avatar {
    width: 55px;
    height: 55px;
    font-size: 25px;
  }
  .profile-heading h2 {
    font-size: 22px;
    gap: 10px;
  }
}
</style>
