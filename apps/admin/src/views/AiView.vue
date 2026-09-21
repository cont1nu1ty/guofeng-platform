<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  Search,
  Plus,
  Collection,
  Connection,
  Document,
  EditPen,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import {
  knowledgeBases,
  aiRecords,
  dictionaryWords,
  saveDictionaryWord,
  toggleDictionaryWord,
  type AiRecord,
  type DictionaryWord,
} from "../domain/operations";
import { matchesRegion } from "../domain/workspace";
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
  selectedBase.value = item;
  baseOpen.value = true;
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
function submitWord() {
  const result = saveDictionaryWord(wordForm);
  if (!result.ok) return ElMessage.warning(result.message);
  ElMessage.success(result.message);
  wordOpen.value = false;
}
function toggleWord(item: DictionaryWord) {
  toggleDictionaryWord(item.id);
  ElMessage.success("词条示例状态已更新，未执行实际内容审核");
}
</script>
<template>
  <PageHeading
    title="AI 运营中心"
    description="围绕知识来源、内容追溯与人工复核，准备可持续的助手运营体系。"
    eyebrow="AI OPERATIONS"
  />
  <div class="ai-banner">
    <div class="ai-orbit">
      <el-icon><Connection /></el-icon>
    </div>
    <div class="ai-banner-copy">
      <span class="service-label"><i></i>服务状态 · 尚未接入模型</span>
      <h2>可信的回答，从有据可循开始</h2>
      <p>
        此处展示预置知识库结构、输入输出样例及词库配置。没有模型推理、OCR、检索或自动审核调用。
      </p>
    </div>
    <span class="ai-badge">原型预览</span>
  </div>
  <section class="panel">
    <el-tabs
      v-model="tab"
      @tab-change="
        query = '';
        mode = '';
      "
      ><el-tab-pane name="knowledge" label="知识库" /><el-tab-pane
        name="records"
        label="调用记录样例" /><el-tab-pane name="dictionary" label="内容词库"
    /></el-tabs>
    <div class="filter-bar">
      <el-input
        v-model="query"
        :placeholder="
          tab === 'knowledge'
            ? '搜索知识库名称'
            : tab === 'records'
              ? '搜索编号、用户或输入输出关键词'
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
          v-for="item in [
            '家书创作',
            '知识问答',
            '文稿审核',
            '家训拟写',
            '手稿校对',
          ]"
          :key="item"
          :value="item"
          :label="item" /></el-select
      ><el-button
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
              base.status
            }}</el-tag>
          </div>
          <h3>{{ base.title }}</h3>
          <p>{{ base.description }}</p>
          <div class="knowledge-meta">
            <span>{{ base.category }}</span
            ><span>{{ base.version }}</span>
          </div>
          <div class="knowledge-footer">
            <div>
              <strong>{{ base.documents }}</strong
              ><small>份预置资料数</small>
            </div>
            <el-button link type="primary" @click="openBase(base)"
              >查看资料结构 →</el-button
            >
          </div>
        </article>
      </div>
      <el-empty
        v-if="!visibleBases.length"
        description="没有符合条件的知识库样例"
      />
      <div class="knowledge-note">
        <el-icon><Document /></el-icon>
        <div>
          <b>知识来源与版本独立记录</b>
          <p>
            正式接入时，将文档来源、使用许可、审校状态与索引版本一并记录。模型与知识库可独立替换，保留人工审核环节。
          </p>
        </div>
      </div></template
    >
    <template v-else-if="tab === 'records'"
      ><el-table :data="visibleRecords" row-key="id"
        ><el-table-column label="记录编号 / 时间" min-width="185"
          ><template #default="{ row }"
            ><b class="record-id">{{ row.id }}</b
            ><small class="record-time">{{ row.time }}</small></template
          ></el-table-column
        ><el-table-column
          prop="user"
          label="示例用户"
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
          ><el-empty description="当前地区没有匹配的预置记录" /></template
      ></el-table>
      <div class="table-tools muted">
        共 {{ visibleRecords.length }} 条预置记录 ·
        以下输入输出均是编写的样例，无真实用户对话。
      </div></template
    >
    <template v-else
      ><el-alert
        class="dictionary-note"
        title="词条仅用于配置讨论，保存或启用不会触发真实审核与拦截。"
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
          min-width="260" /><el-table-column label="示例状态" width="110"
          ><template #default="{ row }"
            ><el-switch
              :model-value="row.enabled"
              :aria-label="`${row.word}启用状态`"
              @change="toggleWord(row)" /></template></el-table-column
        ><el-table-column label="操作" width="90" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="editWord(row)"
              >编辑</el-button
            ></template
          ></el-table-column
        ><template #empty
          ><el-empty
            description="没有匹配的词条，可添加新词条或调整搜索" /></template
      ></el-table>
      <div class="table-tools muted">
        共 {{ visibleWords.length }} 个示例词条
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
          >{{ selectedBase.documents }} 份（预置数值）</el-descriptions-item
        ><el-descriptions-item label="更新日期">{{
          selectedBase.updated
        }}</el-descriptions-item
        ><el-descriptions-item label="当前状态">{{
          selectedBase.status
        }}</el-descriptions-item
        ><el-descriptions-item label="接入方式"
          >待建设 · 私有化知识服务适配</el-descriptions-item
        ></el-descriptions
      >
      <h3 class="drawer-subtitle">后续文档字段</h3>
      <div class="field-tags">
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
        title="本页尚无真实资料文件、上传处理或知识检索。"
        type="info"
        :closable="false" /></template
  ></el-drawer>
  <el-drawer
    v-model="recordOpen"
    title="预置输入输出详情"
    size="min(680px, 100vw)"
    ><template v-if="selectedRecord"
      ><div class="record-header">
        <el-tag>{{ selectedRecord.mode }}</el-tag
        ><span class="muted">{{ selectedRecord.time }}</span>
      </div>
      <p class="muted">
        {{ selectedRecord.id }} · {{ selectedRecord.region }} ·
        {{ selectedRecord.user }}
      </p>
      <h3 class="drawer-subtitle">输入样例</h3>
      <div class="conversation-input">{{ selectedRecord.input }}</div>
      <h3 class="drawer-subtitle">
        <el-icon><EditPen /></el-icon> 预置回复
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
        title="以上是预先编写的对话样例，不是 AI 生成或审核结果。"
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
      ><el-button type="primary" @click="submitWord"
        >保存词条</el-button
      ></template
    ></el-dialog
  >
</template>
<style scoped>
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
