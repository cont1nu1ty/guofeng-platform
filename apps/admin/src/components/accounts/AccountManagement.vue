<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search, Plus, Refresh } from "@element-plus/icons-vue";
import PageHeading from "../PageHeading.vue";
import Pagination from "../upstream/Pagination.vue";
import { accountFieldErrors, accountReviewLabels, emptyAccountFields,
  type AccountAction, type AccountFilters, type ManagedAccount } from "../../domain/accounts";
import { regionCatalog } from "../../domain/regions";
import { accountDetail, listAccounts, prepareAccountChange } from "../../services/accounts";
import { can, session } from "../../services/session";

const filters = reactive<AccountFilters>({ query: "", role: "", region: "", status: "", page: 1, pageSize: 20 });
const items = ref<ManagedAccount[]>([]), total = ref(0), roles = ref<{ key: string; label: string }[]>([]);
const loading = ref(false), saving = ref(false), error = ref(""), errorPanel = ref<HTMLElement>();
const detailLoading = ref(false), detailOpen = ref(false), selected = ref<ManagedAccount | null>(null);
const editorOpen = ref(false), action = ref<AccountAction>("create"), editorError = ref("");
const editorErrorPanel = ref<HTMLElement>(), fieldErrors = ref<Record<string, string>>({});
const fields = reactive(emptyAccountFields());
let sequence = 0, detailSequence = 0;
let prepared: { signature: string; run: ReturnType<typeof prepareAccountChange> } | undefined;
const allowedRegions = computed(() => session.user?.roles.includes("national_admin")
  ? regionCatalog : regionCatalog.filter(item => session.user?.regionIds.includes(item.id)));
const ownAccount = (account: ManagedAccount) => account.id === session.user?.id;
const title = computed(() => ({ create: "新建账号", roles: "岗位与地区授权", status: "账号状态",
  resetPassword: "重置账号密码", materials: "登记审核资料", review: "记录人工审核结论" })[action.value]);
const reviewReady = computed(() => selected.value?.reviews?.find(entry => entry.subject === fields.subject)?.action === "submitted");
function readableDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : value;
}
async function refresh() {
  const request = ++sequence;
  loading.value = true; error.value = "";
  try {
    const result = await listAccounts({ ...filters });
    if (request !== sequence) return;
    items.value = result.items; total.value = result.total; roles.value = result.roles;
    session.permissions = result.permissions;
  } catch (cause) {
    if (request !== sequence) return;
    items.value = []; total.value = 0;
    error.value = cause instanceof Error ? cause.message : "账号列表未能加载";
    await nextTick(); errorPanel.value?.focus();
  } finally { if (request === sequence) loading.value = false; }
}
function search() { filters.page = 1; void refresh(); }
function resetFilters() { Object.assign(filters, { query: "", role: "", region: "", status: "", page: 1 }); void refresh(); }
async function openDetail(account: ManagedAccount) {
  const request = ++detailSequence;
  detailOpen.value = true; detailLoading.value = true; selected.value = null; error.value = "";
  try { const result = await accountDetail(account.id); if (request === detailSequence) selected.value = result; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "账号详情未能加载"; detailOpen.value = false; }
  finally { if (request === detailSequence) detailLoading.value = false; }
}
function openEditor(nextAction: AccountAction, account?: ManagedAccount) {
  action.value = nextAction; selected.value = account || null;
  Object.assign(fields, emptyAccountFields(), account ? { roles: [...account.roles], regionIds: account.regionIds.filter(id => id !== "all") }
    : { regionIds: allowedRegions.value.length === 1 ? [allowedRegions.value[0]!.id] : [] });
  fieldErrors.value = {}; editorError.value = ""; prepared = undefined; editorOpen.value = true;
}
function clearSecret() { fields.password = ""; prepared = undefined; }
async function submit() {
  if (saving.value) return;
  fieldErrors.value = accountFieldErrors(action.value, fields);
  if (Object.keys(fieldErrors.value).length) {
    editorError.value = "请检查以下信息后再次保存。";
    await nextTick(); editorErrorPanel.value?.focus(); return;
  }
  const id = selected.value?.id || "";
  const data: Record<string, unknown> = action.value === "create" ? {
    username: fields.username.trim(), name: fields.name.trim(), organization: fields.organization.trim(), password: fields.password,
    roles: fields.roles, regionIds: fields.regionIds,
  } : { version: selected.value?.version };
  if (action.value === "roles") Object.assign(data, { roles: fields.roles, regionIds: fields.regionIds });
  if (action.value === "resetPassword") data.password = fields.password;
  if (action.value === "materials" || action.value === "review") Object.assign(data, {
    subject: fields.subject, summary: fields.summary.trim(), materialReference: fields.materialReference.trim(), result: fields.result,
  });
  const signature = JSON.stringify([action.value, id, data]);
  if (!prepared || prepared.signature !== signature) prepared = { signature, run: prepareAccountChange(action.value, id, data) };
  saving.value = true; editorError.value = "";
  try {
    const result = await prepared.run();
    ElMessage.success(result.message); editorOpen.value = false; clearSecret();
    await refresh();
    if (detailOpen.value && id) await openDetail({ id } as ManagedAccount);
  } catch (cause) {
    editorError.value = cause instanceof Error ? cause.message : "保存失败，请重试";
    await nextTick(); editorErrorPanel.value?.focus();
  } finally { saving.value = false; }
}
async function toggle(account: ManagedAccount) {
  if (saving.value) return;
  try {
    await ElMessageBox.confirm(`${account.enabled ? "停用" : "启用"}“${account.name}”的账号？保存后该账号旧会话会失效。`,
      "确认账号状态", { confirmButtonText: "确认调整", cancelButtonText: "取消", type: "warning" });
  } catch { return; }
  saving.value = true; error.value = "";
  try {
    await prepareAccountChange("status", account.id, { version: account.version, enabled: !account.enabled })();
    ElMessage.success("账号状态已更新"); await refresh();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "账号状态未能保存"; }
  finally { saving.value = false; }
}
onMounted(refresh);
</script>

<template>
  <PageHeading title="用户与权限" description="按岗位分配操作权限，按地区划定业务范围，保留人工审核记录。" eyebrow="ORGANIZATION & PEOPLE">
    <template #actions>
      <el-button :icon="Refresh" :loading="loading" @click="refresh">刷新</el-button>
      <el-button v-if="can('users:create')" type="primary" :icon="Plus" @click="openEditor('create')">新建账号</el-button>
    </template>
  </PageHeading>
  <div v-if="error" ref="errorPanel" class="account-error" tabindex="-1" role="alert">
    <el-alert :title="error" type="error" :closable="false" show-icon />
  </div>
  <section class="panel">
    <div class="panel-header">
      <div><h2 class="section-title">参与者名册</h2><p class="muted">共 {{ total }} 个符合条件的账号 · 当前页 {{ items.length }} 个</p></div>
      <el-tag effect="plain" type="info">服务端分页与授权筛选</el-tag>
    </div>
    <div class="filter-bar">
      <el-input v-model="filters.query" :prefix-icon="Search" placeholder="姓名、账号或机构" aria-label="搜索账号" clearable @keyup.enter="search" />
      <el-select v-model="filters.role" aria-label="岗位筛选" placeholder="全部岗位" clearable @change="search">
        <el-option v-for="item in roles" :key="item.key" :label="item.label" :value="item.key" />
      </el-select>
      <el-select v-model="filters.region" aria-label="地区筛选" placeholder="全部授权地区" clearable @change="search">
        <el-option v-for="item in allowedRegions" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-select v-model="filters.status" aria-label="账号状态筛选" placeholder="全部状态" clearable @change="search">
        <el-option label="启用账号" value="enabled" /><el-option label="停用账号" value="disabled" />
        <el-option label="待人工审核" value="pending" /><el-option label="人工通过" value="approved" />
        <el-option label="需补充" value="returned" /><el-option label="未通过" value="rejected" />
      </el-select>
      <el-button type="primary" :loading="loading" @click="search">查询</el-button><el-button @click="resetFilters">重置</el-button>
    </div>
    <el-table v-loading="loading" :data="items" row-key="id" empty-text="没有符合条件的账号">
      <el-table-column label="用户" min-width="160"><template #default="{ row }"><strong>{{ row.name }}</strong><div class="muted">{{ row.username }}</div></template></el-table-column>
      <el-table-column prop="organization" label="所属机构" min-width="180" />
      <el-table-column label="授权地区" min-width="150"><template #default="{ row }">{{ row.regionLabels.join('、') }}</template></el-table-column>
      <el-table-column label="岗位" min-width="170"><template #default="{ row }"><div class="account-tags"><el-tag v-for="label in row.roleLabels" :key="label" effect="plain" size="small">{{ label }}</el-tag></div></template></el-table-column>
      <el-table-column label="状态" min-width="140"><template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '停用' }}</el-tag><div class="muted">{{ accountReviewLabels[row.accountReviewStatus as keyof typeof accountReviewLabels] }}</div></template></el-table-column>
      <el-table-column label="操作" width="215" fixed="right"><template #default="{ row }">
        <el-button link type="primary" @click="openDetail(row)">详情</el-button>
        <el-button v-if="can('users:roles')" link type="primary" :disabled="ownAccount(row) || saving" @click="openEditor('roles', row)">授权</el-button>
        <el-button v-if="can('users:status')" link :type="row.enabled ? 'danger' : 'success'" :disabled="ownAccount(row) || saving" @click="toggle(row)">{{ row.enabled ? '停用' : '启用' }}</el-button>
      </template></el-table-column>
    </el-table>
    <Pagination v-model:page="filters.page" v-model:limit="filters.pageSize" :total="total" @pagination="refresh" />
  </section>
  <el-alert class="account-note" title="资料审核是平台人员对所登记材料的审核记录，不代表已通过外部实名或专家资质认证。通过审核不会自动授予专家岗位。" type="info" :closable="false" show-icon />

  <el-drawer v-model="detailOpen" title="账号资料与审核记录" size="min(720px, 100vw)">
    <div v-loading="detailLoading" class="account-detail">
      <template v-if="selected">
        <h2>{{ selected.name }}</h2><p class="muted">{{ selected.username }} · {{ selected.organization }}</p>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="授权地区">{{ selected.regionLabels.join('、') }}</el-descriptions-item>
          <el-descriptions-item label="岗位">{{ selected.roleLabels.join('、') }}</el-descriptions-item>
          <el-descriptions-item label="账号资料">{{ accountReviewLabels[selected.accountReviewStatus] }}</el-descriptions-item>
          <el-descriptions-item label="专家资料">{{ accountReviewLabels[selected.expertReviewStatus] }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ readableDate(selected.createdAt) }}</el-descriptions-item>
        </el-descriptions>
        <p v-if="selected.legacyStatus && selected.legacyStatus !== '待审核' && !selected.reviews?.length" class="muted">历史状态：{{ selected.legacyStatus }}。旧状态未附本轮人工审核材料，不自动认定为资质通过。</p>
        <div class="account-actions">
          <el-button v-if="can('users:review')" :disabled="ownAccount(selected)" @click="openEditor('materials', selected)">登记资料</el-button>
          <el-button v-if="can('users:review')" type="primary" :disabled="ownAccount(selected) || !selected.reviews?.some(r => r.action === 'submitted')" @click="openEditor('review', selected)">人工审核</el-button>
          <el-button v-if="can('users:resetPassword')" :disabled="ownAccount(selected)" @click="openEditor('resetPassword', selected)">重置密码</el-button>
        </div>
        <h3 class="section-title">审核历史</h3>
        <el-timeline v-if="selected.reviews?.length" class="account-history">
          <el-timeline-item v-for="entry in selected.reviews" :key="entry.id" :timestamp="readableDate(entry.createdAt)">
            <strong>{{ entry.subject === 'expert' ? '专家资料' : '账号资料' }} · {{ accountReviewLabels[entry.action] }}</strong>
            <p>{{ entry.summary }}</p><p class="muted">资料来源：{{ entry.materialReference }}</p><p class="muted">办理人：{{ entry.actorName }}</p>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else :description="can('users:review') ? '尚无人工审核记录' : '当前岗位没有审核材料查看权限'" />
      </template>
    </div>
  </el-drawer>

  <el-dialog v-model="editorOpen" :title="title" width="min(640px, 94vw)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" @closed="clearSecret">
    <div v-if="editorError" ref="editorErrorPanel" class="account-error" tabindex="-1" role="alert">
      <el-alert :title="editorError" type="error" :closable="false" show-icon />
      <ul v-if="Object.keys(fieldErrors).length"><li v-for="(message, key) in fieldErrors" :key="key"><a :href="`#account-${key}`">{{ message }}</a></li></ul>
    </div>
    <el-form label-position="top" :disabled="saving" @submit.prevent="submit">
      <template v-if="action === 'create'">
        <el-form-item label="登录账号" required :error="fieldErrors.username"><el-input id="account-username" v-model="fields.username" maxlength="30" autocomplete="off" /></el-form-item>
        <div class="account-form-grid">
          <el-form-item label="姓名" required :error="fieldErrors.name"><el-input id="account-name" v-model="fields.name" maxlength="30" /></el-form-item>
          <el-form-item label="所属机构" required :error="fieldErrors.organization"><el-input id="account-organization" v-model="fields.organization" maxlength="120" /></el-form-item>
        </div>
      </template>
      <template v-if="action === 'create' || action === 'roles'">
        <el-form-item label="岗位" required :error="fieldErrors.roles">
          <el-select id="account-roles" v-model="fields.roles" multiple aria-label="账号岗位">
            <el-option v-for="item in roles" :key="item.key" :label="item.label" :value="item.key"
              :disabled="item.key === 'expert' && !selected?.roles.includes('expert') && selected?.expertReviewStatus !== 'approved'" />
          </el-select>
        </el-form-item>
        <p v-if="action === 'create'" class="muted">新专家先按投稿用户创建，登记专家资料并人工审核后再授权。</p>
        <el-form-item label="授权地区" required :error="fieldErrors.regionIds">
          <el-select id="account-regionIds" v-model="fields.regionIds" multiple filterable :disabled="fields.roles.includes('national_admin')" aria-label="授权地区">
            <el-option v-for="item in regionCatalog" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <p class="muted">{{ fields.roles.includes('national_admin') ? '全国管理员覆盖全部地区。' : '岗位决定可操作的模块，地区决定记录范围。' }}授权调整后旧会话失效。</p>
      </template>
      <el-form-item v-if="action === 'create' || action === 'resetPassword'" label="新密码" required :error="fieldErrors.password">
        <el-input id="account-password" v-model="fields.password" type="password" show-password autocomplete="new-password" maxlength="72" />
        <p class="muted">至少12位，含字母和数字；请通过安全渠道告知账号本人，页面不会保留密码。</p>
      </el-form-item>
      <template v-if="action === 'materials' || action === 'review'">
        <el-form-item label="审核对象" required><el-radio-group v-model="fields.subject"><el-radio value="account">账号资料</el-radio><el-radio value="expert">专家资料</el-radio></el-radio-group></el-form-item>
        <el-form-item v-if="action === 'materials'" label="资料来源或归档编号" required :error="fieldErrors.materialReference">
          <el-input id="account-materialReference" v-model="fields.materialReference" type="textarea" :rows="2" maxlength="1000" show-word-limit />
          <p class="muted">填写材料收取渠道、档案编号或受控资料位置，避免在此录入身份证完整号码。</p>
        </el-form-item>
        <el-form-item v-if="action === 'review'" label="审核结论" required><el-radio-group v-model="fields.result"><el-radio value="approved">人工通过</el-radio><el-radio value="returned">需补充</el-radio><el-radio value="rejected">未通过</el-radio></el-radio-group></el-form-item>
        <el-alert v-if="action === 'review' && !reviewReady" title="此类资料尚未登记新的待审核材料，请先登记后再审核。" type="warning" :closable="false" />
        <el-form-item :label="action === 'materials' ? '资料摘要' : '审核依据与说明'" required :error="fieldErrors.summary"><el-input id="account-summary" v-model="fields.summary" type="textarea" :rows="4" maxlength="2000" show-word-limit /></el-form-item>
      </template>
    </el-form>
    <template #footer><el-button :disabled="saving" @click="editorOpen = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="action === 'review' && !reviewReady" @click="submit">保存</el-button></template>
  </el-dialog>
</template>

<style scoped>
.account-note, .account-error { margin: 18px 0; }
.account-tags, .account-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.account-actions { margin: 24px 0; }
.account-actions :deep(.el-button + .el-button) { margin-left: 0; }
.account-detail { min-height: 180px; }
.account-history { padding-left: 6px; margin-top: 22px; }
.account-history p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.8; margin: 6px 0; }
.account-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.account-error a { color: var(--el-color-danger); line-height: 1.8; }
.account-error:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 3px; }
.el-form-item .el-select { width: 100%; }
.el-form-item p { margin: 5px 0 0; font-size: 12px; line-height: 1.7; }
@media (max-width: 640px) {
  .account-form-grid { grid-template-columns: 1fr; gap: 0; }
  .panel-header { align-items: flex-start; gap: 12px; flex-wrap: wrap; }
  .account-actions .el-button { min-height: 40px; }
}
</style>
