<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api } from "../services/http";
import { session } from "../services/session";

const status = ref<Record<string, unknown> | null>(null);
const loading = ref(false);
const error = ref("");
const national = computed(() => session.user?.roles.includes("national_admin"));
async function refresh() {
  loading.value = true;
  error.value = "";
  try { status.value = await api<Record<string, unknown>>("/admin/search/status"); }
  catch (cause) { status.value = null; error.value = cause instanceof Error ? cause.message : "读取搜索状态失败"; }
  finally { loading.value = false; }
}
async function rebuild() {
  try {
    await ElMessageBox.confirm("将根据数据库重新生成公开内容索引，原始业务记录和文件会保留。", "重建搜索索引", { confirmButtonText: "重建索引", cancelButtonText: "取消" });
    await api("/admin/search/rebuild", { method: "POST" });
    ElMessage.success("重建请求已受理，可刷新查看进度");
    await refresh();
  } catch (cause) { if (cause instanceof Error) ElMessage.error(cause.message); }
}
onMounted(refresh);
</script>

<template>
  <section class="search-status" aria-label="公开内容搜索状态">
    <h2>公开内容搜索</h2>
    <p>检索已发布内容。个人约定、私人录音和未公开稿件不进入搜索。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-descriptions v-if="status" :column="1" border>
      <el-descriptions-item label="服务状态">{{ status.ready ? "可用" : "等待同步或恢复" }}</el-descriptions-item>
      <el-descriptions-item label="待同步变更">{{ status.pending ?? "—" }}</el-descriptions-item>
      <el-descriptions-item label="目录版本">{{ status.generation ?? "—" }}</el-descriptions-item>
      <el-descriptions-item label="索引版本">{{ status.indexedGeneration ?? "—" }}</el-descriptions-item>
      <el-descriptions-item label="最近错误">{{ status.lastError || "无" }}</el-descriptions-item>
    </el-descriptions>
    <div class="search-actions">
      <el-button :loading="loading" @click="refresh">刷新状态</el-button>
      <el-button v-if="national" :disabled="loading" type="primary" @click="rebuild">重建索引</el-button>
    </div>
  </section>
</template>
<style scoped>
.search-status { padding: 24px; }
.search-status h2 { margin: 0 0 12px; }
.search-status p { color: var(--muted, #706962); line-height: 1.7; }
.search-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
</style>
