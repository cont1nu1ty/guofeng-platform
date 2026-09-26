<script setup lang="ts">
import { isHttpMode, modeText } from "../services/mode";

import {
  saveCollection,
  saveChapter,
  moveChapter,
  collectVolume,
  addSampleChapter,
  importChapter,
} from "../services/actions";

import { computed, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  Reading,
  Edit,
  Collection,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import { workspace, matchesRegion } from "../domain/workspace";
import {
  editorialState,
  editorialRegions,
  validateCollection,
  type CollectionItem,
  type CollectionDraft,
  type Chapter,
} from "../domain/editorial";

import { reviewState } from "../domain/review";
const importOpen = ref(false),
  importId = ref("");
const selectedWorks = computed(() =>
  reviewState.submissions.filter(
    (item) =>
      (item.status === "已入围" ||
        ["shortlisted", "awarded", "collected"].includes(item.result || "")) &&
      (!isHttpMode || item.published),
  ),
);
async function importWork() {
  if (!selected.value || !importId.value) return;
  await importChapter(selected.value.id, importId.value);
  importOpen.value = false;
  ElMessage.success("已添加入选作品章节");
}
const query = ref("");
const status = ref("全部分卷");
const filtered = computed(() =>
  editorialState.collections.filter(
    (item) =>
      matchesRegion(item.region) &&
      (status.value === "全部分卷" || status.value === item.status) &&
      `${item.title}${item.subtitle}${item.theme}`.includes(query.value.trim()),
  ),
);
const scoped = computed(() =>
  editorialState.collections.filter((item) => matchesRegion(item.region)),
);
const dialog = ref(false);
const editingId = ref<string>();
const error = ref("");
const draft = reactive<CollectionDraft>({
  title: "",
  subtitle: "",
  region: "全国",
  theme: "",
});
const selected = ref<CollectionItem>();
const detailOpen = ref(false);
const detailTab = ref("chapters");
const activeChapter = ref(0);
const chapterDialog = ref(false);
const chapterId = ref<string>();
const chapterError = ref("");
const chapterDraft = reactive({ title: "", author: "", body: "" });
const readingChapter = computed(
  () => selected.value?.chapters[activeChapter.value],
);

function editVolume(item?: CollectionItem) {
  editingId.value = item?.id;
  error.value = "";
  Object.assign(
    draft,
    item
      ? {
          title: item.title,
          subtitle: item.subtitle,
          region: item.region,
          theme: item.theme,
        }
      : { title: "", subtitle: "", region: workspace.region, theme: "" },
  );
  dialog.value = true;
}
async function saveVolume() {
  error.value = validateCollection(draft);
  if (error.value) return;
  await saveCollection(draft, editingId.value);
  dialog.value = false;
  ElMessage.success("分卷已保存");
}
function openDetail(item: CollectionItem, tab = "chapters") {
  selected.value = item;
  detailTab.value = tab;
  activeChapter.value = 0;
  detailOpen.value = true;
}
function editChapter(item?: Chapter) {
  chapterId.value = item?.id;
  chapterError.value = "";
  Object.assign(
    chapterDraft,
    item
      ? { title: item.title, author: item.author, body: item.body }
      : { title: "", author: "", body: "" },
  );
  chapterDialog.value = true;
}
async function saveChapterDraft() {
  if (!selected.value) return;
  try {
    await saveChapter(selected.value, chapterDraft, chapterId.value);
    chapterDialog.value = false;
    ElMessage.success("章节已保存，分卷进入编纂中状态");
  } catch (reason) {
    if (reason instanceof Error) chapterError.value = reason.message;
  }
}
async function addSample() {
  if (!selected.value) return;
  if (isHttpMode) {
    importId.value = "";
    importOpen.value = true;
    return;
  }
  try {
    await addSampleChapter(selected.value);
    ElMessage.success("已将入选作品样例加入本卷末尾");
  } catch (reason) {
    if (reason instanceof Error) ElMessage.warning(reason.message);
  }
}
async function publish(item: CollectionItem) {
  try {
    await ElMessageBox.confirm(
      `将《${item.title}》的 ${item.chapters.length} 个章节标记为已入藏？数字典藏发布不产生正式出版或版权登记效力。`,
      "确认入藏",
      { confirmButtonText: "确认入藏", cancelButtonText: "取消", type: "info" },
    );
    await collectVolume(item);
    ElMessage.success("已标记为已入藏");
  } catch (reason) {
    if (reason instanceof Error) ElMessage.error(reason.message);
  }
}
</script>

<template>
  <div class="collections-page">
    <PageHeading
      eyebrow="CULTURAL COLLECTION"
      title="典籍编纂"
      description="以总典为纲、地方为卷，将散落的家风记忆编织成册。"
      ><template #actions
        ><el-button
          v-has-permi="'collections:write'"
          type="primary"
          :icon="Plus"
          @click="editVolume()"
          >新建分卷</el-button
        ></template
      ></PageHeading
    >
    <section class="collection-intro">
      <div class="intro-copy">
        <span class="intro-label">家风中华行 · 数字典藏</span>
        <h2>一卷家风，传续文脉。</h2>
        <p>从作品入选到章节编排，让每一份珍贵的家风记忆有序留存。</p>
        <div class="intro-stats">
          <span
            ><strong>{{ scoped.length }}</strong> 部典籍分卷</span
          ><i></i
          ><span
            ><strong>{{
              scoped.reduce((sum, item) => sum + item.chapters.length, 0)
            }}</strong>
            篇编纂章节</span
          >
        </div>
      </div>
      <div class="intro-decoration" aria-hidden="true">
        <span>传</span><span>承</span>
        <div>文脉绵长 · 家国同心</div>
      </div>
    </section>
    <div class="collection-toolbar">
      <h3>
        典籍书架 <span>{{ filtered.length }}</span>
      </h3>
      <div>
        <el-input
          v-model="query"
          placeholder="搜索卷名或主题"
          :prefix-icon="Search"
          clearable
          aria-label="搜索典籍"
        /><el-select v-model="status" aria-label="编纂状态"
          ><el-option
            v-for="item in ['全部分卷', '编纂中', '已入藏']"
            :key="item"
            :label="item"
            :value="item"
        /></el-select>
      </div>
    </div>
    <div v-if="filtered.length" class="volume-grid">
      <article v-for="item in filtered" :key="item.id" class="volume-card">
        <button
          class="book-scene"
          :style="{ '--book-color': item.color }"
          @click="openDetail(item, 'preview')"
          :aria-label="`预览${item.title}`"
        >
          <div class="book-spine"></div>
          <div class="book-cover">
            <div class="book-border">
              <span class="book-series">家风中华行</span
              ><strong>{{ item.title }}</strong
              ><small>{{
                item.region === "全国"
                  ? "全 国 总 典"
                  : item.region.replace("省", "") + " 地 方 卷"
              }}</small
              ><span class="book-seal">家<br />风</span>
            </div>
          </div>
          <div class="book-paper"></div>
        </button>
        <div class="volume-info">
          <div class="volume-head">
            <h3>{{ item.title }}</h3>
            <el-tag
              :type="item.status === '已入藏' ? 'success' : 'warning'"
              size="small"
              >{{ item.status }}</el-tag
            >
          </div>
          <p>{{ item.subtitle }}</p>
          <div class="volume-meta">
            <span>{{ item.chapters.length }} 篇章节</span
            ><span>{{ item.theme }}</span>
          </div>
          <div class="volume-footer">
            <span>{{ item.updatedAt }} 更新</span
            ><el-button link type="primary" @click="openDetail(item)"
              >编纂管理 <el-icon><Edit /></el-icon
            ></el-button>
          </div>
        </div>
      </article>
    </div>
    <section v-else class="panel">
      <el-empty description="暂无匹配分卷，可调整筛选或开始编纂新卷"
        ><el-button
          v-has-permi="'collections:write'"
          type="primary"
          @click="editVolume()"
          >新建分卷</el-button
        ></el-empty
      >
    </section>
    <div class="collection-note">
      <el-icon><Collection /></el-icon>
      <p>
        {{
          modeText(
            "章节顺序、内容与入藏状态保存至服务端；数字典藏发布不构成正式出版或版权登记。",
            "编纂工作区使用原创选读样例。章节顺序与入藏状态仅在本次会话生效，正式出版、版权与批量导出留待后续接入。",
          )
        }}
      </p>
    </div>

    <el-dialog
      v-model="dialog"
      :title="editingId ? '编辑分卷信息' : '新建典籍分卷'"
      width="min(680px, 92vw)"
      :close-on-click-modal="false"
    >
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        class="form-alert"
        show-icon
      />
      <el-form label-position="top"
        ><el-form-item label="分卷名称" required
          ><el-input
            v-model="draft.title"
            maxlength="30"
            show-word-limit
            placeholder="例如：江南家书" /></el-form-item
        ><el-form-item label="分卷副标题" required
          ><el-input
            v-model="draft.subtitle"
            maxlength="50"
            show-word-limit
            placeholder="例如：浙江卷 · 书信里的家国"
        /></el-form-item>
        <div class="form-columns">
          <el-form-item label="所属地区" required
            ><el-select v-model="draft.region"
              ><el-option
                v-for="item in editorialRegions"
                :key="item"
                :label="item"
                :value="item" /></el-select></el-form-item
          ><el-form-item label="编纂主题" required
            ><el-input
              v-model="draft.theme"
              maxlength="20"
              placeholder="例如：清廉家书"
          /></el-form-item></div
      ></el-form>
      <template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button
          v-has-permi="'collections:write'"
          type="primary"
          @click="saveVolume"
          >保存分卷</el-button
        ></template
      >
    </el-dialog>

    <el-drawer
      v-model="detailOpen"
      title="典籍编纂工作区"
      size="min(720px, 100vw)"
    >
      <template v-if="selected"
        ><div class="drawer-volume-head">
          <div>
            <span>{{ selected.region }} · {{ selected.theme }}</span>
            <h2>{{ selected.title }}</h2>
            <p>{{ selected.subtitle }}</p>
          </div>
          <el-tag
            :type="selected.status === '已入藏' ? 'success' : 'warning'"
            >{{ selected.status }}</el-tag
          >
        </div>
        <el-tabs v-model="detailTab"
          ><el-tab-pane label="目录编排" name="chapters" /><el-tab-pane
            label="阅读预览"
            name="preview"
        /></el-tabs>
        <div v-if="detailTab === 'chapters'">
          <div class="chapter-tools">
            <span>共 {{ selected.chapters.length }} 个章节</span>
            <div>
              <el-button
                v-has-permi="'collections:write'"
                size="small"
                @click="addSample"
                >{{ modeText("加入入选作品", "加入入选样例") }}</el-button
              ><el-button
                v-has-permi="'collections:write'"
                size="small"
                type="primary"
                :icon="Plus"
                @click="editChapter()"
                >新建章节</el-button
              >
            </div>
          </div>
          <div
            v-for="(chapter, index) in selected.chapters"
            :key="chapter.id"
            class="chapter-row"
          >
            <span class="chapter-number">{{
              String(index + 1).padStart(2, "0")
            }}</span>
            <div class="chapter-title">
              <strong>{{ chapter.title }}</strong
              ><small
                >{{ chapter.author }} · {{ chapter.body.length }} 字</small
              >
            </div>
            <div class="chapter-actions">
              <el-button
                v-has-permi="'collections:write'"
                text
                circle
                :icon="ArrowUp"
                :disabled="index === 0"
                :aria-label="`上移${chapter.title}`"
                @click="moveChapter(selected, index, -1)"
              /><el-button
                v-has-permi="'collections:write'"
                text
                circle
                :icon="ArrowDown"
                :disabled="index === selected.chapters.length - 1"
                :aria-label="`下移${chapter.title}`"
                @click="moveChapter(selected, index, 1)"
              /><el-button
                v-has-permi="'collections:write'"
                link
                type="primary"
                @click="editChapter(chapter)"
                >编辑</el-button
              >
            </div>
          </div>
          <el-empty
            v-if="!selected.chapters.length"
            description="分卷还没有章节，请添加章节或已入选作品"
          />
          <p class="chapter-note">
            调整章节后进入“编纂中”，完成后可再次确认入藏。每次排序完成后保留。
          </p>
          <el-button
            v-has-permi="'collections:write'"
            :icon="Edit"
            @click="editVolume(selected)"
            >编辑分卷信息</el-button
          >
        </div>
        <div v-else class="reading-preview">
          <el-select
            v-if="selected.chapters.length"
            v-model="activeChapter"
            aria-label="阅读章节"
            ><el-option
              v-for="(chapter, index) in selected.chapters"
              :key="chapter.id"
              :label="chapter.title"
              :value="index"
          /></el-select>
          <article v-if="readingChapter">
            <div class="reading-label">
              <el-icon><Reading /></el-icon> 数字典藏 · 阅读样张
            </div>
            <h2>{{ readingChapter.title }}</h2>
            <p class="reading-author">{{ readingChapter.author }}</p>
            <div class="reading-body">{{ readingChapter.body }}</div>
            <footer>
              — {{ selected.title }} · 第 {{ activeChapter + 1 }} 章 —
            </footer>
          </article>
          <el-empty v-else description="添加章节后可查看阅读预览" />
        </div>
      </template>
      <template #footer
        ><div class="drawer-footer">
          <el-button @click="detailOpen = false">关闭</el-button
          ><el-button
            v-has-permi="'collections:write'"
            v-if="selected"
            type="primary"
            :disabled="selected.status === '已入藏'"
            @click="publish(selected)"
            >{{
              selected.status === "已入藏" ? "已入藏（演示）" : "确认入藏"
            }}</el-button
          >
        </div></template
      >
    </el-drawer>
    <el-dialog
      v-model="chapterDialog"
      :title="chapterId ? '编辑章节' : '新建章节'"
      width="min(680px, 92vw)"
      :close-on-click-modal="false"
      append-to-body
      ><el-alert
        v-if="chapterError"
        :title="chapterError"
        type="error"
        :closable="false"
        show-icon
        class="form-alert"
      /><el-form label-position="top"
        ><el-form-item label="章节名称" required
          ><el-input
            v-model="chapterDraft.title"
            maxlength="50"
            placeholder="例如：第一章 · 以诚立家" /></el-form-item
        ><el-form-item label="作品署名" required
          ><el-input
            v-model="chapterDraft.author"
            maxlength="40"
            placeholder="填写作品署名" /></el-form-item
        ><el-form-item label="章节正文" required
          ><el-input
            v-model="chapterDraft.body"
            type="textarea"
            :rows="9"
            maxlength="10000"
            show-word-limit
            placeholder="填写 10–10000 字的章节内容" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="chapterDialog = false">取消</el-button
        ><el-button
          v-has-permi="'collections:write'"
          type="primary"
          @click="saveChapterDraft"
          >保存章节</el-button
        ></template
      ></el-dialog
    >
    <el-dialog
      v-model="importOpen"
      title="添加已入选作品"
      width="min(520px,94vw)"
      ><el-select
        v-model="importId"
        placeholder="选择已入选作品"
        filterable
        style="width: 100%"
        ><el-option
          v-for="work in selectedWorks"
          :key="work.id"
          :value="work.id"
          :label="work.title" /></el-select
      ><el-empty
        v-if="!selectedWorks.length"
        description="暂无可添加的入选作品"
      /><template #footer
        ><el-button @click="importOpen = false">取消</el-button
        ><el-button
          v-has-permi="'collections:write'"
          type="primary"
          :disabled="!importId"
          @click="importWork"
          >添加到本卷</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>

<style scoped>
.collection-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  position: relative;
  min-height: 210px;
  padding: 33px 40px;
  background: #eee9dc;
  border: 1px solid #e4dcc8;
  border-radius: 12px;
  margin-bottom: 29px;
}
.intro-label {
  font-size: 11px;
  letter-spacing: 3px;
  color: #99815b;
}
.intro-copy h2 {
  font-family: "Noto Serif SC", serif;
  font-size: 29px;
  font-weight: 500;
  letter-spacing: 3px;
  margin: 13px 0;
  color: #4a5140;
}
.intro-copy p {
  font-size: 13px;
  color: #848676;
  margin: 0;
  line-height: 1.8;
}
.intro-stats {
  display: flex;
  align-items: center;
  gap: 19px;
  margin-top: 25px;
  font-size: 11px;
  color: #8a8b7a;
}
.intro-stats strong {
  font-size: 22px;
  font-weight: 500;
  color: #555d47;
  margin-right: 7px;
}
.intro-stats i {
  height: 17px;
  width: 1px;
  background: #c8c8b6;
}
.intro-decoration {
  position: relative;
  flex-shrink: 0;
  height: 178px;
  width: 250px;
  display: flex;
  gap: 15px;
  align-items: center;
  justify-content: center;
  border: 1px solid #dcd2b9;
  border-radius: 50%;
}
.intro-decoration:before {
  content: "";
  position: absolute;
  inset: 9px;
  border: 1px solid #dcd2b9;
  border-radius: 50%;
}
.intro-decoration > span {
  font-family: serif;
  font-size: 65px;
  color: #b4a788;
  writing-mode: vertical-rl;
  z-index: 1;
}
.intro-decoration > span:nth-child(2) {
  margin-top: 32px;
}
.intro-decoration > div {
  position: absolute;
  bottom: 13px;
  right: -20px;
  font-size: 10px;
  letter-spacing: 3px;
  color: #a0967c;
  background: #eee9dc;
  padding: 5px;
}
.collection-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.collection-toolbar h3 {
  font-size: 15px;
  font-weight: 600;
  color: #3e4b3e;
  margin: 0;
  white-space: nowrap;
}
.collection-toolbar h3 span {
  background: #e9ece5;
  border-radius: 4px;
  font-size: 11px;
  padding: 2px 7px;
  margin-left: 8px;
  color: #83907b;
}
.collection-toolbar > div {
  display: flex;
  gap: 12px;
}
.collection-toolbar .el-input {
  width: 235px;
}
.collection-toolbar .el-select {
  width: 140px;
}
.volume-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
}
.volume-card {
  background: #fff;
  border: 1px solid #e7e3da;
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.volume-card:hover {
  box-shadow: 0 8px 22px #3f4b3610;
}
.book-scene {
  background: linear-gradient(130deg, #eeeae1, #f7f4ee);
  height: 248px;
  width: 100%;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}
.book-cover {
  width: 132px;
  height: 195px;
  background: var(--book-color);
  box-shadow: 10px 12px 16px #272c2929;
  transform: rotate(-5deg);
  border-radius: 2px 3px 3px 1px;
  position: relative;
  z-index: 2;
  padding: 10px 12px;
}
.book-spine {
  position: absolute;
  left: calc(50% - 80px);
  height: 195px;
  width: 14px;
  background: var(--book-color);
  transform: rotate(-5deg);
  filter: brightness(0.85);
  border-radius: 2px 0 0 2px;
}
.book-border {
  height: 100%;
  border: 1px solid #d4be8970;
  position: relative;
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 12px 4px;
}
.book-series {
  font-size: 7px;
  letter-spacing: 2px;
  color: #d9c9a4;
}
.book-border strong {
  font-family: "Noto Serif SC", serif;
  writing-mode: vertical-rl;
  font-size: 25px;
  letter-spacing: 6px;
  color: #ead9b2;
  font-weight: 500;
  margin-top: 13px;
}
.book-border small {
  position: absolute;
  left: 10px;
  top: 46px;
  writing-mode: vertical-rl;
  font-size: 7px;
  letter-spacing: 3px;
  color: #d0c39f;
}
.book-seal {
  position: absolute;
  bottom: 8px;
  right: 8px;
  border: 1px solid #c3a772;
  font-size: 8px;
  line-height: 1.1;
  color: #ddc99a;
  padding: 2px;
}
.book-paper {
  height: 190px;
  width: 8px;
  position: absolute;
  left: calc(50% + 65px);
  transform: rotate(-5deg);
  background: repeating-linear-gradient(
    to right,
    #c8c1af 0px,
    #f2ede0 1px,
    #f2ede0 2px
  );
  z-index: 1;
}
.volume-info {
  padding: 21px 18px 15px;
}
.volume-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.volume-head h3 {
  font-size: 17px;
  font-family: serif;
  letter-spacing: 1px;
  color: #344338;
  margin: 0;
}
.volume-info > p {
  font-size: 11px;
  color: #929487;
  margin: 10px 0 17px;
}
.volume-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.volume-meta span {
  font-size: 10px;
  padding: 4px 7px;
  background: #f7f7f3;
  border-radius: 3px;
  color: #8b9080;
}
.volume-footer {
  border-top: 1px solid #f0eee8;
  margin-top: 18px;
  padding-top: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.volume-footer > span {
  font-size: 9px;
  color: #aaad9f;
}
.volume-footer .el-button {
  font-size: 11px;
}
.volume-footer .el-icon {
  margin-left: 4px;
}
.collection-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 20px 0;
  color: #929787;
  font-size: 12px;
  line-height: 1.8;
}
.collection-note > .el-icon {
  margin-top: 3px;
}
.collection-note p {
  margin: 0;
}
.form-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}
.form-alert {
  margin-bottom: 20px;
}
.drawer-volume-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 0 17px;
}
.drawer-volume-head span {
  font-size: 12px;
  color: #9b8967;
}
.drawer-volume-head h2 {
  font-family: serif;
  font-size: 30px;
  color: #3c4b3e;
  font-weight: 500;
  letter-spacing: 3px;
  margin: 14px 0;
}
.drawer-volume-head p {
  font-size: 13px;
  color: #8d9686;
  margin: 0;
}
.chapter-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin: 15px 0 23px;
}
.chapter-tools > span {
  font-size: 12px;
  color: #93998c;
}
.chapter-row {
  display: flex;
  align-items: center;
  gap: 15px;
  border: 1px solid #eeeae1;
  border-radius: 7px;
  padding: 18px 13px;
  margin: 12px 0;
}
.chapter-number {
  font-size: 15px;
  color: #ad9468;
}
.chapter-title {
  flex: 1;
  min-width: 0;
}
.chapter-title strong {
  font-size: 13px;
  color: #485541;
  font-weight: 500;
}
.chapter-title small {
  display: block;
  font-size: 11px;
  color: #9da092;
  margin-top: 9px;
}
.chapter-actions {
  display: flex;
  align-items: center;
  gap: 0;
}
.chapter-actions .el-button + .el-button {
  margin-left: 3px;
}
.chapter-note {
  font-size: 12px;
  color: #999d91;
  line-height: 1.9;
  margin: 23px 0;
}
.reading-preview > .el-select {
  margin: 10px 0 20px;
}
.reading-preview article {
  padding: 30px 30px 25px;
  background: #f8f5ec;
  border: 1px solid #e9e2d1;
  border-radius: 5px;
}
.reading-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #a38b5a;
  font-size: 10px;
  letter-spacing: 2px;
}
.reading-preview article h2 {
  font-family: serif;
  color: #4a5140;
  text-align: center;
  font-size: 24px;
  margin-top: 25px;
  line-height: 1.8;
}
.reading-author {
  text-align: center;
  color: #919582;
  font-size: 11px;
}
.reading-body {
  white-space: pre-wrap;
  font-family: serif;
  font-size: 16px;
  line-height: 2.3;
  color: #5d6253;
  margin-top: 35px;
  word-break: break-word;
}
.reading-preview footer {
  text-align: center;
  font-size: 11px;
  color: #ada68f;
  margin-top: 45px;
}
.drawer-footer {
  display: flex;
  justify-content: flex-end;
}
@media (min-width: 1500px) {
  .book-scene {
    height: 280px;
  }
}
@media (max-width: 1200px) {
  .volume-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .book-scene {
    height: 250px;
  }
}
@media (max-width: 700px) {
  .collection-intro {
    padding: 26px 22px;
    min-height: 190px;
  }
  .intro-copy h2 {
    font-size: 23px;
    letter-spacing: 1px;
  }
  .intro-decoration {
    display: none;
  }
  .intro-stats {
    gap: 13px;
    margin-top: 20px;
  }
  .collection-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .collection-toolbar > div {
    width: 100%;
    gap: 8px;
  }
  .collection-toolbar .el-input {
    flex: 1;
    min-width: 0;
    width: 0;
  }
  .collection-toolbar .el-select {
    width: 116px;
  }
  .volume-grid {
    gap: 12px;
  }
  .volume-info {
    padding: 16px 11px 12px;
  }
  .volume-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .volume-head h3 {
    font-size: 17px;
  }
  .volume-info > p {
    font-size: 10px;
    line-height: 1.7;
    min-height: 34px;
  }
  .volume-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
  }
  .book-scene {
    height: 220px;
  }
  .book-cover {
    width: 105px;
    height: 168px;
    padding: 8px;
  }
  .book-spine {
    left: calc(50% - 66px);
    height: 168px;
  }
  .book-paper {
    left: calc(50% + 52px);
    height: 164px;
  }
  .book-border strong {
    font-size: 21px;
    letter-spacing: 4px;
  }
  .book-border small {
    left: 6px;
    font-size: 6px;
    letter-spacing: 2px;
  }
  .book-series {
    font-size: 6px;
    letter-spacing: 1px;
  }
  .chapter-tools {
    align-items: flex-start;
    flex-direction: column;
  }
  .chapter-row {
    gap: 10px;
    flex-wrap: wrap;
  }
  .chapter-actions {
    margin-left: auto;
  }
  .chapter-title {
    min-width: 180px;
  }
  .form-columns {
    grid-template-columns: 1fr;
  }
  .reading-preview article {
    padding: 25px 16px;
  }
}
</style>
