<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Search } from "@element-plus/icons-vue";
import {
  catalogState,
  catalogDefinitions,
  newCatalogDraft,
  catalogPayload,
  validateCatalog,
  type CatalogKind,
  type CatalogItem,
} from "../../domain/catalog";
import { editorialState } from "../../domain/editorial";
import { courses } from "../../domain/operations";
import { reviewState } from "../../domain/review";
import { workspace, matchesRegion, regions } from "../../domain/workspace";
import { command } from "../../services/workspaceData";
import { api, connection } from "../../services/http";
import CatalogAssetField from "./CatalogAssetField.vue";
import MediaAccessibilityEditor from "./MediaAccessibilityEditor.vue";
import VenueAreaEditor from "./VenueAreaEditor.vue";
const accessibilityId = ref("");
const areaVenue = ref<CatalogItem>();

const props = defineProps<{ kind: CatalogKind }>();
const definition = computed(() => catalogDefinitions[props.kind]);
const query = ref(""),
  language = ref(""),
  status = ref("");
const list = computed(() =>
  catalogState[props.kind]
    .filter(
      (item) =>
        matchesRegion(item.region) &&
        (!language.value || item.language === language.value) &&
        (!status.value || item.status === status.value) &&
        `${item.title} ${item.excerpt || item.description || ""}`
          .toLowerCase()
          .includes(query.value.trim().toLowerCase()),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder),
);
const open = ref(false),
  preview = ref<CatalogItem>(),
  previewOpen = ref(false),
  error = ref("");
const editingId = ref<string>(),
  editingVersion = ref<number>();
const form = reactive<Record<string, any>>({});
const uploadingFields = reactive(new Set<string>());
const previewAssets = reactive({
  source: "",
  poster: "",
  cover: "",
  error: "",
  loading: false,
});
let previewEpoch = 0;
const busy = computed(() => connection.pending > 0 || uploadingFields.size > 0);
function edit(item?: CatalogItem) {
  editingId.value = item?.id;
  editingVersion.value = item?.lockVersion;
  error.value = "";
  Object.keys(form).forEach((key) => delete form[key]);
  Object.assign(
    form,
    newCatalogDraft(props.kind, workspace.region),
    item || {},
  );
  open.value = true;
}
watch(
  () => props.kind,
  () => {
    open.value = false;
    previewOpen.value = false;
    query.value = "";
    status.value = "";
  },
);
async function save() {
  error.value = validateCatalog(props.kind, form);
  if (error.value || busy.value) return;
  try {
    await command(
      definition.value.save,
      catalogPayload(props.kind, form),
      editingId.value,
      editingVersion.value,
    );
    open.value = false;
    ElMessage.success("已保存为草稿，请核对后另行发布。");
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "保存失败，编辑内容已保留。";
  }
}
async function publish(item: CatalogItem) {
  const next = item.status === "已发布" ? "已下架" : "已发布";
  try {
    await ElMessageBox.confirm(
      next === "已发布"
        ? `确认发布“${item.title}”的${item.language === "en" ? "英文" : "中文"}版本？轮播还会受展示时间和关联目标状态限制。`
        : `确认下架“${item.title}”？用户端将不再展示。`,
      next === "已发布" ? "发布内容" : "下架内容",
      { confirmButtonText: "确认", cancelButtonText: "取消", type: "warning" },
    );
    await command(
      definition.value.publish,
      { status: next },
      item.id,
      item.lockVersion,
    );
    ElMessage.success(next === "已发布" ? "发布状态已保存" : "已下架");
  } catch (reason) {
    if (reason instanceof Error) ElMessage.error(reason.message);
  }
}
async function returnMedia(item: CatalogItem) {
  try {
    const { value } = await ElMessageBox.prompt(
      "请说明需要修改的内容，投稿人可查看意见后重新提交。",
      "退回媒体投稿",
      {
        inputType: "textarea",
        inputValidator: (value: string) =>
          value?.trim().length >= 5 || "请填写至少5个字的退回意见",
        confirmButtonText: "确认退回",
        cancelButtonText: "取消",
      },
    );
    await command(
      "setMediaStatus",
      { status: "已退回", reviewNote: value.trim() },
      item.id,
      item.lockVersion,
    );
    ElMessage.success("已退回，意见已保存。");
  } catch (reason) {
    if (reason instanceof Error) ElMessage.error(reason.message);
  }
}
const targetOptions = computed(() => {
  if (props.kind === "venues")
    return editorialState.activities.filter((x) => x.status !== "草稿");
  const source: Record<
    string,
    { id: string; title: string; status?: string; published?: boolean }[]
  > = {
    news: editorialState.contents.filter((x) => x.status === "已发布"),
    library: editorialState.collections.filter((x) => x.status === "已入藏"),
    learning: editorialState.activities.filter((x) => x.status !== "草稿"),
    classroom: courses.filter((x) => x.status === "已上架"),
    media: catalogState.mediaItems.filter((x) => x.status === "已发布"),
    hall: catalogState.hallPeople.filter((x) => x.status === "已发布"),
    venues: catalogState.venues.filter((x) => x.status === "已发布"),
    review: reviewState.submissions.filter((x) => (x as any).published),
  };
  return source[form.targetScreen] || [];
});
async function previewItem(item: CatalogItem) {
  preview.value = item;
  previewOpen.value = true;
  Object.assign(previewAssets, {
    source: "",
    poster: "",
    cover: "",
    error: "",
    loading: true,
  });
  const epoch = ++previewEpoch;
  try {
    for (const [field, target] of [
      ["sourceFileId", "source"],
      ["posterFileId", "poster"],
      ["coverFileId", "cover"],
    ] as const) {
      if (!item[field]) continue;
      const result = await api<{ url: string }>(
        `/files/${encodeURIComponent(item[field])}/download`,
      );
      if (epoch !== previewEpoch) return;
      previewAssets[target] = result.url;
    }
  } catch (reason) {
    if (epoch === previewEpoch)
      previewAssets.error =
        reason instanceof Error ? reason.message : "预览文件暂时无法读取。";
  } finally {
    if (epoch === previewEpoch) previewAssets.loading = false;
  }
}
watch(previewOpen, (value) => {
  if (!value) {
    previewEpoch++;
    Object.assign(previewAssets, {
      source: "",
      poster: "",
      cover: "",
      error: "",
      loading: false,
    });
  }
});
const previewFields = computed(() =>
  definition.value.fields.filter(
    (x) =>
      x.type !== "asset" && x.type !== "target" && !!preview.value?.[x.name],
  ),
);
function displayField(name: string, value: any) {
  const field = definition.value.fields.find((x) => x.name === name);
  return field?.options?.[value] || value;
}
</script>
<template>
  <section class="panel catalog-manager">
    <div class="catalog-toolbar">
      <div>
        <h2>{{ definition.title }}</h2>
        <p>每种语言独立维护。保存进入草稿，发布后按地区和配置展示。</p>
      </div>
      <el-button
        v-has-permi="'content:write'"
        type="primary"
        :icon="Plus"
        @click="edit()"
        >新建{{ definition.singular }}</el-button
      >
    </div>
    <div class="catalog-filters">
      <el-input
        v-model="query"
        :prefix-icon="Search"
        clearable
        placeholder="搜索标题或说明"
        aria-label="搜索目录内容"
      />
      <el-select
        v-model="language"
        clearable
        placeholder="全部语言"
        aria-label="目录语言"
        ><el-option label="中文" value="zh" /><el-option
          label="English"
          value="en"
      /></el-select>
      <el-select
        v-model="status"
        clearable
        placeholder="全部状态"
        aria-label="目录状态"
        ><el-option
          v-for="value in kind === 'mediaItems'
            ? ['草稿', '待审核', '已退回', '已发布', '已下架']
            : ['草稿', '已发布', '已下架']"
          :key="value"
          :label="value"
          :value="value"
      /></el-select>
    </div>
    <el-table
      :data="list"
      row-key="id"
      empty-text="暂无内容，可以新建草稿或调整筛选"
    >
      <el-table-column label="标题" min-width="230"
        ><template #default="{ row }"
          ><el-button
            link
            type="primary"
            class="catalog-title"
            @click="previewItem(row)"
            >{{ row.title }}</el-button
          >
          <p class="row-meta">
            {{ displayField("category", row.category) || row.theme
            }}<span v-if="row.sample"> · 虚构展示内容</span
            ><span v-if="kind === 'mediaItems' && row.authorName">
              · {{ row.authorName }}</span
            >
          </p>
          <p
            v-if="kind === 'banners' && (row.startsAt || row.endsAt)"
            class="row-meta"
          >
            {{
              row.startsAt
                ? new Date(row.startsAt).toLocaleString()
                : "不限开始"
            }}
            —
            {{
              row.endsAt ? new Date(row.endsAt).toLocaleString() : "不限结束"
            }}
          </p></template
        ></el-table-column
      >
      <el-table-column label="语言" width="100"
        ><template #default="{ row }">{{
          row.language === "en" ? "English" : "中文"
        }}</template></el-table-column
      >
      <el-table-column prop="region" label="地区" width="110" />
      <el-table-column prop="sortOrder" label="排序" width="75" />
      <el-table-column label="状态" width="100"
        ><template #default="{ row }"
          ><el-tag
            :type="
              row.status === '已发布'
                ? 'success'
                : row.status === '已退回'
                  ? 'danger'
                  : 'info'
            "
            >{{ row.status }}</el-tag
          ></template
        ></el-table-column
      >
      <el-table-column label="操作" min-width="210" fixed="right"
        ><template #default="{ row }"
          ><el-button
            v-has-permi="'content:write'"
            link
            type="primary"
            :disabled="busy"
            @click="edit(row)"
            >编辑</el-button
          ><el-button
            v-has-permi="'content:write'"
            link
            :type="row.status === '已发布' ? 'warning' : 'primary'"
            :disabled="busy"
            @click="publish(row)"
            >{{ row.status === "已发布" ? "下架" : "发布" }}</el-button
          ><el-button
            v-if="kind === 'mediaItems' && row.status === '待审核'"
            v-has-permi="'content:write'"
            link
            type="danger"
            :disabled="busy"
            @click="returnMedia(row)"
            >退回</el-button
          ><el-button
            v-if="kind === 'mediaItems'"
            v-has-permi="'content:read'"
            link
            @click="accessibilityId = row.id"
            >字幕与朗读</el-button
          ><el-button v-if="kind === 'venues'" v-has-permi="'content:write'" link @click="areaVenue = row">市县归属</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <p class="catalog-footnote">
      共
      {{
        list.length
      }}
      条。顺序数字越小越靠前；草稿、退回和下架内容不会进入公开列表。
    </p>
    <el-dialog
      v-model="open"
      :title="`${editingId ? '编辑' : '新建'}${definition.singular}`"
      width="min(800px, 94vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!busy"
      :show-close="!busy"
      :before-close="
        (done: () => void) => {
          if (!busy) done();
        }
      "
      destroy-on-close
    >
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
        class="catalog-alert"
      />
      <el-alert
        v-if="editingId && form.status === '已发布'"
        title="保存修改后将转为草稿，需要重新发布。"
        type="info"
        :closable="false"
        class="catalog-alert"
      />
      <el-form label-position="top" :disabled="busy" @submit.prevent="save">
        <el-form-item label="标题" required
          ><el-input v-model="form.title" maxlength="100" show-word-limit
        /></el-form-item>
        <div class="catalog-form-grid">
          <el-form-item label="内容语言" required
            ><el-select v-model="form.language"
              ><el-option label="中文" value="zh" /><el-option
                label="English"
                value="en" /></el-select
          ></el-form-item>
          <el-form-item label="发布地区" required
            ><el-select v-model="form.region" filterable
              ><el-option
                v-for="value in regions"
                :key="value"
                :label="value"
                :value="value" /></el-select
          ></el-form-item>
          <el-form-item label="显示顺序"
            ><el-input-number
              v-model="form.sortOrder"
              :min="0"
              :max="9999"
              :precision="0"
          /></el-form-item>
          <el-form-item label="内容性质"
            ><el-switch
              v-model="form.sample"
              active-text="虚构展示内容"
              inactive-text="正式资料"
          /></el-form-item>
        </div>
        <el-form-item
          v-for="field in definition.fields"
          :key="field.name"
          :label="field.label"
          :required="field.required"
        >
          <CatalogAssetField
            v-if="field.type === 'asset'"
            :key="`${editingId || 'new'}-${field.name}`"
            v-model="form[field.name]"
            :media="field.media"
            :disabled="connection.pending > 0"
            @busy="
              (value: boolean) =>
                value
                  ? uploadingFields.add(field.name)
                  : uploadingFields.delete(field.name)
            "
          />
          <el-select
            v-else-if="field.type === 'select'"
            v-model="form[field.name]"
            @change="field.name === 'targetScreen' && (form.targetId = '')"
            ><el-option
              v-for="(label, value) in field.options"
              :key="value"
              :label="label"
              :value="value"
          /></el-select>
          <el-select
            v-else-if="field.type === 'target'"
            v-model="form[field.name]"
            clearable
            filterable
            placeholder="不关联具体内容"
            ><el-option
              v-for="item in targetOptions"
              :key="item.id"
              :label="item.title"
              :value="item.id"
          /></el-select>
          <el-date-picker
            v-else-if="field.type === 'date'"
            v-model="form[field.name]"
            type="datetime"
            clearable
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            placeholder="不限时间"
          />
          <el-input
            v-else
            v-model="form[field.name]"
            :type="field.type === 'textarea' ? 'textarea' : 'text'"
            :rows="field.type === 'textarea' ? 5 : undefined"
            :maxlength="field.max || 2000"
            :show-word-limit="field.type === 'textarea'"
          />
          <small v-if="field.hint" class="field-hint">{{ field.hint }}</small>
        </el-form-item>
        <p class="catalog-footnote">
          中文与英文分别编辑发布，不会自动翻译。上传成功后才可保存文件关联。
        </p>
      </el-form>
      <template #footer
        ><el-button :disabled="busy" @click="open = false">取消</el-button
        ><el-button
          v-has-permi="'content:write'"
          type="primary"
          :loading="connection.pending > 0"
          :disabled="busy"
          @click="save"
          >保存草稿</el-button
        ></template
      >
    </el-dialog>
    <el-drawer
      :model-value="!!areaVenue" title="阵地市县归属" size="min(600px, 100vw)" @close="areaVenue = undefined" destroy-on-close><VenueAreaEditor v-if="areaVenue" :venue-id="areaVenue.id" :province-id="areaVenue.regionId" /></el-drawer>
    <el-drawer
      :model-value="!!accessibilityId"
      title="人工字幕与朗读"
      size="min(900px, 100vw)"
      @close="accessibilityId = ''"
      destroy-on-close
      ><MediaAccessibilityEditor
        v-if="accessibilityId"
        :media-id="accessibilityId"
    /></el-drawer>
    <el-drawer v-model="previewOpen" title="内容预览" size="min(720px, 100vw)">
      <article v-if="preview" class="catalog-preview">
        <el-tag>{{ preview.status }}</el-tag>
        <h2>{{ preview.title }}</h2>
        <p>
          {{ preview.region }} ·
          {{ preview.language === "en" ? "English" : "中文" }}
        </p>
        <el-alert
          v-if="previewAssets.error"
          :title="previewAssets.error"
          type="warning"
          :closable="false"
        />
        <p v-if="previewAssets.loading">正在读取授权预览文件…</p>
        <img
          v-if="previewAssets.cover"
          :src="previewAssets.cover"
          :alt="preview.title"
          class="preview-cover"
        />
        <video
          v-if="
            kind === 'mediaItems' &&
            previewAssets.source &&
            preview.type !== 'audio'
          "
          :src="previewAssets.source"
          :poster="previewAssets.poster"
          controls
          preload="metadata"
        />
        <audio
          v-if="
            kind === 'mediaItems' &&
            previewAssets.source &&
            preview.type === 'audio'
          "
          :src="previewAssets.source"
          controls
          preload="metadata"
        />
        <div v-for="field in previewFields" :key="field.name">
          <h3>{{ field.label }}</h3>
          <p>{{ displayField(field.name, preview[field.name]) }}</p>
        </div>
        <el-alert
          v-if="preview.reviewNote"
          :title="`处理意见：${preview.reviewNote}`"
          type="warning"
          :closable="false"
        />
        <p class="catalog-footnote">
          这是后台预览；能否公开展示以发布状态、地区和展示时间为准。
        </p>
      </article>
    </el-drawer>
  </section>
</template>
<style scoped>
.preview-cover {
  width: 100%;
  max-height: 360px;
  object-fit: contain;
}
.catalog-manager {
  padding: 24px;
}
.catalog-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.catalog-toolbar h2 {
  margin: 0;
  font-size: 19px;
}
.catalog-toolbar p,
.catalog-footnote,
.row-meta {
  font-size: 12px;
  color: #72786c;
  line-height: 1.8;
}
.catalog-filters {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 150px 150px;
  gap: 12px;
  margin: 18px 0;
}
.catalog-title {
  white-space: normal;
  text-align: left;
  height: auto;
  line-height: 1.6;
}
.row-meta {
  margin: 3px 0;
}
.catalog-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 20px;
}
.field-hint {
  display: block;
  width: 100%;
  color: #7a8075;
  line-height: 1.7;
  margin-top: 5px;
}
.catalog-alert {
  margin-bottom: 16px;
}
.catalog-preview {
  overflow-wrap: anywhere;
}
.catalog-preview p {
  white-space: pre-wrap;
  line-height: 1.9;
}
.catalog-preview h3 {
  font-size: 14px;
  color: #696f61;
  margin-top: 24px;
}
.catalog-preview video,
.catalog-preview audio {
  width: 100%;
  max-height: 400px;
}
.catalog-manager :deep(.el-date-editor) {
  width: 100%;
}
.catalog-manager :deep(.el-form-item__content) {
  min-width: 0;
}
@media (max-width: 600px) {
  .catalog-manager {
    padding: 18px 12px;
  }
  .catalog-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .catalog-filters {
    grid-template-columns: 1fr 1fr;
  }
  .catalog-filters > :first-child {
    grid-column: 1/-1;
  }
  .catalog-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
