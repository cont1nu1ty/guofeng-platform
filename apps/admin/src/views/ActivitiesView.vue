<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Plus,
  Search,
  Calendar,
  Location,
  User,
  CircleCheck,
  Tickets,
  ArrowRight,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import { workspace, matchesRegion } from "../domain/workspace";
import {
  editorialState,
  editorialRegions,
  activityTypes,
  saveActivity,
  validateActivity,
  setActivityStatus,
  toggleAttendance,
  type ActivityItem,
  type ActivityDraft,
  type ActivityStatus,
  type Registration,
} from "../domain/editorial";

const query = ref("");
const status = ref("全部活动");
const scoped = computed(() =>
  editorialState.activities.filter((item) => matchesRegion(item.region)),
);
const filtered = computed(() =>
  scoped.value.filter(
    (item) =>
      (status.value === "全部活动" || status.value === item.status) &&
      `${item.title}${item.type}${item.location}`.includes(query.value.trim()),
  ),
);
const registrationCount = computed(() =>
  scoped.value.reduce((sum, item) => sum + item.registrations.length, 0),
);
const attendanceCount = computed(() =>
  scoped.value.reduce(
    (sum, item) =>
      sum + item.registrations.filter((row) => row.checkedIn).length,
    0,
  ),
);
const dialog = ref(false);
const editingId = ref<string>();
const error = ref("");
const draft = reactive<ActivityDraft>({
  title: "",
  type: "家风诵读",
  region: "全国",
  location: "",
  startAt: "",
  endAt: "",
  capacity: 50,
  summary: "",
});
const selected = ref<ActivityItem>();
const detailOpen = ref(false);
const registrationQuery = ref("");
const attendanceFilter = ref("全部名单");
const selectedRegistrations = computed(
  () =>
    selected.value?.registrations.filter(
      (item) =>
        (attendanceFilter.value === "全部名单" ||
          (attendanceFilter.value === "已签到"
            ? item.checkedIn
            : !item.checkedIn)) &&
        `${item.name}${item.institution}`.includes(
          registrationQuery.value.trim(),
        ),
    ) || [],
);

function edit(item?: ActivityItem) {
  editingId.value = item?.id;
  error.value = "";
  Object.assign(
    draft,
    item
      ? {
          title: item.title,
          type: item.type,
          region: item.region,
          location: item.location,
          startAt: item.startAt,
          endAt: item.endAt,
          capacity: item.capacity,
          summary: item.summary,
        }
      : {
          title: "",
          type: "家风诵读",
          region: workspace.region,
          location: "",
          startAt: "",
          endAt: "",
          capacity: 50,
          summary: "",
        },
  );
  dialog.value = true;
}
function save() {
  error.value = validateActivity(
    draft,
    editorialState.activities.find((item) => item.id === editingId.value),
  );
  if (error.value) return;
  saveActivity(draft, editingId.value);
  dialog.value = false;
  ElMessage.success("活动已保存到本次演示会话");
}
function openRegistrations(item: ActivityItem) {
  selected.value = item;
  registrationQuery.value = "";
  attendanceFilter.value = "全部名单";
  detailOpen.value = true;
}
async function transition(item: ActivityItem, next: ActivityStatus) {
  const label =
    next === "报名中"
      ? "发布活动"
      : next === "进行中"
        ? "开始活动"
        : "结束活动";
  try {
    await ElMessageBox.confirm(
      `将“${item.title}”设为“${next}”？仅更新本次演示状态，不会对外发布或发送通知。`,
      `模拟${label}`,
      {
        confirmButtonText: `确认${label.slice(0, 2)}`,
        cancelButtonText: "取消",
        type: next === "已结束" ? "warning" : "info",
      },
    );
    setActivityStatus(item, next);
    ElMessage.success(`活动已设为${next}（当前会话）`);
  } catch (reason) {
    if (reason instanceof Error) ElMessage.error(reason.message);
  }
}
function checkIn(row: Registration) {
  if (!selected.value) return;
  try {
    toggleAttendance(selected.value, row);
    ElMessage.success(row.checkedIn ? "示例签到完成" : "已撤销示例签到");
  } catch (reason) {
    if (reason instanceof Error) ElMessage.error(reason.message);
  }
}
const tagType = (value: ActivityStatus) =>
  value === "进行中"
    ? "success"
    : value === "报名中"
      ? "primary"
      : value === "草稿"
        ? "warning"
        : "info";
const themeClass = (type: string) =>
  type === "主题征文"
    ? "letters"
    : type === "家风诵读"
      ? "reading"
      : type === "文化研学"
        ? "study"
        : "talk";
const dateLabel = (value: string) => value.slice(0, 10).replaceAll("-", ".");
</script>

<template>
  <div class="activities-page">
    <PageHeading
      eyebrow="ACTIVITY OPERATIONS"
      title="活动与传习"
      description="连接一方水土，让家风文化在参与和相遇中生长。"
      ><template #actions
        ><el-button type="primary" :icon="Plus" @click="edit()"
          >创建活动</el-button
        ></template
      ></PageHeading
    >
    <div class="activity-stat-grid">
      <div>
        <span class="stat-symbol"
          ><el-icon><Calendar /></el-icon
        ></span>
        <p>
          活动总数<strong>{{ scoped.length }}<small>场</small></strong>
        </p>
      </div>
      <div>
        <span class="stat-symbol gold"
          ><el-icon><Tickets /></el-icon
        ></span>
        <p>
          开放报名<strong
            >{{ scoped.filter((item) => item.status === "报名中").length
            }}<small>场</small></strong
          >
        </p>
      </div>
      <div>
        <span class="stat-symbol green"
          ><el-icon><User /></el-icon
        ></span>
        <p>
          示例报名<strong>{{ registrationCount }}<small>人次</small></strong>
        </p>
      </div>
      <div>
        <span class="stat-symbol blue"
          ><el-icon><CircleCheck /></el-icon
        ></span>
        <p>
          示例签到<strong>{{ attendanceCount }}<small>人次</small></strong>
        </p>
      </div>
    </div>
    <section class="panel activity-filter-panel">
      <el-tabs v-model="status"
        ><el-tab-pane
          v-for="item in ['全部活动', '报名中', '进行中', '草稿', '已结束']"
          :key="item"
          :name="item"
          :label="item" /></el-tabs
      ><el-input
        v-model="query"
        :prefix-icon="Search"
        placeholder="搜索活动名称、类型或地点"
        clearable
        aria-label="搜索活动"
      />
    </section>
    <div v-if="filtered.length" class="activity-grid">
      <article v-for="item in filtered" :key="item.id" class="activity-card">
        <div class="activity-banner" :class="themeClass(item.type)">
          <div>
            <span>家风中华行 · {{ item.region }}</span
            ><strong>{{ item.type }}</strong
            ><small>让好家风，成为生活的一部分</small>
          </div>
          <span class="banner-character" aria-hidden="true">{{
            item.type === "主题征文"
              ? "书"
              : item.type === "家风诵读"
                ? "诵"
                : item.type === "文化研学"
                  ? "行"
                  : "传"
          }}</span
          ><el-tag :type="tagType(item.status)" effect="light" size="small">{{
            item.status
          }}</el-tag>
        </div>
        <div class="activity-info">
          <h3>{{ item.title }}</h3>
          <p class="activity-summary">{{ item.summary }}</p>
          <div class="activity-detail">
            <el-icon><Calendar /></el-icon
            ><span
              >{{ dateLabel(item.startAt)
              }}{{
                item.startAt.slice(0, 10) === item.endAt.slice(0, 10)
                  ? ` ${item.startAt.slice(11)}–${item.endAt.slice(11)}`
                  : ` — ${dateLabel(item.endAt)}`
              }}</span
            >
          </div>
          <div class="activity-detail">
            <el-icon><Location /></el-icon><span>{{ item.location }}</span>
          </div>
          <div class="registration-progress">
            <div>
              <span>报名进度 <em>示例</em></span
              ><strong
                >{{ item.registrations.length }}
                <small>/ {{ item.capacity }} 人</small></strong
              >
            </div>
            <el-progress
              :percentage="
                Math.min(
                  100,
                  Math.round((item.registrations.length / item.capacity) * 100),
                )
              "
              :show-text="false"
              :stroke-width="5"
              color="#af975f"
            />
          </div>
          <div class="activity-footer">
            <div>
              <el-button link type="primary" @click="edit(item)">编辑</el-button
              ><el-button
                v-if="item.status === '草稿'"
                link
                type="primary"
                @click="transition(item, '报名中')"
                >发布</el-button
              ><el-button
                v-if="item.status === '报名中'"
                link
                type="success"
                @click="transition(item, '进行中')"
                >开始</el-button
              ><el-button
                v-if="item.status === '进行中' || item.status === '报名中'"
                link
                type="warning"
                @click="transition(item, '已结束')"
                >结束</el-button
              >
            </div>
            <el-button link @click="openRegistrations(item)"
              >报名与签到 <el-icon><ArrowRight /></el-icon
            ></el-button>
          </div>
        </div>
      </article>
    </div>
    <section v-else class="panel">
      <el-empty description="没有找到符合条件的活动"
        ><el-button
          @click="
            query = '';
            status = '全部活动';
          "
          >清除筛选</el-button
        ></el-empty
      >
    </section>
    <p class="activity-note">
      活动与报名名单均为虚构样例，操作仅在本次会话有效；不连接真实报名、消息推送或直播服务。
    </p>

    <el-dialog
      v-model="dialog"
      :title="editingId ? '编辑活动' : '创建新活动'"
      width="min(680px, 92vw)"
      :close-on-click-modal="false"
    >
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="form-alert"
      />
      <el-form label-position="top"
        ><el-form-item label="活动名称" required
          ><el-input
            v-model="draft.title"
            maxlength="60"
            show-word-limit
            placeholder="让一个好主题，连接更多参与者"
        /></el-form-item>
        <div class="form-columns">
          <el-form-item label="活动类型" required
            ><el-select v-model="draft.type"
              ><el-option
                v-for="item in activityTypes"
                :key="item"
                :label="item"
                :value="item" /></el-select></el-form-item
          ><el-form-item label="所属地区" required
            ><el-select v-model="draft.region"
              ><el-option
                v-for="item in editorialRegions"
                :key="item"
                :label="item"
                :value="item" /></el-select
          ></el-form-item>
        </div>
        <div class="form-columns">
          <el-form-item label="开始时间" required
            ><el-date-picker
              v-model="draft.startAt"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm"
              format="YYYY-MM-DD HH:mm"
              placeholder="选择开始时间" /></el-form-item
          ><el-form-item label="结束时间" required
            ><el-date-picker
              v-model="draft.endAt"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm"
              format="YYYY-MM-DD HH:mm"
              placeholder="选择结束时间"
          /></el-form-item>
        </div>
        <el-form-item label="活动地点" required
          ><el-input
            v-model="draft.location"
            maxlength="100"
            placeholder="填写示例场地，或线上活动的参与方式" /></el-form-item
        ><el-form-item label="活动名额" required
          ><el-input-number
            v-model="draft.capacity"
            :min="1"
            :max="100000"
            :precision="0"
            controls-position="right"
          /><span class="capacity-unit">人</span></el-form-item
        ><el-form-item label="活动介绍" required
          ><el-input
            v-model="draft.summary"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="10–500 字，介绍活动主题、参与方式及安排" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button type="primary" @click="save">{{
          editingId ? "保存修改" : "保存草稿"
        }}</el-button></template
      >
    </el-dialog>

    <el-drawer v-model="detailOpen" title="报名与签到" size="min(720px, 100vw)">
      <template v-if="selected"
        ><div class="registration-header">
          <el-tag :type="tagType(selected.status)">{{
            selected.status
          }}</el-tag>
          <h2>{{ selected.title }}</h2>
          <p>
            <el-icon><Calendar /></el-icon>{{ selected.startAt }} —
            {{ selected.endAt }}
          </p>
          <p>
            <el-icon><Location /></el-icon>{{ selected.location }}
          </p>
        </div>
        <div class="registration-stats">
          <div>
            <strong>{{ selected.registrations.length }}</strong
            ><span>示例报名</span>
          </div>
          <div>
            <strong>{{
              selected.registrations.filter((item) => item.checkedIn).length
            }}</strong
            ><span>已签到</span>
          </div>
          <div>
            <strong>{{ selected.capacity }}</strong
            ><span>活动名额</span>
          </div>
        </div>
        <el-alert
          :title="
            selected.status === '进行中'
              ? '可操作示例签到或撤销签到，名单仅在当前会话更新。'
              : '活动设为进行中后可操作签到。此处名单均为虚构示例。'
          "
          type="info"
          :closable="false"
          show-icon
        />
        <div class="registration-filter">
          <el-input
            v-model="registrationQuery"
            :prefix-icon="Search"
            placeholder="搜索姓名或机构"
            clearable
            aria-label="搜索报名名单"
          /><el-select v-model="attendanceFilter" aria-label="签到状态"
            ><el-option
              v-for="item in ['全部名单', '已签到', '未签到']"
              :key="item"
              :label="item"
              :value="item"
          /></el-select>
        </div>
        <el-table
          :data="selectedRegistrations"
          row-key="id"
          empty-text="暂无匹配的示例报名记录"
          ><el-table-column
            prop="name"
            label="参与者"
            min-width="130"
          /><el-table-column
            prop="institution"
            label="所属机构"
            min-width="130"
          /><el-table-column label="签到状态" width="95"
            ><template #default="{ row }"
              ><el-tag
                :type="row.checkedIn ? 'success' : 'info'"
                size="small"
                >{{ row.checkedIn ? "已签到" : "未签到" }}</el-tag
              ></template
            ></el-table-column
          ><el-table-column label="操作" width="95"
            ><template #default="{ row }"
              ><el-button
                link
                :disabled="selected?.status !== '进行中'"
                type="primary"
                @click="checkIn(row)"
                >{{ row.checkedIn ? "撤销签到" : "签到" }}</el-button
              ></template
            ></el-table-column
          ></el-table
        >
        <p class="registration-note">
          不采集手机号、身份证或真实个人信息。活动名额与名单用于界面沟通。
        </p></template
      >
      <template #footer
        ><el-button @click="detailOpen = false">关闭</el-button
        ><el-button
          v-if="selected?.status === '报名中'"
          type="primary"
          @click="transition(selected, '进行中')"
          >模拟开始活动</el-button
        ></template
      >
    </el-drawer>
  </div>
</template>

<style scoped>
.activity-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 27px;
}
.activity-stat-grid > div {
  display: flex;
  align-items: center;
  gap: 17px;
  border: 1px solid #e8e4dc;
  background: #fff;
  padding: 22px;
  border-radius: 10px;
}
.stat-symbol {
  width: 45px;
  height: 45px;
  display: grid;
  place-items: center;
  background: #f8efea;
  border-radius: 12px;
  color: #ab6654;
  font-size: 21px;
}
.stat-symbol.gold {
  background: #f9f3e5;
  color: #b79759;
}
.stat-symbol.green {
  background: #eff3eb;
  color: #7b8c65;
}
.stat-symbol.blue {
  background: #edf0f4;
  color: #6f839b;
}
.activity-stat-grid p {
  margin: 0;
  font-size: 11px;
  color: #929788;
}
.activity-stat-grid strong {
  display: block;
  font-size: 26px;
  font-weight: 600;
  color: #3e4c3d;
  margin-top: 7px;
}
.activity-stat-grid strong small {
  font-size: 11px;
  color: #a5aa9b;
  font-weight: 400;
  margin-left: 8px;
}
.activity-filter-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
  margin-bottom: 21px;
  gap: 24px;
}
.activity-filter-panel > .el-input {
  width: 290px;
  flex-shrink: 0;
}
.activity-filter-panel > .el-tabs {
  min-width: 0;
}
.activity-filter-panel :deep(.el-tabs__header) {
  margin: 0;
}
.activity-filter-panel :deep(.el-tabs__nav-wrap:after) {
  display: none;
}
.activity-filter-panel :deep(.el-tabs__item) {
  height: 63px;
  font-size: 13px;
}
.activity-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.activity-card {
  overflow: hidden;
  background: #fff;
  border: 1px solid #e9e4db;
  border-radius: 10px;
}
.activity-banner {
  height: 158px;
  position: relative;
  padding: 25px 26px;
  display: flex;
  align-items: center;
  overflow: hidden;
  background: #ede6d8;
  color: #8a7049;
}
.activity-banner.reading {
  background: #e1e9df;
  color: #5e765c;
}
.activity-banner.study {
  background: #e3e8ed;
  color: #6b7d8b;
}
.activity-banner.talk {
  background: #eee0d9;
  color: #9d7461;
}
.activity-banner:before,
.activity-banner:after {
  content: "";
  position: absolute;
  width: 190px;
  height: 190px;
  border: 1px solid currentColor;
  opacity: 0.13;
  border-radius: 50%;
  right: 5px;
  top: 4px;
}
.activity-banner:after {
  right: -22px;
  top: 25px;
}
.activity-banner > div {
  z-index: 1;
}
.activity-banner > div > span {
  display: block;
  font-size: 9px;
  letter-spacing: 2px;
  opacity: 0.8;
}
.activity-banner strong {
  display: block;
  font-family: "Noto Serif SC", serif;
  font-size: 27px;
  font-weight: 500;
  letter-spacing: 5px;
  margin-top: 10px;
}
.activity-banner small {
  display: block;
  font-size: 9px;
  letter-spacing: 2px;
  margin-top: 9px;
  opacity: 0.7;
}
.banner-character {
  position: absolute;
  right: 25px;
  top: 26px;
  font-size: 87px;
  font-family: serif;
  opacity: 0.14;
  line-height: 1;
}
.activity-banner > .el-tag {
  position: absolute;
  top: 16px;
  right: 18px;
  z-index: 2;
  background: #ffffffe0;
  border-color: transparent;
}
.activity-info {
  padding: 23px 26px 15px;
}
.activity-info h3 {
  font-size: 17px;
  font-weight: 600;
  color: #3c493d;
  margin: 0 0 11px;
}
.activity-summary {
  color: #999c91;
  font-size: 12px;
  line-height: 1.8;
  min-height: 43px;
  margin: 0 0 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.activity-detail {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #929a89;
  font-size: 11px;
  margin-top: 11px;
}
.activity-detail > .el-icon {
  color: #9ea78f;
  font-size: 14px;
  flex-shrink: 0;
}
.registration-progress {
  margin: 23px 0;
}
.registration-progress > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 11px;
  color: #9ca28f;
}
.registration-progress em {
  font-style: normal;
  font-size: 9px;
  background: #f3f4ee;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 4px;
  color: #a6aa9a;
}
.registration-progress strong {
  color: #6a765e;
  font-size: 12px;
  font-weight: 500;
}
.registration-progress small {
  color: #a5aa9c;
  font-size: 10px;
  font-weight: 400;
}
.activity-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid #eeeee6;
}
.activity-footer .el-button {
  font-size: 12px;
}
.activity-footer > .el-button {
  color: #87967e;
}
.activity-footer > .el-button > .el-icon {
  margin-left: 4px;
}
.activity-note {
  font-size: 12px;
  color: #969d8d;
  line-height: 1.8;
  margin-top: 21px;
}
.form-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}
.form-columns :deep(.el-date-editor) {
  width: 100%;
}
.capacity-unit {
  color: #8b937f;
  font-size: 12px;
  margin-left: 12px;
}
.form-alert {
  margin-bottom: 20px;
}
.registration-header {
  padding: 8px 0 12px;
}
.registration-header h2 {
  font-family: serif;
  font-size: 25px;
  color: #41503e;
  font-weight: 500;
  line-height: 1.7;
  margin: 18px 0;
}
.registration-header p {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8c9683;
  font-size: 12px;
  line-height: 1.7;
}
.registration-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  padding: 22px;
  background: #f7f7f1;
  border: 1px solid #eaece0;
  border-radius: 8px;
  margin: 12px 0 25px;
}
.registration-stats > div {
  text-align: center;
}
.registration-stats strong {
  display: block;
  font-size: 25px;
  color: #616f51;
  font-weight: 500;
}
.registration-stats span {
  display: block;
  color: #99a088;
  font-size: 11px;
  margin-top: 8px;
}
.registration-filter {
  display: flex;
  gap: 10px;
  margin: 25px 0 15px;
}
.registration-filter > .el-input {
  flex: 1;
  min-width: 0;
}
.registration-filter > .el-select {
  width: 126px;
}
.registration-note {
  font-size: 11px;
  color: #a3a994;
  line-height: 1.9;
  margin-top: 22px;
}
@media (max-width: 1100px) {
  .activity-stat-grid {
    gap: 13px;
  }
  .activity-stat-grid > div {
    padding: 18px 14px;
    gap: 11px;
  }
  .stat-symbol {
    height: 36px;
    width: 36px;
    font-size: 18px;
  }
  .activity-filter-panel {
    align-items: stretch;
    flex-direction: column;
    gap: 0;
    padding-bottom: 16px;
  }
  .activity-filter-panel > .el-input {
    width: 100%;
  }
}
@media (max-width: 700px) {
  .activity-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .activity-stat-grid > div {
    padding: 17px 14px;
  }
  .activity-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .activity-filter-panel {
    padding: 0 14px 15px;
  }
  .activity-banner {
    height: 150px;
    padding: 23px;
  }
  .activity-info {
    padding: 23px 20px 15px;
  }
  .activity-filter-panel :deep(.el-tabs__item) {
    font-size: 12px;
    padding: 0 14px;
  }
  .form-columns {
    grid-template-columns: 1fr;
  }
  .registration-header h2 {
    font-size: 23px;
  }
  .registration-stats {
    padding: 19px 10px;
  }
}
</style>
