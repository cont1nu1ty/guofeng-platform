<script setup lang="ts">
import { ref, watch } from "vue";
import type { UploadFile } from "element-plus";
import { api, newRequestId, ApiError } from "../../services/http";
import { uploadFile } from "../../services/files";
interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}
interface Track {
  version: number;
  draft: { language: "zh" | "en"; cues: Cue[]; narrationFileId: string };
  publishedAt: string | null;
}
const props = defineProps<{ mediaId: string }>();
const state = ref<Track | null>(null),
  busy = ref(false),
  error = ref(""),
  saved = ref("");
const keys = new Map<string, string>();
let serial = 0;
async function load() {
  const request = ++serial;
  busy.value = true;
  error.value = "";
  saved.value = "";
  state.value = null;
  try {
    const data = await api<Track>(
      `/admin/media/${encodeURIComponent(props.mediaId)}/accessibility`,
    );
    if (request === serial) state.value = data;
  } catch (e) {
    if (request === serial)
      error.value = e instanceof Error ? e.message : "读取失败，请重试。";
  } finally {
    if (request === serial) busy.value = false;
  }
}
watch(() => props.mediaId, load, { immediate: true });
async function action(action: "save" | "publish" | "unpublish") {
  if (!state.value || busy.value) return;
  busy.value = true;
  error.value = "";
  saved.value = "";
  const body = JSON.stringify({
    action,
    version: state.value.version,
    data: state.value.draft,
  });
  const key = keys.get(body) || newRequestId();
  keys.set(body, key);
  try {
    state.value = await api<Track>(
      `/admin/media/${encodeURIComponent(props.mediaId)}/accessibility`,
      { method: "POST", body, headers: { "Idempotency-Key": key } },
    );
    keys.delete(body);
    saved.value =
      action === "save"
        ? "草稿已保存。发布后才对读者可见。"
        : action === "publish"
          ? "人工字幕与朗读已发布。"
          : "字幕与朗读已下架。";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "未保存，请重试。";
    if (e instanceof ApiError && e.status > 0 && e.status < 500)
      keys.delete(body);
  } finally {
    busy.value = false;
  }
}
function addCue() {
  const cues = state.value?.draft.cues;
  if (!cues) return;
  const start = cues.at(-1)?.endMs || 0;
  cues.push({ startMs: start, endMs: start + 3000, text: "" });
}
async function upload(file: UploadFile) {
  if (!file.raw || !state.value || busy.value) return;
  if (!/\.(mp3|wav)$/i.test(file.name) || file.raw.size > 50 * 1024 * 1024) {
    error.value = "朗读录音须为50MiB以内的MP3或WAV。";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const uploaded = await uploadFile(file.raw, "media");
    state.value.draft.narrationFileId = uploaded.fileId;
    saved.value = "录音上传成功，请保存草稿后发布。";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "录音上传失败，请重试。";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="media-accessibility-editor">
    <el-alert
      title="人工字幕和人工录音独立保存与发布。先保存，再发布；修改主媒体文件后需重新校准字幕并发布。"
      type="info"
      :closable="false"
    />
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
      role="alert"
    />
    <p v-if="saved" role="status">{{ saved }}</p>
    <el-button :disabled="busy" @click="load">重新加载</el-button>
    <el-form v-if="state" label-position="top" :disabled="busy">
      <p>
        已发布：{{
          state.publishedAt
            ? new Date(state.publishedAt).toLocaleString()
            : "尚未发布"
        }}
      </p>
      <el-form-item label="人工字幕语言"
        ><el-select v-model="state.draft.language"
          ><el-option label="中文" value="zh" /><el-option
            label="English"
            value="en" /></el-select
      ></el-form-item>
      <div v-for="(cue, i) in state.draft.cues" :key="i" class="cue-row">
        <el-form-item :label="`第${i + 1}条 · 开始毫秒`"
          ><el-input-number
            v-model="cue.startMs"
            :min="0"
            :max="600000"
            :precision="0"
            :step="1000"
        /></el-form-item>
        <el-form-item label="结束毫秒"
          ><el-input-number
            v-model="cue.endMs"
            :min="1"
            :max="600000"
            :precision="0"
            :step="1000"
        /></el-form-item>
        <el-form-item label="字幕文字" class="cue-text"
          ><el-input
            v-model="cue.text"
            type="textarea"
            :rows="2"
            maxlength="1000"
        /></el-form-item>
        <el-button
          type="danger"
          link
          :aria-label="`删除第${i + 1}条字幕`"
          @click="state.draft.cues.splice(i, 1)"
          >删除</el-button
        >
      </div>
      <el-button :disabled="state.draft.cues.length >= 500" @click="addCue"
        >添加时间轴字幕</el-button
      >
      <p>
        时间单位为毫秒（1000毫秒＝1秒），按播放顺序排列且不能重叠。字幕最长覆盖10分钟。
      </p>
      <el-form-item label="人工朗读录音（可选）"
        ><el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".mp3,.wav"
          :on-change="upload"
          :disabled="busy"
          ><el-button :loading="busy">上传MP3 / WAV</el-button></el-upload
        ><span v-if="state.draft.narrationFileId"
          >已关联录音
          <el-button
            link
            type="danger"
            @click="state.draft.narrationFileId = ''"
            >移除</el-button
          ></span
        ></el-form-item
      >
      <div class="track-actions">
        <el-button
          v-has-permi="'content:write'"
          type="primary"
          :loading="busy"
          @click="action('save')"
          >保存草稿</el-button
        ><el-button
          v-has-permi="'content:write'"
          :disabled="!state.version"
          @click="action('publish')"
          >发布已保存草稿</el-button
        ><el-button
          v-if="state.publishedAt"
          v-has-permi="'content:write'"
          type="warning"
          @click="action('unpublish')"
          >下架字幕与朗读</el-button
        >
      </div>
    </el-form>
    <p v-else-if="busy" role="status">正在加载字幕…</p>
  </section>
</template>
<style scoped>
.media-accessibility-editor {
  display: grid;
  gap: 16px;
}
.cue-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 0;
  border-bottom: 1px solid #eee;
}
.cue-text {
  flex: 1;
  min-width: 220px;
}
.track-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.media-accessibility-editor p {
  color: #666;
  line-height: 1.7;
}
</style>
