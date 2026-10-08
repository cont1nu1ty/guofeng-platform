<script setup lang="ts">
import { isHttpMode, modeText } from "../services/mode";
import AccountManagement from "../components/accounts/AccountManagement.vue";

import { saveUserRoles, toggleUser, approveUser } from "../services/actions";

import { computed, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Search,
  User,
  UserFilled,
  CircleCheck,
  Clock,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import {
  demoUsers,
  staffRoles,
  regions,
  type DemoUser,
} from "../domain/operations";
import { matchesRegion, workspace } from "../domain/workspace";
const query = ref(""),
  role = ref(""),
  region = ref(""),
  status = ref("");
const scopedUsers = computed(() =>
  demoUsers.filter((item) => matchesRegion(item.region)),
);
const filtered = computed(() =>
  scopedUsers.value.filter(
    (item) =>
      (!query.value ||
        `${item.name}${item.id}${item.organization}`.includes(
          query.value.trim(),
        )) &&
      (!role.value || item.roles.includes(role.value)) &&
      (!region.value || item.region === region.value) &&
      (!status.value ||
        (status.value === "停用"
          ? !item.enabled
          : item.status === status.value && item.enabled)),
  ),
);
const selected = ref<DemoUser | null>(null),
  detailOpen = ref(false),
  roleOpen = ref(false),
  editedRoles = ref<string[]>([]);
function openDetail(user: DemoUser) {
  selected.value = user;
  detailOpen.value = true;
}
function editRoles(user: DemoUser) {
  selected.value = user;
  editedRoles.value = [...user.roles];
  roleOpen.value = true;
}
async function saveRoles() {
  if (!selected.value) return;
  const result = await saveUserRoles(selected.value.id, editedRoles.value);
  if (!result.ok) return ElMessage.warning(result.message);
  ElMessage.success(result.message);
  roleOpen.value = false;
}
async function changeStatus(user: DemoUser) {
  try {
    await ElMessageBox.confirm(
      `${user.enabled ? "停用" : "启用"}“${user.name}”的账号？${modeText("这将改变其登录访问状态。", "仅改变本次演示状态。")}`,
      "确认账号状态",
      {
        confirmButtonText: "确认调整",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    await toggleUser(user.id);
    ElMessage.success("账号状态已更新");
  } catch {
    /* cancelled */
  }
}
async function approve(user: DemoUser) {
  await approveUser(user.id);
  ElMessage.success("入驻状态已更新，不代表实名或资质核验");
}
function reset() {
  query.value = "";
  role.value = "";
  region.value = "";
  status.value = "";
}
const availableRoles = isHttpMode
  ? ["全国管理员", "区域运营", "专家", "投稿用户"]
  : staffRoles;
</script>

<template>
  <AccountManagement v-if="isHttpMode" />
  <template v-else>
  <PageHeading
    title="用户与权限"
    description="连接每一位参与者，让岗位职责与区域范围清晰可见。"
    eyebrow="ORGANIZATION & PEOPLE"
  />
  <div class="stat-grid user-stats">
    <div class="stat-card">
      <span class="stat-icon"
        ><el-icon><User /></el-icon
      ></span>
      <div>
        <span class="muted">当前区域用户</span
        ><strong>{{ scopedUsers.length }}<small>位</small></strong>
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-icon green"
        ><el-icon><CircleCheck /></el-icon
      ></span>
      <div>
        <span class="muted">启用账号</span
        ><strong
          >{{ scopedUsers.filter((u) => u.enabled).length
          }}<small>位</small></strong
        >
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-icon gold"
        ><el-icon><UserFilled /></el-icon
      ></span>
      <div>
        <span class="muted">评审专家</span
        ><strong
          >{{ scopedUsers.filter((u) => u.roles.includes("专家")).length
          }}<small>位</small></strong
        >
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-icon blue"
        ><el-icon><Clock /></el-icon
      ></span>
      <div>
        <span class="muted">入驻待审核</span
        ><strong
          >{{ scopedUsers.filter((u) => u.status === "待审核").length
          }}<small>位</small></strong
        >
      </div>
    </div>
  </div>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2 class="section-title">参与者名册</h2>
        <p class="muted">
          {{ workspace.region }} ·
          {{ modeText("已授权账号范围", "虚构账号，仅用于界面演示") }}
        </p>
      </div>
      <el-tag effect="plain" type="info">岗位与地区分别管理</el-tag>
    </div>
    <div class="filter-bar">
      <el-input
        v-model="query"
        placeholder="搜索姓名、编号或机构"
        clearable
        :prefix-icon="Search"
        aria-label="搜索用户"
      /><el-select
        v-model="role"
        placeholder="全部岗位"
        clearable
        aria-label="筛选岗位"
        ><el-option
          v-for="item in availableRoles"
          :key="item"
          :value="item"
          :label="item" /></el-select
      ><el-select
        v-model="region"
        placeholder="全部地区"
        clearable
        aria-label="筛选地区"
        ><el-option
          v-for="item in regions"
          :key="item"
          :value="item"
          :label="item" /></el-select
      ><el-select
        v-model="status"
        placeholder="全部状态"
        clearable
        aria-label="筛选用户状态"
        ><el-option
          v-for="item in ['已入驻', '待审核', '停用']"
          :key="item"
          :value="item"
          :label="item" /></el-select
      ><el-button @click="reset">重置</el-button>
    </div>
    <el-table :data="filtered" style="width: 100%" row-key="id"
      ><el-table-column label="用户" min-width="180"
        ><template #default="{ row }"
          ><div class="person">
            <span class="avatar">{{ row.avatar }}</span>
            <div>
              <b>{{ row.name }}</b
              ><small>{{ row.id }}</small>
            </div>
          </div></template
        ></el-table-column
      ><el-table-column
        prop="organization"
        label="所属机构"
        min-width="220" /><el-table-column
        prop="region"
        label="地区"
        width="100" /><el-table-column label="岗位" min-width="180"
        ><template #default="{ row }"
          ><div class="tags">
            <el-tag
              v-for="item in row.roles"
              :key="item"
              effect="plain"
              size="small"
              >{{ item }}</el-tag
            >
          </div></template
        ></el-table-column
      ><el-table-column label="状态" width="112"
        ><template #default="{ row }"
          ><el-tag
            :type="
              !row.enabled
                ? 'info'
                : row.status === '待审核'
                  ? 'warning'
                  : 'success'
            "
            size="small"
            >{{ !row.enabled ? "已停用" : row.status }}</el-tag
          ></template
        ></el-table-column
      ><el-table-column label="操作" width="202" fixed="right"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="openDetail(row)"
            >详情</el-button
          ><el-button
            v-has-permi="'users:write'"
            link
            type="primary"
            @click="editRoles(row)"
            >岗位</el-button
          ><el-button
            v-has-permi="'users:write'"
            link
            :type="row.enabled ? 'danger' : 'success'"
            @click="changeStatus(row)"
            >{{ row.enabled ? "停用" : "启用" }}</el-button
          ></template
        ></el-table-column
      ><template #empty
        ><el-empty description="没有符合条件的用户，请调整筛选" /></template
    ></el-table>
    <div class="table-tools">
      <span class="muted">共 {{ filtered.length }} 位用户</span
      ><span class="muted">{{
        modeText("服务端校验账号与地区权限", "地区筛选不代表真实权限隔离")
      }}</span>
    </div>
  </section>
  <div class="permission-note">
    <el-icon><UserFilled /></el-icon>
    <div>
      <b>为后续权限接入保留清晰边界</b>
      <p>
        {{
          modeText(
            "岗位变更将更新服务端授权，权限和地区范围由服务端统一验证。",
            "当前岗位用于展示职责。真实账号认证、数据授权和操作审计由后续服务端实现；在这里调整岗位不会授予实际访问权限。",
          )
        }}
      </p>
    </div>
  </div>
  <el-drawer v-model="detailOpen" title="用户资料" size="min(620px, 100vw)">
    <template v-if="selected"
      ><div class="profile">
        <span class="avatar large">{{ selected.avatar }}</span>
        <h2>{{ selected.name }}</h2>
        <p class="muted">{{ selected.organization }}</p>
      </div>
      <el-descriptions :column="1" border
        ><el-descriptions-item label="用户编号">{{
          selected.id
        }}</el-descriptions-item
        ><el-descriptions-item label="地区范围">{{
          selected.region
        }}</el-descriptions-item
        ><el-descriptions-item label="当前岗位">{{
          selected.roles.join("、")
        }}</el-descriptions-item
        ><el-descriptions-item label="入驻日期">{{
          selected.joined
        }}</el-descriptions-item
        ><el-descriptions-item label="账号状态"
          >{{ selected.enabled ? "启用" : "停用" }} ·
          {{ selected.status }}</el-descriptions-item
        ></el-descriptions
      ><el-alert
        class="detail-alert"
        title="资料记录不等于已核验真实身份或专家资质。"
        type="info"
        :closable="false"
      /><el-button
        v-has-permi="'users:write'"
        v-if="selected.status === '待审核'"
        type="primary"
        @click="approve(selected)"
        >通过入驻审核</el-button
      ><el-button
        v-has-permi="'users:write'"
        v-else
        type="primary"
        @click="editRoles(selected)"
        >调整岗位</el-button
      ></template
    >
  </el-drawer>
  <el-dialog v-model="roleOpen" title="调整岗位" width="min(540px, 92vw)"
    ><template v-if="selected"
      ><p class="muted">
        为 {{ selected.name }} 选择岗位，可同时承担多项职责。
      </p>
      <el-checkbox-group v-model="editedRoles" class="role-options"
        ><el-checkbox
          v-for="item in availableRoles"
          :key="item"
          :value="item"
          border
          >{{ item }}</el-checkbox
        ></el-checkbox-group
      ><el-alert
        :title="
          modeText(
            '保存将改变此账号的实际岗位权限，请核对后操作。',
            '仅修改内存中的演示资料，不构成真实权限授权。',
          )
        "
        :closable="false"
        type="info" /></template
    ><template #footer
      ><el-button @click="roleOpen = false">取消</el-button
      ><el-button v-has-permi="'users:write'" type="primary" @click="saveRoles"
        >保存岗位</el-button
      ></template
    ></el-dialog
  >
  </template>
</template>
<style scoped>
.user-stats .stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
}
.user-stats .muted {
  font-size: 12px;
}
.stat-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: #f8eae7;
  color: #a44136;
  font-size: 21px;
}
.stat-icon.green {
  background: #eaf1ed;
  color: #5b7e6c;
}
.stat-icon.gold {
  background: #f6f0e3;
  color: #ab8b50;
}
.stat-icon.blue {
  background: #ecf0f5;
  color: #617993;
}
.stat-card strong {
  display: block;
  font-size: 28px;
  margin-top: 7px;
  line-height: 1;
}
.stat-card small {
  font-size: 12px;
  font-weight: 400;
  color: #90928f;
  margin-left: 8px;
}
.person {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f3eee5;
  color: #957447;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-weight: 600;
}
.person small {
  display: block;
  color: #959891;
  font-size: 11px;
  margin-top: 3px;
}
.person b {
  font-weight: 500;
}
.tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.permission-note {
  display: flex;
  gap: 14px;
  padding: 20px 24px;
  background: #f1f3ed;
  border: 1px solid #e4e8de;
  border-radius: 10px;
  margin-top: 22px;
  color: #63775e;
}
.permission-note > .el-icon {
  font-size: 22px;
  flex-shrink: 0;
  margin-top: 2px;
}
.permission-note b {
  font-size: 14px;
}
.permission-note p {
  font-size: 13px;
  line-height: 1.8;
  margin: 6px 0 0;
  color: #80877a;
}
.profile {
  text-align: center;
  margin: 8px 0 28px;
}
.large {
  width: 72px;
  height: 72px;
  font-size: 28px;
  margin: auto;
}
.profile h2 {
  font-size: 23px;
  margin: 16px 0 8px;
}
.detail-alert {
  margin: 22px 0;
}
.role-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 24px 0;
}
.role-options .el-checkbox {
  margin: 0;
}
.filter-bar .el-input {
  max-width: 270px;
}
.filter-bar .el-select {
  width: 145px;
}
.table-tools {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
@media (max-width: 600px) {
  .filter-bar .el-input,
  .filter-bar .el-select {
    width: 100%;
    max-width: none;
  }
  .permission-note {
    padding: 17px;
  }
  .user-stats .stat-card {
    gap: 10px;
  }
  .stat-icon {
    width: 35px;
    height: 35px;
    font-size: 18px;
  }
  .stat-card strong {
    font-size: 24px;
  }
  .role-options {
    grid-template-columns: 1fr;
  }
}
</style>
