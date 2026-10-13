<script setup lang="ts">
import { isHttpMode, modeText } from "../services/mode";

import { saveDictionaryWord, toggleDictionaryWord } from "../services/actions";

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Search,
  Plus,
  Collection,
  Connection,
  Document,
  EditPen,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import AiTaskResult from "../components/AiTaskResult.vue";
import { aiModeLabels, aiStatusLabels, readAiStatus, readAiTasks, readAiTask, indexKnowledge, withdrawKnowledge, waitForAiTask, type AiStatus, type AiTask } from "../services/ai";
import { session } from "../services/session";
import {
  knowledgeBases,
  aiRecords,
  dictionaryWords,
  type AiRecord,
  type DictionaryWord,
} from "../domain/operations";
import { matchesRegion } from "../domain/workspace";
import { command, loadWorkspace } from "../services/workspaceData";
import { uploadFile } from "../services/files";
import { regions } from "../domain/workspace";
import type { UploadFile } from "element-plus";
const documentOpen = ref(false),
  documentBusy = ref(false);
const serviceStatus = ref<AiStatus>();
const serviceError = ref("");
const recordsError = ref("");
const liveTasks = ref<AiTask[]>([]);
const refreshing = ref(false);
const knowledgeBusy = ref(false);
const knowledgeError = ref("");
const knowledgeTask = ref<AiTask>();
const audience = ref<"public" | "staff">("staff");
const knowledgeLanguage = ref<"zh" | "en">("zh");
let generation = 0;
let knowledgeController: AbortController | undefined;
async function refreshAi() {
  if (!isHttpMode) return;
  const active = generation;
  refreshing.value = true;
  serviceError.value = ""; recordsError.value = "";
  const [status, records] = await Promise.allSettled([readAiStatus(), readAiTasks()]);
  if (active !== generation) return;
  if (status.status === "fulfilled") serviceStatus.value = status.value;
  else { serviceStatus.value = undefined; serviceError.value = status.reason instanceof Error ? status.reason.message : "读取模型状态失败"; }
  if (records.status === "fulfilled") liveTasks.value = records.value.items || [];
  else { liveTasks.value = []; recordsError.value = records.reason instanceof Error ? records.reason.message : "读取任务日志失败"; }
  refreshing.value = false;
}
onMounted(refreshAi);
function stopKnowledge() { generation++; knowledgeController?.abort(); knowledgeBusy.value = false; }
onBeforeUnmount(stopKnowledge);
watch(() => session.user?.id, () => { stopKnowledge(); liveTasks.value = []; serviceStatus.value = undefined; knowledgeTask.value = undefined; selectedBase.value = null; baseOpen.value = false; recordOpen.value = false; void refreshAi(); });
const filteredTasks = computed(() => liveTasks.value.filter((task) =>
  (!query.value.trim() || `${task.id} ${task.model || ""} ${task.submissionId || ""}`.includes(query.value.trim())) &&
  (!mode.value || task.mode === mode.value),
));
const serviceLabel = computed(() => !isHttpMode ? "原型预览" : refreshing.value && !serviceStatus.value ? "读取状态中" : !serviceStatus.value ? "状态读取失败" : serviceStatus.value.enabled ? "模型已配置" : "服务未启用");
function knowledgeStatus(base: (typeof knowledgeBases)[number]) {
  return base.indexStatus === "indexed" ? "已索引" : base.indexStatus === "withdrawn" ? "已撤回" : base.status;
}
const documentFile = ref<File>();
const documentForm = reactive({
  title: "",
  category: "典籍文献",
  region: "全国",
});
function chooseDocument(file: UploadFile) {
  documentFile.value = file.raw;
}
async function saveDocument() {
  if (!documentFile.value || documentForm.title.trim().length < 2)
    return ElMessage.warning("请填写资料标题并选择文件");
  documentBusy.value = true;
  try {
    const uploaded = await uploadFile(documentFile.value);
    await command("saveKnowledgeDocument", {
      ...documentForm,
      fileId: uploaded.fileId,
    });
    documentOpen.value = false;
    documentFile.value = undefined;
    ElMessage.success("资料已保存，检索索引尚未建立");
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : "资料保存失败，请重试");
  } finally {
    documentBusy.value = false;
  }
}
const tab = ref("knowledge"),
  query = ref(""),
  mode = ref("");
const visibleBases = computed(() =>
  knowledgeBases.filter(
    (item) =>
      !query.value ||
      `${item.title}${item.category}`.includes(query.value.trim()),
  ),
);
const visibleRecords = computed(() =>
  aiRecords.filter(
    (item) =>
      matchesRegion(item.region) &&
      (!query.value ||
        `${item.id}${item.user}${item.input}${item.output}`.includes(
          query.value.trim(),
        )) &&
      (!mode.value || item.mode === mode.value),
  ),
);
const visibleWords = computed(() =>
  dictionaryWords.filter(
    (item) =>
      !query.value || `${item.word}${item.note}`.includes(query.value.trim()),
  ),
);
const baseOpen = ref(false),
  selectedBase = ref<(typeof knowledgeBases)[number] | null>(null),
  recordOpen = ref(false),
  selectedRecord = ref<AiRecord | null>(null),
  wordOpen = ref(false);
const wordForm = reactive({
  id: "",
  word: "",
  type: "合规提醒",
  action: "人工复核",
  note: "",
});
function openBase(item: (typeof knowledgeBases)[number]) {
  knowledgeController?.abort(); knowledgeBusy.value = false; knowledgeTask.value = undefined; knowledgeError.value = "";
  selectedBase.value = item;
  audience.value = item.audience || "staff";
  knowledgeLanguage.value = item.language || "zh";
  baseOpen.value = true;
}
watch(baseOpen, (value) => { if (!value) { knowledgeController?.abort(); knowledgeBusy.value = false; } });
async function buildIndex(resume = false) {
  const base = selectedBase.value;
  if (!base || base.lockVersion === undefined || knowledgeBusy.value) return;
  try {
    if (!resume) await ElMessageBox.confirm(audience.value === "public" ? "索引后，资料片段可用于用户端知识问答。请确认资料已经审校，并具有公开使用授权。" : "索引后，资料仅供已授权的后台审核辅助使用。请确认资料已审校并具有相应使用授权。", "确认资料检索范围", { confirmButtonText: "确认并建立索引", cancelButtonText: "取消", type: "warning" });
  } catch { return; }
  knowledgeController?.abort(); knowledgeController = new AbortController();
  const signal = knowledgeController.signal;
  knowledgeBusy.value = true; knowledgeError.value = "";
  try {
    const task = resume && knowledgeTask.value ? await readAiTask(knowledgeTask.value.id) : await indexKnowledge(base.id, base.lockVersion, audience.value, knowledgeLanguage.value);
    if (signal.aborted) return;
    knowledgeTask.value = task;
    const result = await waitForAiTask(task, { signal, onUpdate(value) { if (!signal.aborted) knowledgeTask.value = value; } });
    if (result.status === "succeeded") ElMessage.success("知识资料已建立索引");
    await loadWorkspace(); await refreshAi();
  } catch (cause) { if (!signal.aborted) knowledgeError.value = cause instanceof Error ? cause.message : "资料索引失败"; }
  finally { if (!signal.aborted) knowledgeBusy.value = false; }
}
async function withdrawIndex() {
  const base = selectedBase.value;
  if (!base || base.lockVersion === undefined || knowledgeBusy.value) return;
  try { await ElMessageBox.confirm("撤回后，该资料不再用于新的知识检索。原文件与操作记录保留。", "撤回知识资料", { confirmButtonText: "撤回索引", cancelButtonText: "取消", type: "warning" }); }
  catch { return; }
  knowledgeBusy.value = true; knowledgeError.value = "";
  try { await withdrawKnowledge(base.id, base.lockVersion); knowledgeTask.value = undefined; await loadWorkspace(); await refreshAi(); ElMessage.success("资料已撤回检索"); }
  catch (cause) { knowledgeError.value = cause instanceof Error ? cause.message : "撤回索引失败"; }
  finally { knowledgeBusy.value = false; }
}
async function refreshKnowledge() {
  knowledgeError.value = "";
  try { await loadWorkspace(); await refreshAi(); }
  catch (cause) { knowledgeError.value = cause instanceof Error ? cause.message : "刷新资料失败"; }
}
function openRecord(item: AiRecord) {
  selectedRecord.value = item;
  recordOpen.value = true;
}
function editWord(item?: DictionaryWord) {
  Object.assign(
    wordForm,
    item
      ? { ...item }
      : { id: "", word: "", type: "合规提醒", action: "人工复核", note: "" },
  );
  wordOpen.value = true;
}
async function submitWord() {
  const result = await saveDictionaryWord(wordForm);
  if (!result.ok) return ElMessage.warning(result.message);
  ElMessage.success(result.message);
  wordOpen.value = false;
}
async function toggleWord(item: DictionaryWord) {
  await toggleDictionaryWord(item.id);
  ElMessage.success("词条状态已更新；已有分析结果不会自动重算");
}
</script>
<template>
  <PageHeading
    title="AI 运营中心"
    description="管理知识资料、调用任务和内容词库，保持知识来源可核对、审核建议可追溯。"
    eyebrow="AI OPERATIONS"
    ><template #actions
      ><el-button v-if="isHttpMode" :loading="refreshing" @click="refreshAi">刷新服务与任务</el-button
      ><el-button
        v-if="isHttpMode"
        v-has-permi="'ai:write'"
        type="primary"
        @click="documentOpen = true"
        >添加资料</el-button
      ></template
    ></PageHeading
  >
  <div class="ai-banner">
    <div class="ai-orbit">
      <el-icon><Connection /></el-icon>
    </div>
    <div class="ai-banner-copy">
      <span class="service-label"><i></i>服务状态 · {{ serviceLabel }}</span>
      <h2>可信的回答，从有据可循开始</h2>
      <p>
        {{
          modeText(
            "知识资料经审校后可索引或撤回。调用记录只展示实际任务元信息，个人对话和私人稿件正文不在此展示。",
            "此处展示预置知识库结构、输入输出样例及词库配置。没有模型推理、OCR、检索或自动审核调用。",
          )
        }}
      </p>
    </div>
    <span class="ai-badge">{{ serviceStatus?.external ? "开发 API" : serviceLabel }}</span>
  </div>
  <el-alert v-if="serviceError" class="service-note" :title="serviceError" type="error" :closable="false" />
  <el-descriptions v-if="isHttpMode && serviceStatus" class="service-note" :column="2" border>
    <el-descriptions-item label="模型提供方">{{ serviceStatus.provider || '未配置' }}</el-descriptions-item>
    <el-descriptions-item label="模型">{{ serviceStatus.model || '未配置' }}</el-descriptions-item>
    <el-descriptions-item label="OCR">{{ serviceStatus.ocrEnabled ? '已配置' : '未启用' }}</el-descriptions-item>
    <el-descriptions-item label="公开索引资料">{{ serviceStatus.knowledgeCount }}</el-descriptions-item>
  </el-descriptions>
  <el-alert v-if="serviceStatus?.external" class="service-note" title="当前使用开发用外部模型 API。模型仅由服务端调用；后续可切换本地模型地址。" type="warning" :closable="false" show-icon />
  <section class="panel">
    <el-tabs
      v-model="tab"
      @tab-change="
        query = '';
        mode = '';
      "
      ><el-tab-pane name="knowledge" label="知识库" /><el-tab-pane
        name="records"
        label="调用记录" /><el-tab-pane name="dictionary" label="内容词库"
    /></el-tabs>
    <div class="filter-bar">
      <el-input
        v-model="query"
        :placeholder="
          tab === 'knowledge'
            ? '搜索知识库名称'
            : tab === 'records'
              ? (isHttpMode ? '搜索任务编号、稿件编号或模型' : '搜索编号、用户或样例内容')
              : '搜索词条或备注'
        "
        :prefix-icon="Search"
        clearable
        aria-label="搜索 AI 运营资料"
      /><el-select
        v-if="tab === 'records'"
        v-model="mode"
        placeholder="全部能力类型"
        clearable
        aria-label="能力类型"
        ><el-option
          v-for="(label, value) in aiModeLabels"
          :key="value"
          :value="isHttpMode ? value : label"
          :label="label" /></el-select
      ><el-button
        v-has-permi="'ai:write'"
        v-if="tab === 'dictionary'"
        type="primary"
        :icon="Plus"
        class="new-word"
        @click="editWord()"
        >添加词条</el-button
      >
    </div>
    <template v-if="tab === 'knowledge'"
      ><div class="knowledge-grid">
        <article
          v-for="(base, index) in visibleBases"
          :key="base.id"
          class="knowledge-card"
        >
          <div class="knowledge-top">
            <span class="knowledge-icon" :class="`tone-${index}`"
              ><el-icon><Collection /></el-icon></span
            ><el-tag size="small" effect="plain" type="info">{{
              knowledgeStatus(base)
            }}</el-tag>
          </div>
          <h3>{{ base.title }}</h3>
          <p>{{ base.description }}</p>
          <div class="knowledge-meta">
            <span>{{ base.category }}</span
            ><span>{{ base.version }}</span><el-tag v-if="isHttpMode" size="small" :type="base.audience === 'public' ? 'success' : 'info'">{{ base.audience === 'public' ? '范围：用户端' : '范围：后台' }}</el-tag>
          </div>
          <div class="knowledge-footer">
            <div>
              <strong>{{ base.documents }}</strong
              ><small>份资料</small>
            </div>
            <el-button link type="primary" @click="openBase(base)"
              >{{ isHttpMode ? '管理索引 →' : '查看资料结构 →' }}</el-button
            >
          </div>
        </article>
      </div>
      <el-empty
        v-if="!visibleBases.length"
        description="没有符合条件的知识资料"
      />
      <div class="knowledge-note">
        <el-icon><Document /></el-icon>
        <div>
          <b>知识来源与版本独立记录</b>
          <p>
            上传文件后需人工核对授权、内容与使用范围，再建立索引。“用户端可检索”资料会参与公开知识问答；“仅后台辅助”资料只在授权的后台任务中使用。
          </p>
        </div>
      </div></template
    >
    <template v-else-if="tab === 'records' && isHttpMode">
      <el-alert v-if="recordsError" :title="recordsError" type="error" :closable="false" />
      <el-table v-loading="refreshing" :data="filteredTasks" row-key="id" empty-text="当前授权范围内没有实际调用任务">
        <el-table-column label="任务编号 / 创建时间" min-width="220"><template #default="{ row }"><b class="record-id">{{ row.id }}</b><small class="record-time">{{ row.createdAt }}</small></template></el-table-column>
        <el-table-column label="能力" width="110"><template #default="{ row }">{{ aiModeLabels[row.mode as keyof typeof aiModeLabels] || row.mode }}</template></el-table-column>
        <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 'failed' ? 'danger' : row.status === 'succeeded' ? 'success' : 'warning'">{{ aiStatusLabels[row.status as keyof typeof aiStatusLabels] || row.status }}</el-tag></template></el-table-column>
        <el-table-column prop="model" label="模型" min-width="140" />
        <el-table-column label="业务关联" min-width="180"><template #default="{ row }">{{ row.submissionId ? `${row.submissionId} · 版本 ${row.sourceVersion ?? '—'}` : '个人任务 / 资料任务' }}</template></el-table-column>
        <el-table-column label="完成时间" min-width="190"><template #default="{ row }">{{ row.completedAt || '—' }}</template></el-table-column>
        <el-table-column label="错误码" min-width="170"><template #default="{ row }">{{ row.error?.code || '—' }}</template></el-table-column>
      </el-table>
      <p class="table-tools muted">共 {{ filteredTasks.length }} 条实际任务。此处不展示用户输入、生成正文或文件内容；稿件分析结果请在相应稿件详情中查看。</p>
    </template>
    <template v-else-if="tab === 'records'"
      ><el-table :data="visibleRecords" row-key="id"
        ><el-table-column label="记录编号 / 时间" min-width="185"
          ><template #default="{ row }"
            ><b class="record-id">{{ row.id }}</b
            ><small class="record-time">{{ row.time }}</small></template
          ></el-table-column
        ><el-table-column
          prop="user"
          label="用户"
          width="125" /><el-table-column
          prop="region"
          label="地区"
          width="100" /><el-table-column
          prop="mode"
          label="能力类型"
          width="110" /><el-table-column
          prop="input"
          label="输入摘要"
          min-width="230"
          show-overflow-tooltip /><el-table-column label="记录性质" width="160"
          ><template #default="{ row }"
            ><el-tag
              :type="row.status === '预置样例' ? 'info' : 'warning'"
              size="small"
              >{{ row.status }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column label="操作" width="100" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openRecord(row)"
              >查看详情</el-button
            ></template
          ></el-table-column
        ><template #empty
          ><el-empty description="当前地区没有匹配的调用记录" /></template
      ></el-table>
      <div class="table-tools muted">
        共 {{ visibleRecords.length }} 条调用记录 ·
        {{
          modeText(
            "仅显示实际请求记录；未调用模型时不会生成对话结果。",
            "以下输入输出均是编写的样例，无真实用户对话。",
          )
        }}
      </div></template
    >
    <template v-else
      ><el-alert
        class="dictionary-note"
        :title="modeText('启用的词条用于后续审核辅助提示；保存词条不会自动作出审核决定或重新分析历史稿件。', '词条仅用于配置讨论，保存或启用不会触发真实审核与拦截。')"
        type="info"
        :closable="false"
        show-icon
      /><el-table :data="visibleWords" row-key="id"
        ><el-table-column
          prop="word"
          label="词条 / 规则名称"
          min-width="165" /><el-table-column label="分类" width="125"
          ><template #default="{ row }"
            ><el-tag
              :type="row.type === '屏蔽词' ? 'danger' : 'warning'"
              size="small"
              effect="plain"
              >{{ row.type }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column
          prop="action"
          label="处理方式"
          width="110" /><el-table-column
          prop="note"
          label="配置备注"
          min-width="260" /><el-table-column label="状态" width="110"
          ><template #default="{ row }"
            ><el-switch
              v-has-permi="'ai:write'"
              :model-value="row.enabled"
              :aria-label="`${row.word}启用状态`"
              @change="toggleWord(row)" /></template></el-table-column
        ><el-table-column label="操作" width="90" fixed="right"
          ><template #default="{ row }"
            ><el-button
              v-has-permi="'ai:write'"
              link
              type="primary"
              @click="editWord(row)"
              >编辑</el-button
            ></template
          ></el-table-column
        ><template #empty
          ><el-empty
            description="没有匹配的词条，可添加新词条或调整搜索" /></template
      ></el-table>
      <div class="table-tools muted">
        共 {{ visibleWords.length }} 个词条
      </div></template
    >
  </section>
  <el-drawer v-model="baseOpen" title="知识资料结构" size="min(640px, 100vw)"
    ><template v-if="selectedBase"
      ><span class="drawer-kicker"
        >{{ selectedBase.category }} / {{ selectedBase.version }}</span
      >
      <h2 class="drawer-title">{{ selectedBase.title }}</h2>
      <p class="drawer-text">{{ selectedBase.description }}</p>
      <el-descriptions :column="1" border
        ><el-descriptions-item label="资料数量"
          >{{ selectedBase.documents }} 份（资料记录）</el-descriptions-item
        ><el-descriptions-item label="更新日期">{{
          selectedBase.updated
        }}</el-descriptions-item
        ><el-descriptions-item label="当前状态">{{
          knowledgeStatus(selectedBase)
        }}</el-descriptions-item
        ><el-descriptions-item label="检索范围">{{ selectedBase.audience === 'public' ? '用户端知识问答' : '仅授权后台审核辅助' }}</el-descriptions-item
        ><el-descriptions-item v-if="isHttpMode" label="数据版本">{{ selectedBase.lockVersion ?? '未返回' }}</el-descriptions-item
        ></el-descriptions
      >
      <template v-if="isHttpMode">
        <h3 class="drawer-subtitle">资料检索范围</h3>
        <el-radio-group v-model="audience" :disabled="knowledgeBusy" aria-label="资料检索范围">
          <el-radio value="staff">仅后台辅助</el-radio><el-radio value="public">用户端可检索</el-radio>
        </el-radio-group>
        <h3 class="drawer-subtitle">资料语言</h3>
        <el-radio-group v-model="knowledgeLanguage" :disabled="knowledgeBusy" aria-label="资料语言">
          <el-radio value="zh">简体中文</el-radio><el-radio value="en">English</el-radio>
        </el-radio-group>
        <p class="drawer-text">请选择资料正文的语言。问答按所选语言检索资料；改变语言后需重新建立索引。</p>
        <p class="drawer-text">公开资料需事先完成授权与审校。改变使用范围后，重新建立索引才会生效；上传文件本身不会进入知识问答。</p>
        <el-alert v-if="knowledgeError" :title="knowledgeError" type="error" :closable="false" />
        <div class="knowledge-actions">
          <el-button v-has-permi="'ai:write'" type="primary" :loading="knowledgeBusy" :disabled="selectedBase.lockVersion === undefined" @click="buildIndex()">建立 / 更新索引</el-button>
          <el-button v-has-permi="'ai:write'" :disabled="knowledgeBusy || selectedBase.lockVersion === undefined" @click="withdrawIndex">撤回检索</el-button>
          <el-button v-if="knowledgeTask && ['queued', 'running'].includes(knowledgeTask.status)" :disabled="knowledgeBusy" @click="buildIndex(true)">刷新索引任务</el-button>
          <el-button :disabled="knowledgeBusy" @click="refreshKnowledge">刷新资料</el-button>
        </div>
        <AiTaskResult v-if="knowledgeTask" :task="knowledgeTask" />
      </template>
      <h3 v-else class="drawer-subtitle">后续文档字段</h3>
      <div v-if="!isHttpMode" class="field-tags">
        <el-tag
          v-for="field in [
            '资料标题',
            '出处与作者',
            '使用授权',
            '原始版本',
            '审校人员',
            '生效范围',
            '索引版本',
          ]"
          :key="field"
          effect="plain"
          type="info"
          >{{ field }}</el-tag
        >
      </div>
      <el-alert
        class="drawer-note"
        v-if="!isHttpMode"
        title="本页尚无真实资料文件、上传处理或知识检索。"
        type="info"
        :closable="false" /></template
  ></el-drawer>
  <el-drawer v-model="recordOpen" title="输入输出详情" size="min(680px, 100vw)"
    ><template v-if="selectedRecord"
      ><div class="record-header">
        <el-tag>{{ selectedRecord.mode }}</el-tag
        ><span class="muted">{{ selectedRecord.time }}</span>
      </div>
      <p class="muted">
        {{ selectedRecord.id }} · {{ selectedRecord.region }} ·
        {{ selectedRecord.user }}
      </p>
      <h3 class="drawer-subtitle">请求内容</h3>
      <div class="conversation-input">{{ selectedRecord.input }}</div>
      <h3 class="drawer-subtitle">
        <el-icon><EditPen /></el-icon> 回复记录
      </h3>
      <div class="conversation-output">{{ selectedRecord.output }}</div>
      <el-descriptions :column="1" border
        ><el-descriptions-item label="内容来源">{{
          selectedRecord.source
        }}</el-descriptions-item
        ><el-descriptions-item label="记录性质">{{
          selectedRecord.status
        }}</el-descriptions-item></el-descriptions
      ><el-alert
        class="drawer-note"
        :title="
          modeText(
            '调用状态以服务端记录为准，未接模型时不会生成结果。',
            '以上是编写的样例，不是 AI 生成结果。',
          )
        "
        type="warning"
        :closable="false"
        show-icon /></template
  ></el-drawer>
  <el-dialog
    v-model="wordOpen"
    :title="wordForm.id ? '编辑词条' : '添加词条'"
    width="min(560px, 92vw)"
    ><el-form label-position="top"
      ><el-form-item label="词条 / 规则名称" required
        ><el-input
          v-model="wordForm.word"
          maxlength="50"
          placeholder="至少 2 字"
      /></el-form-item>
      <div class="word-form-grid">
        <el-form-item label="分类" required
          ><el-select v-model="wordForm.type"
            ><el-option label="合规提醒" value="合规提醒" /><el-option
              label="屏蔽词"
              value="屏蔽词" /></el-select></el-form-item
        ><el-form-item label="处理方式" required
          ><el-select v-model="wordForm.action"
            ><el-option label="人工复核" value="人工复核" /><el-option
              label="拦截提示"
              value="拦截提示" /></el-select
        ></el-form-item>
      </div>
      <el-form-item label="配置备注"
        ><el-input
          v-model="wordForm.note"
          type="textarea"
          :rows="3"
          maxlength="200"
          placeholder="说明使用场景与人工处理要点" /></el-form-item></el-form
    ><template #footer
      ><el-button @click="wordOpen = false">取消</el-button
      ><el-button v-has-permi="'ai:write'" type="primary" @click="submitWord"
        >保存词条</el-button
      ></template
    ></el-dialog
  >
  <el-dialog v-model="documentOpen" title="添加知识资料" width="min(540px,92vw)"
    ><el-form label-position="top"
      ><el-form-item label="标题" required
        ><el-input v-model="documentForm.title" maxlength="100" /></el-form-item
      ><el-form-item label="分类"
        ><el-select v-model="documentForm.category"
          ><el-option
            v-for="c in ['典籍文献', '红色史料', '平台知识']"
            :key="c"
            :value="c" /></el-select></el-form-item
      ><el-form-item label="地区"
        ><el-select v-model="documentForm.region"
          ><el-option
            v-for="r in regions"
            :key="r"
            :value="r" /></el-select></el-form-item
      ><el-form-item label="资料文件（PNG/JPEG/PDF/Word，10MB以内）" required
        ><el-upload
          :auto-upload="false"
          :limit="1"
          :on-change="chooseDocument"
          :on-remove="() => (documentFile = undefined)"
          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
          ><el-button>选择文件</el-button></el-upload
        ></el-form-item
      ></el-form
    ><el-alert
      title="文件进入私有存储；上传不代表已建立检索索引或已获得使用许可。"
      type="info"
      :closable="false"
    /><template #footer
      ><el-button @click="documentOpen = false">取消</el-button
      ><el-button
        v-has-permi="'ai:write'"
        type="primary"
        :loading="documentBusy"
        @click="saveDocument"
        >保存资料</el-button
      ></template
    ></el-dialog
  >
</template>
<style scoped>
.service-note { margin-bottom: 18px; }
.knowledge-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
.knowledge-actions :deep(.el-button) { margin-left: 0; }
.ai-banner {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 28px 30px;
  background: #eeefec;
  border: 1px solid #e0e3db;
  border-radius: 12px;
  margin-bottom: 25px;
}
.ai-orbit {
  display: grid;
  place-items: center;
  width: 74px;
  height: 74px;
  background: #e0e5d9;
  border: 1px solid #d4dccb;
  border-radius: 24px;
  font-size: 36px;
  color: #78836c;
  flex-shrink: 0;
  transform: rotate(-5deg);
}
.ai-orbit .el-icon {
  transform: rotate(5deg);
}
.ai-banner-copy {
  flex: 1;
  min-width: 0;
}
.service-label {
  font-size: 11px;
  letter-spacing: 1px;
  color: #8e927f;
  display: flex;
  align-items: center;
  gap: 8px;
}
.service-label i {
  width: 6px;
  height: 6px;
  background: #b1a16d;
  border-radius: 50%;
}
.ai-banner h2 {
  font-family: serif;
  letter-spacing: 2px;
  font-size: 25px;
  font-weight: 600;
  color: #4e5747;
  margin: 11px 0 9px;
}
.ai-banner p {
  font-size: 13px;
  color: #8d9385;
  line-height: 1.8;
  margin: 0;
}
.ai-badge {
  align-self: flex-start;
  border: 1px solid #c9d1c0;
  color: #7d8971;
  font-size: 11px;
  padding: 5px 9px;
  border-radius: 4px;
  white-space: nowrap;
}
.knowledge-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.knowledge-card {
  padding: 25px;
  border: 1px solid #e7e7de;
  border-radius: 8px;
  min-width: 0;
}
.knowledge-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.knowledge-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  font-size: 25px;
  color: #a68a58;
  background: #f5eedf;
}
.tone-1 {
  background: #f4e8e1;
  color: #a8705b;
}
.tone-2 {
  background: #eaf0e4;
  color: #7a8d66;
}
.knowledge-card h3 {
  font-size: 18px;
  font-weight: 600;
  color: #474e40;
  line-height: 1.6;
  margin: 22px 0 11px;
}
.knowledge-card p {
  font-size: 13px;
  line-height: 1.9;
  color: #939687;
  min-height: 100px;
  margin: 0;
}
.knowledge-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: #a2a693;
  margin-top: 17px;
}
.knowledge-footer {
  border-top: 1px solid #eeeee6;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 5px;
  margin-top: 19px;
  padding-top: 20px;
}
.knowledge-footer strong {
  font-size: 28px;
  color: #606d52;
  font-weight: 500;
  display: block;
}
.knowledge-footer small {
  display: block;
  font-size: 10px;
  color: #989f8c;
  margin-top: 5px;
}
.knowledge-footer .el-button {
  font-size: 12px;
  padding: 0;
}
.knowledge-note {
  display: flex;
  gap: 15px;
  background: #f6f6f1;
  border-radius: 7px;
  padding: 20px;
  margin-top: 22px;
}
.knowledge-note > .el-icon {
  font-size: 23px;
  color: #9fa78f;
  flex-shrink: 0;
}
.knowledge-note b {
  font-size: 13px;
  font-weight: 500;
  color: #6f7861;
}
.knowledge-note p {
  font-size: 12px;
  color: #9a9f8e;
  line-height: 1.8;
  margin: 6px 0 0;
}
.filter-bar .el-input {
  max-width: 370px;
}
.filter-bar .el-select {
  width: 175px;
}
.new-word {
  margin-left: auto;
}
.record-id {
  font-weight: 500;
  font-size: 12px;
}
.record-time {
  display: block;
  margin-top: 6px;
  color: #9ca18f;
  font-size: 11px;
}
.dictionary-note {
  margin-bottom: 20px;
}
.drawer-kicker {
  font-size: 12px;
  color: #a38c63;
  letter-spacing: 1px;
}
.drawer-title {
  font-size: 24px;
  line-height: 1.5;
  margin: 15px 0;
}
.drawer-text {
  font-size: 14px;
  line-height: 1.9;
  color: #8b927f;
  margin-bottom: 26px;
}
.drawer-subtitle {
  font-size: 14px;
  margin: 26px 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.field-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}
.drawer-note {
  margin: 25px 0;
}
.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.conversation-input,
.conversation-output {
  font-size: 14px;
  line-height: 2;
  padding: 19px;
  border-radius: 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.conversation-input {
  background: #f5f4ee;
  color: #757a6c;
}
.conversation-output {
  background: #edf2e8;
  color: #5c6a50;
  margin-bottom: 25px;
  border: 1px solid #e2e9da;
}
.word-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
@media (max-width: 1200px) {
  .knowledge-grid {
    grid-template-columns: 1fr;
  }
  .knowledge-card p {
    min-height: 0;
  }
  .knowledge-card h3 {
    margin-top: 17px;
  }
  .knowledge-footer {
    align-items: center;
  }
}
@media (max-width: 600px) {
  .ai-banner {
    padding: 23px 20px;
    gap: 15px;
    align-items: flex-start;
  }
  .ai-orbit {
    width: 43px;
    height: 43px;
    border-radius: 13px;
    font-size: 23px;
  }
  .ai-badge {
    display: none;
  }
  .ai-banner h2 {
    font-size: 19px;
    letter-spacing: 1px;
    line-height: 1.5;
  }
  .ai-banner p {
    font-size: 12px;
  }
  .knowledge-card {
    padding: 20px;
  }
  .filter-bar .el-input,
  .filter-bar .el-select {
    width: 100%;
    max-width: none;
  }
  .new-word {
    margin-left: 0;
  }
  .word-form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
