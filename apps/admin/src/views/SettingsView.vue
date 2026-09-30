<script setup lang="ts">
import { isHttpMode, modeText } from "../services/mode";

import { savePlatformConfig, saveNotificationDraft } from "../services/actions";

import { computed, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Plus,
  Search,
  Setting,
  Bell,
  Document,
  CircleCheck,
  Connection,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import SearchStatus from "../components/SearchStatus.vue";
import {
  platformConfig,
  notificationDrafts,
  type NotificationDraft,
} from "../domain/operations";
import { activityLog } from "../domain/workspace";
import { command } from "../services/workspaceData";
async function sendNotification(item: NotificationDraft) {
  try {
    await ElMessageBox.confirm(
      `将“${item.title}”发送给授权范围内的${item.audience}？发送后将记录为站内消息。`,
      "发送站内消息",
      {
        confirmButtonText: "确认发送",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    await command("publishNotification", {}, item.id);
    ElMessage.success("站内消息已发送");
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  }
}
const tab = ref("platform"),
  query = ref("");
const config = reactive({ ...platformConfig });
const dirty = computed(
  () => JSON.stringify(config) !== JSON.stringify(platformConfig),
);
async function saveConfig() {
  const result = await savePlatformConfig(config);
  if (!result.ok) return ElMessage.warning(result.message);
  ElMessage.success(result.message);
}
function resetConfig() {
  Object.assign(config, platformConfig);
  ElMessage.info("已恢复为最后保存的配置");
}
const notifications = computed(() =>
  notificationDrafts.filter(
    (item) =>
      !query.value ||
      `${item.title}${item.audience}${item.content}`.includes(
        query.value.trim(),
      ),
  ),
);
const logs = computed(() =>
  activityLog.filter(
    (item) =>
      !query.value ||
      `${item.action}${item.target}${item.time}`.includes(query.value.trim()),
  ),
);
const newDraftOpen = ref(false),
  previewOpen = ref(false),
  selectedDraft = ref<NotificationDraft | null>(null);
const draft = reactive({ title: "", audience: "区域运营", content: "" });
function createDraft() {
  Object.assign(draft, { title: "", audience: "区域运营", content: "" });
  newDraftOpen.value = true;
}
async function saveDraft() {
  const result = await saveNotificationDraft(draft);
  if (!result.ok) return ElMessage.warning(result.message);
  ElMessage.success(result.message);
  newDraftOpen.value = false;
}
function preview(item: NotificationDraft) {
  selectedDraft.value = item;
  previewOpen.value = true;
}
</script>
<template>
  <PageHeading
    title="系统设置"
    description="统一平台表达，管理通知草稿，回看操作轨迹。"
    eyebrow="PLATFORM SETTINGS"
  />
  <section class="panel settings-panel">
    <el-tabs v-model="tab" @tab-change="query = ''"
      ><el-tab-pane name="platform"
        ><template #label
          ><span class="tab-label"
            ><el-icon><Setting /></el-icon>平台配置</span
          ></template
        ></el-tab-pane
      ><el-tab-pane name="notifications"
        ><template #label
          ><span class="tab-label"
            ><el-icon><Bell /></el-icon>通知草稿</span
          ></template
        ></el-tab-pane
      ><el-tab-pane name="logs"
        ><template #label
          ><span class="tab-label"
            ><el-icon><Document /></el-icon>操作日志</span
          ></template
        ></el-tab-pane
      ><el-tab-pane v-if="isHttpMode" name="search" label="搜索服务"
    /></el-tabs>
    <SearchStatus v-if="tab === 'search'" />
    <div v-if="tab === 'platform'" class="settings-grid">
      <div class="settings-main">
        <div class="settings-section">
          <div class="settings-section-heading">
            <span class="step-number">01</span>
            <div>
              <h2>平台基础信息</h2>
              <p>用于讨论平台名称与运营信息的统一表达</p>
            </div>
          </div>
          <el-form label-position="top"
            ><el-form-item label="平台名称" required
              ><el-input
                v-model="config.name"
                maxlength="30"
                show-word-limit /></el-form-item
            ><el-form-item label="平台副标题" required
              ><el-input v-model="config.subtitle" maxlength="60"
            /></el-form-item>
            <div class="form-columns">
              <el-form-item label="运营联系人 / 部门" required
                ><el-input
                  v-model="config.contact"
                  maxlength="40" /></el-form-item
              ><el-form-item label="运营中心名称"
                ><el-input v-model="config.regionLabel" maxlength="40"
              /></el-form-item>
            </div>
            <el-form-item label="展示语言"
              ><el-select v-model="config.language"
                ><el-option label="简体中文" value="简体中文" /><el-option
                  label="中英双语（配置示例）"
                  value="中英双语（配置示例）" /></el-select
              ><span class="field-help"
                >此项保存语言配置，不自动翻译页面或内容。</span
              ></el-form-item
            ><el-form-item label="品牌寄语"
              ><el-input
                v-model="config.notice"
                type="textarea"
                :rows="3"
                maxlength="150"
                show-word-limit /></el-form-item
          ></el-form>
        </div>
        <div class="settings-section">
          <div class="settings-section-heading">
            <span class="step-number">02</span>
            <div>
              <h2>运营提醒偏好</h2>
              <p>
                {{
                  modeText(
                    "配置自动提醒；手动调整评审时间的通知始终发送。",
                    "保存提醒选项，用于本地演示。",
                  )
                }}
              </p>
            </div>
          </div>
          <div class="preference">
            <div>
              <b>评审待办提醒</b>
              <p>
                {{
                  modeText(
                    "开启后，24 小时内截止提醒专家，首次逾期提醒专家和分配管理员。关闭不影响评分时间校验、预警列表和时间调整通知。",
                    "记录评审任务提醒的演示配置偏好。",
                  )
                }}
              </p>
            </div>
            <el-switch
              v-model="config.reviewReminder"
              aria-label="评审待办提醒偏好"
            />
          </div>
          <div class="preference">
            <div>
              <b>内容草稿提醒</b>
              <p>记录未完成内容草稿的提醒偏好</p>
            </div>
            <el-switch
              v-model="config.draftNotice"
              aria-label="内容草稿提醒偏好"
            />
          </div>
        </div>
        <div class="settings-save">
          <el-button
            v-has-permi="'settings:write'"
            type="primary"
            @click="saveConfig"
            >保存配置</el-button
          ><el-button @click="resetConfig">撤销未保存修改</el-button
          ><span v-if="dirty" class="unsaved">有未保存修改</span
          ><span v-else class="muted">配置与本次保存一致</span>
        </div>
      </div>
      <aside class="settings-aside">
        <div class="config-preview">
          <span class="preview-label">品牌信息预览</span>
          <div class="brand-stamp">家</div>
          <h3>{{ config.name || "平台名称" }}</h3>
          <p>{{ config.subtitle || "平台副标题" }}</p>
          <div class="preview-rule"></div>
          <blockquote>{{ config.notice || "在这里写下品牌寄语" }}</blockquote>
          <small>{{ config.regionLabel }}</small>
        </div>
        <div class="scope-note">
          <el-icon><CircleCheck /></el-icon>
          <div>
            <b>当前配置范围</b>
            <p>
              {{
                modeText(
                  "配置由服务端保存并记录操作日志。外部消息推送未启用。",
                  "修改只存在于当前页面会话，刷新后恢复预置内容。尚未对接服务端配置、消息推送或备份服务。",
                )
              }}
            </p>
          </div>
        </div>
        <div class="integration-card">
          <el-icon><Connection /></el-icon>
          <h3>服务连接状态</h3>
          <p>
            {{
              modeText(
                "当前支持业务配置、通知草稿与站内消息；未启用外部推送通道。",
                "消息推送、素材备份和外部接口尚未启用。当前可使用配置预览与通知草稿。",
              )
            }}
          </p>
        </div>
      </aside>
    </div>
    <template v-else-if="tab === 'notifications'"
      ><div class="notification-heading">
        <div>
          <h2 class="section-title">把每一条通知准备妥当</h2>
          <p class="muted">
            {{
              modeText(
                "先编辑、再预览，核对后发送站内消息。微信推送暂不可用。",
                "先编辑、再预览。演示模式不发送消息。",
              )
            }}
          </p>
        </div>
        <el-button
          v-has-permi="'settings:write'"
          type="primary"
          :icon="Plus"
          @click="createDraft"
          >新建通知草稿</el-button
        >
      </div>
      <div class="filter-bar">
        <el-input
          v-model="query"
          :prefix-icon="Search"
          placeholder="搜索标题、接收人群或正文"
          clearable
          aria-label="搜索通知草稿"
        />
      </div>
      <el-table :data="notifications" row-key="id"
        ><el-table-column
          prop="title"
          label="通知标题"
          min-width="250" /><el-table-column
          prop="audience"
          label="接收人群"
          min-width="125" /><el-table-column label="状态" width="120"
          ><template #default="{ row }"
            ><el-tag
              :type="row.status === '已发送' ? 'success' : 'info'"
              size="small"
              >{{ row.status || "未发送草稿" }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column
          prop="date"
          label="编辑日期"
          width="130" /><el-table-column label="操作" width="180" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="preview(row)"
              >预览通知</el-button
            ><el-button
              v-if="isHttpMode && row.status !== '已发送'"
              v-has-permi="'settings:write'"
              type="primary"
              link
              @click="sendNotification(row)"
              >发送站内消息</el-button
            ></template
          ></el-table-column
        ><template #empty
          ><el-empty description="没有匹配的通知草稿" /></template
      ></el-table>
      <div class="table-tools muted">
        共 {{ notifications.length }} 条通知草稿 ·
        {{ modeText("服务端持久保存", "仅当前会话保留") }}
      </div></template
    >
    <template v-else-if="tab === 'logs'"
      ><div class="log-heading">
        <h2 class="section-title">操作记录</h2>
        <p class="muted">
          {{
            modeText(
              "显示当前账号授权范围内的服务端操作记录。",
              "记录状态变更，帮助回看界面演示过程；不替代服务端审计日志。",
            )
          }}
        </p>
      </div>
      <div class="filter-bar">
        <el-input
          v-model="query"
          :prefix-icon="Search"
          placeholder="搜索操作、对象或时间"
          clearable
          aria-label="搜索操作日志"
        />
      </div>
      <el-table :data="logs" row-key="id"
        ><el-table-column
          prop="time"
          label="操作时间"
          min-width="170" /><el-table-column
          prop="action"
          label="操作类型"
          min-width="205" /><el-table-column
          prop="target"
          label="操作对象"
          min-width="240" /><el-table-column label="操作者" width="140"
          ><template #default="{ row }">{{
            row.actor || modeText("系统记录", "演示管理员")
          }}</template></el-table-column
        ><el-table-column label="记录来源" width="140"
          ><template #default
            ><el-tag type="info" size="small" effect="plain">{{
              modeText("业务日志", "内存示例")
            }}</el-tag></template
          ></el-table-column
        ><template #empty
          ><el-empty
            :description="
              query
                ? '没有匹配的操作记录'
                : '还没有操作记录，保存配置后可在此查看'
            " /></template
      ></el-table>
      <div class="table-tools muted">
        共 {{ logs.length }} 条记录 ·
        {{ modeText("由服务端保存", "刷新页面会重置") }}
      </div></template
    >
  </section>
  <el-dialog
    v-model="newDraftOpen"
    title="新建通知草稿"
    width="min(620px, 92vw)"
    ><el-form label-position="top"
      ><el-form-item label="通知标题" required
        ><el-input
          v-model="draft.title"
          maxlength="80"
          placeholder="至少 4 字" /></el-form-item
      ><el-form-item label="接收人群" required
        ><el-select v-model="draft.audience"
          ><el-option
            v-for="item in ['区域运营', '内容运营', '评审专家', '全部用户']"
            :key="item"
            :value="item"
            :label="item" /></el-select></el-form-item
      ><el-form-item label="通知正文" required
        ><el-input
          v-model="draft.content"
          type="textarea"
          :rows="6"
          maxlength="1500"
          show-word-limit
          placeholder="请输入通知内容，至少 10 字" /></el-form-item></el-form
    ><el-alert
      title="仅保存用于预览的通知草稿，不发送任何消息。"
      type="info"
      :closable="false"
    /><template #footer
      ><el-button @click="newDraftOpen = false">取消</el-button
      ><el-button
        v-has-permi="'settings:write'"
        type="primary"
        @click="saveDraft"
        >保存草稿</el-button
      ></template
    ></el-dialog
  >
  <el-drawer v-model="previewOpen" title="通知预览" size="min(620px, 100vw)"
    ><template v-if="selectedDraft"
      ><article class="notification-preview">
        <span class="preview-label">家风中华行 · 运营通知</span>
        <h2>{{ selectedDraft.title }}</h2>
        <div class="notification-meta">
          <span>接收人群：{{ selectedDraft.audience }}</span
          ><span>{{ selectedDraft.date }}</span>
        </div>
        <div class="notification-body">{{ selectedDraft.content }}</div>
        <p class="notification-sign">家风中华行运营中心</p>
      </article>
      <el-alert
        :title="`通知预览 · ${selectedDraft?.status || '未发送草稿'}，关闭预览不会触发发送。`"
        type="info"
        :closable="false"
        show-icon /></template
  ></el-drawer>
</template>
<style scoped>
.tab-label {
  display: flex;
  gap: 8px;
  align-items: center;
}
.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 50px;
  padding: 18px 8px 8px;
}
.settings-main {
  min-width: 0;
}
.settings-section + .settings-section {
  border-top: 1px solid #ecece3;
  margin-top: 26px;
  padding-top: 26px;
}
.settings-section-heading {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 23px;
}
.step-number {
  font-size: 13px;
  color: #b08c54;
  background: #f4eee2;
  border-radius: 6px;
  padding: 8px;
  margin-top: 1px;
  font-family: monospace;
}
.settings-section h2 {
  font-size: 16px;
  font-weight: 600;
  color: #4d5547;
  margin: 0 0 7px;
}
.settings-section-heading p {
  font-size: 12px;
  color: #a0a393;
  margin: 0;
  line-height: 1.6;
}
.form-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.settings-main .el-select {
  width: 100%;
}
.field-help {
  display: block;
  color: #a0a393;
  font-size: 12px;
  line-height: 1.8;
  margin-top: 6px;
}
.preference {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  padding: 17px 0;
  border-bottom: 1px solid #f0f0e9;
}
.preference b {
  font-size: 14px;
  font-weight: 500;
  color: #626a58;
}
.preference p {
  font-size: 12px;
  color: #a1a693;
  margin: 7px 0 0;
}
.settings-save {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 30px;
}
.settings-save .el-button {
  margin: 0;
}
.settings-save > span {
  font-size: 12px;
  margin-left: 5px;
}
.unsaved {
  color: #b29356;
}
.config-preview {
  text-align: center;
  padding: 29px 24px;
  background: #f8f4eb;
  border: 1px solid #eae2d2;
  border-radius: 8px;
  overflow-wrap: anywhere;
}
.preview-label {
  font-size: 10px;
  letter-spacing: 2px;
  color: #ad9870;
}
.brand-stamp {
  display: grid;
  place-items: center;
  width: 54px;
  height: 60px;
  margin: 25px auto 18px;
  border: 2px solid #a94f42;
  border-radius: 3px;
  font-size: 36px;
  font-family: serif;
  color: #a94f42;
}
.config-preview h3 {
  font-family: serif;
  font-size: 25px;
  letter-spacing: 3px;
  color: #645639;
  margin: 0 0 10px;
}
.config-preview > p {
  font-size: 11px;
  color: #a59a81;
  line-height: 1.9;
}
.preview-rule {
  width: 40px;
  height: 1px;
  background: #cdbd9b;
  margin: 25px auto;
}
.config-preview blockquote {
  font-size: 14px;
  color: #a58f63;
  font-family: serif;
  line-height: 2;
  margin: 0 0 18px;
  letter-spacing: 1px;
}
.config-preview > small {
  font-size: 10px;
  color: #b2a68c;
}
.scope-note {
  display: flex;
  gap: 11px;
  align-items: flex-start;
  padding: 21px 4px;
  margin-top: 7px;
}
.scope-note > .el-icon {
  font-size: 19px;
  color: #93a582;
  flex-shrink: 0;
}
.scope-note b {
  font-size: 12px;
  color: #89967b;
  font-weight: 500;
}
.scope-note p {
  font-size: 12px;
  color: #a0a792;
  line-height: 1.9;
  margin: 8px 0 0;
}
.integration-card {
  background: #f3f5ef;
  border: 1px solid #e9ece1;
  border-radius: 8px;
  padding: 21px;
}
.integration-card > .el-icon {
  font-size: 24px;
  color: #89977b;
}
.integration-card h3 {
  font-size: 13px;
  color: #7a886a;
  font-weight: 500;
  margin: 13px 0;
}
.integration-card p {
  font-size: 12px;
  color: #a0a993;
  line-height: 1.8;
  margin: 0;
}
.notification-heading {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  padding: 15px 0;
}
.notification-heading p,
.log-heading p {
  font-size: 13px;
  line-height: 1.8;
}
.log-heading {
  padding: 15px 0 7px;
}
.filter-bar .el-input {
  max-width: 390px;
}
.notification-preview {
  padding: 25px 20px;
  border: 1px solid #ebe7dc;
  background: #fdfbf5;
  margin-bottom: 25px;
}
.notification-preview h2 {
  font-size: 23px;
  line-height: 1.6;
  margin: 20px 0 15px;
  color: #525941;
  overflow-wrap: anywhere;
}
.notification-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  color: #9da48b;
  font-size: 11px;
  padding-bottom: 21px;
  border-bottom: 1px solid #e9ecdf;
}
.notification-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 14px;
  color: #7c856b;
  line-height: 2.2;
  margin-top: 24px;
}
.notification-sign {
  text-align: right;
  font-size: 12px;
  color: #939e81;
  margin: 35px 0 5px;
}
@media (max-width: 1150px) {
  .settings-grid {
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 28px;
  }
}
@media (max-width: 950px) {
  .settings-grid {
    grid-template-columns: 1fr;
    padding: 12px 0;
  }
  .settings-aside {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  .scope-note {
    align-self: center;
  }
  .integration-card {
    grid-column: 1 / -1;
  }
}
@media (max-width: 600px) {
  .settings-aside {
    grid-template-columns: 1fr;
  }
  .form-columns {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .notification-heading {
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
  }
  .settings-save {
    gap: 8px;
  }
  .settings-save > span {
    flex-basis: 100%;
    margin-top: 6px;
  }
  .filter-bar .el-input {
    max-width: none;
  }
  .settings-panel :deep(.el-tabs__item) {
    padding: 0 13px;
    font-size: 13px;
  }
  .tab-label {
    gap: 5px;
  }
}
</style>
