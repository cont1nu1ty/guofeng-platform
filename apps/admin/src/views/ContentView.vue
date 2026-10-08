<script setup lang="ts">
import { selectRecordCollection } from "../services/workspaceData";
import { isHttpMode, modeText } from "../services/mode";

import { saveContent, setContentStatus } from "../services/actions";

import { computed, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Search, Document, Edit, Promotion } from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import CatalogManager from "../components/catalog/CatalogManager.vue";
import HomepageEditor from "../components/catalog/HomepageEditor.vue";
import SupportTickets from "../components/catalog/SupportTickets.vue";
import type { CatalogSection } from "../domain/catalog";
import { command, versionOf } from "../services/workspaceData";
import { connection } from "../services/http";
import Pagination from "../components/upstream/Pagination.vue";
import { workspace, matchesRegion } from "../domain/workspace";
import {
  editorialState,
  editorialRegions,
  contentCategories,
  contentTopics,
  validateContent,
  type ContentItem,
  type ContentDraft,
  type ContentCategory,
} from "../domain/editorial";

const workspaceTab = ref<"articles" | CatalogSection>("articles");
watch(workspaceTab, value => { if(value !== "homepage") void selectRecordCollection(value === "articles" ? "contents" : value); });
const workspaceTabs = {
  articles: "文章资讯",
  banners: "首页轮播",
  homepage: "首页布局",
  mediaItems: "媒体素材",
  venues: "传习阵地",
  hallPeople: "名人馆档案",
  supportTickets: "人工咨询",
};

const category = ref<ContentCategory | "全部">("全部");
const query = ref("");
const status = ref("全部状态");
const page = ref(1);
const limit = ref(10);
const scoped = computed(() =>
  editorialState.contents.filter((item) => matchesRegion(item.region)),
);
const filtered = computed(() =>
  scoped.value.filter(
    (item) =>
      (category.value === "全部" || item.category === category.value) &&
      (status.value === "全部状态" || item.status === status.value) &&
      `${item.title}${item.id}${item.summary}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
);
const visible = computed(() =>
  isHttpMode ? filtered.value : filtered.value.slice((page.value - 1) * limit.value, page.value * limit.value),
);
const published = computed(
  () => scoped.value.filter((item) => item.status === "已发布").length,
);
watch([category, query, status, () => workspace.region, limit], () => {
  page.value = 1;
});
watch(
  () => filtered.value.length,
  (total) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(total / limit.value)));
  },
);
const dialog = ref(false);
const editingId = ref<string>();
const editingVersion = ref<number>();
const error = ref("");
const draft = reactive<ContentDraft>({
  title: "",
  category: "资讯",
  region: "全国",
  language: "简体中文",
  summary: "",
  body: "",
  topic: "everyday",
});
const preview = ref<ContentItem>();
const previewOpen = ref(false);
function edit(item?: ContentItem) {
  editingId.value = item?.id;
  editingVersion.value = versionOf(item?.id, "contents");
  error.value = "";
  Object.assign(
    draft,
    item
      ? {
          title: item.title,
          category: item.category,
          region: item.region,
          language: ["en", "英文", "English"].includes(item.language)
            ? "English"
            : "简体中文",
          summary: item.summary,
          body: item.body,
          topic: item.topic || "everyday",
        }
      : {
          title: "",
          category: category.value === "全部" ? "资讯" : category.value,
          region: workspace.region,
          language: "简体中文",
          summary: "",
          body: "",
          topic: "everyday",
        },
  );
  dialog.value = true;
}
async function save() {
  error.value = validateContent(draft);
  if (error.value) return;
  try {
    if (isHttpMode)
      await command("saveContent", { ...draft }, editingId.value, editingVersion.value);
    else await saveContent(draft, editingId.value);
    dialog.value = false;
    ElMessage.success("内容已保存");
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "保存失败，编辑内容已保留。";
  }
}
function openPreview(item: ContentItem) {
  preview.value = item;
  previewOpen.value = true;
}
async function togglePublish(item: ContentItem) {
  const publishing = item.status !== "已发布";
  try {
    await ElMessageBox.confirm(
      publishing
        ? `发布“${item.title}”？${modeText("发布后用户端可见。", "仅更新本次演示。")}`
        : `下架“${item.title}”？${modeText("下架后用户端不可见。", "仅更新本次演示。")}`,
      publishing ? "发布内容" : "下架内容",
      {
        confirmButtonText: publishing ? "确认发布" : "确认下架",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    await setContentStatus(item, publishing ? "已发布" : "已下架");
    ElMessage.success(publishing ? "内容已发布" : "内容已下架");
  } catch (reason) {
    if (reason instanceof Error) ElMessage.error(reason.message);
  }
}
const tagType = (value: string) =>
  value === "已发布" ? "success" : value === "已下架" ? "info" : "warning";
</script>

<template>
  <div class="content-page">
    <PageHeading
      eyebrow="CONTENT MANAGEMENT"
      title="内容与资讯"
      description="从一篇文章到一个专题，让家风故事被更多人看见。"
    >
      <template #actions
        ><el-button
          v-if="workspaceTab === 'articles'"
          v-has-permi="'content:write'"
          type="primary"
          :icon="Plus"
          @click="edit()"
          >新建内容</el-button
        ></template
      >
    </PageHeading>
    <el-tabs v-model="workspaceTab" class="workspace-tabs"
      ><el-tab-pane
        v-for="(label, key) in workspaceTabs"
        :key="key"
        :name="key"
        :label="label"
    /></el-tabs>
    <template v-if="workspaceTab !== 'articles'">
      <el-alert
        v-if="!isHttpMode"
        title="这些目录使用真实服务维护，请在 HTTP 模式连接后台后操作。"
        type="info"
        :closable="false"
      />
      <HomepageEditor v-else-if="workspaceTab === 'homepage'" />
      <SupportTickets v-else-if="workspaceTab === 'supportTickets'" />
      <CatalogManager v-else :key="workspaceTab" :kind="workspaceTab" />
    </template>
    <template v-else>
      <div class="content-summary">
        <div>
          <span class="summary-icon"
            ><el-icon><Document /></el-icon
          ></span>
          <p>
            <small>内容总量</small><strong>{{ scoped.length }}<em>篇</em></strong>
          </p>
        </div>
        <div>
          <span class="summary-icon green"
            ><el-icon><Promotion /></el-icon
          ></span>
          <p>
            <small>已发布</small><strong>{{ published }}<em>篇</em></strong>
          </p>
        </div>
        <div>
          <span class="summary-icon gold"
            ><el-icon><Edit /></el-icon
          ></span>
          <p>
            <small>待完善草稿</small
            ><strong
              >{{ scoped.filter((item) => item.status === "草稿").length
              }}<em>篇</em></strong
            >
          </p>
        </div>
        <div class="summary-note">
          <span class="note-dot"></span>
          <p>
            内容工作区<small>{{
              modeText("业务数据 · 服务端保存", "示例数据 · 当前会话可编辑")
            }}</small>
          </p>
        </div>
      </div>
      <section class="panel content-panel">
        <div class="content-tabs">
          <el-tabs v-model="category"
            ><el-tab-pane
              v-for="tab in ['全部', ...contentCategories.filter((item) => !isHttpMode || item !== 'Banner' || scoped.some((record) => record.category === 'Banner'))]"
              :key="tab"
              :name="tab"
              :label="`${tab} ${scoped.filter((item) => tab === '全部' || item.category === tab).length}`"
          /></el-tabs>
        </div>
        <div class="filter-bar content-filter">
          <el-input
            v-model="query"
            aria-label="搜索内容"
            placeholder="搜索标题、内容编号或摘要"
            :prefix-icon="Search"
            clearable
            class="search-field"
          />
          <el-select v-model="status" aria-label="内容状态" class="status-field"
            ><el-option
              v-for="option in ['全部状态', '草稿', '已发布', '已下架']"
              :key="option"
              :label="option"
              :value="option"
          /></el-select>
          <span class="filter-total">共 {{ filtered.length }} 条内容</span>
        </div>
        <el-table
          :data="visible"
          class="content-table"
          row-key="id"
          empty-text="暂无匹配内容，试试调整筛选或新建内容"
        >
          <el-table-column label="内容标题" min-width="290"
            ><template #default="{ row }"
              ><div class="title-cell">
                <span class="category-mark">{{
                  row.category === "Banner" ? "图" : row.category.slice(0, 1)
                }}</span>
                <div>
                  <button class="text-title" @click="openPreview(row)">
                    {{ row.title }}</button
                  ><small>{{ row.id }} · {{ row.author }}</small>
                </div>
              </div></template
            ></el-table-column
          >
          <el-table-column prop="category" label="栏目" width="95" />
          <el-table-column prop="region" label="发布范围" width="105" />
          <el-table-column label="状态" width="105"
            ><template #default="{ row }"
              ><el-tag :type="tagType(row.status)" effect="light">{{
                row.status
              }}</el-tag></template
            ></el-table-column
          >
          <el-table-column prop="language" label="语言" width="115" />
          <el-table-column prop="updatedAt" label="最近编辑" min-width="160" />
          <el-table-column label="操作" width="190" fixed="right"
            ><template #default="{ row }"
              ><el-button
                v-has-permi="'content:write'"
                link
                type="primary"
                @click="edit(row)"
                >编辑</el-button
              ><el-button link @click="openPreview(row)">预览</el-button
              ><el-button
                v-has-permi="'content:write'"
                link
                :type="row.status === '已发布' ? 'warning' : 'primary'"
                @click="togglePublish(row)"
                >{{ row.status === "已发布" ? "下架" : "发布" }}</el-button
              ></template
            ></el-table-column
          >
        </el-table>
        <div class="content-mobile-list">
          <article v-for="item in visible" :key="item.id" class="mobile-content-card">
            <div class="mobile-content-meta">
              <span>{{ item.category }} · {{ item.region }}</span
              ><el-tag :type="tagType(item.status)" size="small">{{
                item.status
              }}</el-tag>
            </div>
            <button class="text-title" @click="openPreview(item)">
              {{ item.title }}
            </button>
            <p>{{ item.summary }}</p>
            <small>{{ item.language }} · {{ item.updatedAt }}</small>
            <div class="mobile-content-actions">
              <el-button
                v-has-permi="'content:write'"
                link
                type="primary"
                @click="edit(item)"
                >编辑</el-button
              ><el-button link @click="openPreview(item)">预览</el-button
              ><el-button
                v-has-permi="'content:write'"
                link
                :type="item.status === '已发布' ? 'warning' : 'primary'"
                @click="togglePublish(item)"
                >{{ item.status === "已发布" ? "下架" : "发布" }}</el-button
              >
            </div>
          </article>
          <el-empty v-if="!visible.length" description="暂无匹配内容" />
        </div>
        <Pagination v-if="!isHttpMode"
          v-model:page="page"
          v-model:limit="limit"
          :total="filtered.length"
        />
      </section>
      <p class="page-footnote">
        {{
          modeText(
            "文章按栏目和专区独立编辑；首页轮播、媒体及其他目录在上方对应页签维护。发布状态同步至用户端。",
            "统计为样例；编辑和发布仅在本次演示会话生效。",
          )
        }}
      </p>
      <el-dialog
        v-model="dialog"
        :title="editingId ? '编辑内容' : '新建内容'"
        width="min(680px, 92vw)"
        :close-on-click-modal="false"
      >
        <el-alert
          v-if="error"
          :title="error"
          type="error"
          :closable="false"
          show-icon
          class="form-alert"
        />
        <el-form label-position="top" @submit.prevent="save">
          <el-form-item label="内容标题" required
            ><el-input
              v-model="draft.title"
              placeholder="填写清晰、有辨识度的内容标题"
              maxlength="100"
              show-word-limit
          /></el-form-item>
          <div class="form-columns">
            <el-form-item label="所属栏目" required
              ><el-select v-model="draft.category"
                ><el-option
                  v-for="item in contentCategories.filter((item) => !isHttpMode || item !== 'Banner' || draft.category === 'Banner')"
                  :key="item"
                  :label="item"
                  :value="item" /></el-select></el-form-item
            ><el-form-item label="发布范围" required
              ><el-select v-model="draft.region"
                ><el-option
                  v-for="item in editorialRegions"
                  :key="item"
                  :label="item"
                  :value="item" /></el-select></el-form-item
            ><el-form-item label="内容语言" required
              ><el-select v-model="draft.language"
                ><el-option label="简体中文" value="简体中文" /><el-option
                  label="English"
                  value="English" /></el-select
            ></el-form-item>
          </div>
          <el-form-item label="家风专区"
            ><el-select v-model="draft.topic"
              ><el-option
                v-for="(label, key) in contentTopics"
                :key="key"
                :label="label"
                :value="key" /></el-select
          ></el-form-item>
          <el-form-item label="内容摘要" required
            ><el-input
              v-model="draft.summary"
              type="textarea"
              :rows="2"
              maxlength="500"
              show-word-limit
              placeholder="填写摘要，适合用于列表或卡片展示"
          /></el-form-item>
          <el-form-item label="正文 / 展示文案" required
            ><el-input
              v-model="draft.body"
              type="textarea"
              :rows="7"
              maxlength="50000"
              show-word-limit
              placeholder="填写文章正文，首页轮播请在上方独立页签维护。"
          /></el-form-item>
          <p class="editor-hint">
            不同语言分别维护内容，不会自动翻译。{{
              modeText(
                "保存结果写入服务端，公开状态以后台记录为准。",
                "此次保存仅在当前演示会话生效。",
              )
            }}
          </p>
        </el-form>
        <template #footer
          ><el-button @click="dialog = false">取消</el-button
          ><el-button
            v-has-permi="'content:write'"
            type="primary"
            :loading="connection.pending > 0"
            @click="save"
            >{{ editingId ? "保存修改" : "保存草稿" }}</el-button
          ></template
        >
      </el-dialog>
      <el-drawer v-model="previewOpen" title="内容预览" size="min(720px, 100vw)">
        <article v-if="preview" class="content-preview">
          <div class="preview-meta">
            <el-tag size="small">{{ preview.category }}</el-tag
            ><span>{{ preview.region }} · {{ preview.language }}</span
            ><el-tag :type="tagType(preview.status)" size="small">{{
              preview.status
            }}</el-tag>
          </div>
          <h2>{{ preview.title }}</h2>
          <p class="preview-author">{{ preview.author }} · {{ preview.updatedAt }}</p>
          <p class="preview-summary">{{ preview.summary }}</p>
          <div class="preview-body">{{ preview.body }}</div>
          <el-alert
            title="这是后台内容预览，不代表小程序已发布内容。"
            type="info"
            :closable="false"
          />
        </article>
        <template #footer
          ><el-button @click="previewOpen = false">关闭预览</el-button></template
        >
      </el-drawer>
    </template>
  </div>
</template>

<style scoped>
.workspace-tabs {
  margin-bottom: 18px;
}
.content-panel {
  padding: 0;
}
.content-panel :deep(.pagination-container) {
  margin: 0 24px;
  padding: 20px 0;
}
.content-mobile-list {
  display: none;
}
@media (max-width: 600px) {
  .content-table {
    display: none;
  }
  .content-mobile-list {
    display: block;
    border-top: 1px solid #eeeee7;
  }
  .mobile-content-card {
    padding: 19px 18px;
    border-bottom: 1px solid #eeeee7;
  }
  .mobile-content-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    color: #9b9c8c;
    margin-bottom: 13px;
  }
  .mobile-content-card > .text-title {
    font-size: 14px;
    line-height: 1.9;
  }
  .mobile-content-card > p {
    font-size: 11px;
    line-height: 1.8;
    color: #989e90;
    margin: 8px 0 11px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .mobile-content-card > small {
    font-size: 9px;
    color: #a4aa9a;
  }
  .mobile-content-actions {
    display: flex;
    gap: 20px;
    margin-top: 16px;
  }
  .mobile-content-actions > .el-button {
    font-size: 11px;
  }
  .mobile-content-actions > .el-button + .el-button {
    margin-left: 0;
  }
}
.content-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr) 1.3fr;
  gap: 20px;
  margin-bottom: 25px;
  background: #fff;
  border: 1px solid #e9e5dc;
  border-radius: 12px;
  padding: 22px 26px;
}
.content-summary > div {
  display: flex;
  align-items: center;
  gap: 14px;
}
.summary-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  background: #f8eeee;
  color: #963d36;
  border-radius: 12px;
  font-size: 21px;
}
.summary-icon.green {
  background: #edf3ef;
  color: #567760;
}
.summary-icon.gold {
  background: #faf3e4;
  color: #aa8947;
}
.content-summary p {
  margin: 0;
}
.content-summary small {
  display: block;
  color: #85877f;
  font-size: 12px;
  margin-bottom: 5px;
}
.content-summary strong {
  font-size: 25px;
  font-weight: 600;
  color: #303b33;
}
.content-summary em {
  font-size: 12px;
  font-style: normal;
  color: #999b93;
  margin-left: 7px;
}
.summary-note {
  border-left: 1px solid #eee9e0;
  padding-left: 25px;
  font-size: 14px;
  color: #526153;
}
.summary-note small {
  margin-top: 7px;
  margin-bottom: 0;
}
.note-dot {
  width: 7px;
  height: 7px;
  background: #af935b;
  border-radius: 50%;
}
.content-tabs {
  padding: 4px 24px 0;
}
.content-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.content-tabs :deep(.el-tabs__nav-wrap:after) {
  height: 1px;
  background: #eeeae2;
}
.content-tabs :deep(.el-tabs__item) {
  height: 59px;
}
.content-filter {
  padding: 21px 24px !important;
  margin: 0 !important;
}
.search-field {
  width: 320px;
  max-width: 100%;
}
.status-field {
  width: 140px;
}
.filter-total {
  margin-left: auto;
  font-size: 12px;
  color: #8c9088;
}
.title-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
}
.category-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 40px;
  flex-shrink: 0;
  border: 1px solid #e9e2d5;
  border-radius: 5px;
  background: #f8f5ed;
  color: #9d8051;
  font-family: serif;
  font-size: 16px;
}
.text-title {
  display: block;
  padding: 0;
  text-align: left;
  color: #344138;
  font-size: 13px;
  background: none;
  border: 0;
  cursor: pointer;
  line-height: 1.6;
  font-weight: 600;
}
.text-title:hover {
  color: #a1433b;
}
.title-cell small {
  display: block;
  font-size: 11px;
  color: #9a9b94;
  margin-top: 5px;
}
.content-table :deep(.el-table__cell:first-child) {
  padding-left: 16px;
}
.page-footnote {
  font-size: 12px;
  color: #95988d;
  line-height: 1.8;
  margin-top: 16px;
}
.form-columns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}
.form-alert {
  margin-bottom: 20px;
}
.editor-hint {
  font-size: 12px;
  color: #8d9287;
  line-height: 1.8;
}
.content-preview {
  padding: 12px 12px 20px;
}
.preview-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 12px;
  color: #858a80;
}
.content-preview h2 {
  font-family: "Noto Serif SC", serif;
  color: #354137;
  font-size: 28px;
  line-height: 1.6;
  margin: 25px 0 10px;
}
.preview-author {
  font-size: 12px;
  color: #94978e;
}
.preview-summary {
  padding: 18px 22px;
  background: #f8f5ee;
  border-left: 3px solid #b9985c;
  line-height: 1.9;
  color: #7e7158;
  margin: 28px 0;
}
.preview-body {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 15px;
  line-height: 2.2;
  color: #4e584f;
  margin-bottom: 32px;
}
@media (max-width: 900px) {
  .content-summary {
    grid-template-columns: repeat(3, 1fr);
    padding: 20px;
    gap: 14px;
  }
  .summary-note {
    display: none !important;
  }
}
@media (max-width: 600px) {
  .content-summary {
    padding: 15px 12px;
    gap: 8px;
  }
  .content-summary > div {
    gap: 7px;
  }
  .summary-icon {
    width: 30px;
    height: 34px;
    font-size: 16px;
  }
  .content-summary small {
    font-size: 10px;
  }
  .content-summary strong {
    font-size: 22px;
  }
  .content-summary em {
    display: none;
  }
  .content-tabs {
    padding: 0 14px;
  }
  .content-filter {
    padding: 16px !important;
    gap: 10px !important;
  }
  .search-field {
    width: 100%;
  }
  .status-field {
    width: 140px;
  }
  .filter-total {
    font-size: 11px;
  }
  .form-columns {
    grid-template-columns: 1fr;
  }
  .content-preview {
    padding: 5px;
  }
  .content-preview h2 {
    font-size: 24px;
  }
}
</style>
