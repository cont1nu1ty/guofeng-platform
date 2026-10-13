<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { analyseSubmission, readAiStatus, readAiTask, readLatestSubmissionTask, waitForAiTask, isTaskStale, type AiStatus, type AiTask } from "../services/ai";
import { loadWorkspace } from "../services/workspaceData";
import AiTaskResult from "./AiTaskResult.vue";
const props = defineProps<{ submissionId: string; version?: number }>();
const status = ref<AiStatus>();
const task = ref<AiTask>();
const busy = ref(false);
const error = ref("");
let controller: AbortController | undefined;
let generation = 0;
async function refreshStatus() {
  const active = generation;
  try { const value = await readAiStatus(); if (active === generation) status.value = value; }
  catch (cause) { if (active === generation) error.value = cause instanceof Error ? cause.message : "读取 AI 状态失败"; }
}
watch(() => [props.submissionId, props.version], () => {
  controller?.abort(); generation++; busy.value = false; error.value = ""; status.value = undefined;
  if (task.value?.submissionId !== props.submissionId) task.value = undefined;
  void refreshStatus();
  void restoreLatest();
}, { immediate: true });
onBeforeUnmount(() => { generation++; controller?.abort(); });
async function restoreLatest() {
  if (task.value || busy.value) return;
  const active = generation;
  try {
    const latest = await readLatestSubmissionTask(props.submissionId);
    if (active !== generation || busy.value || task.value || !latest) return;
    task.value = latest;
    if (["queued", "running"].includes(latest.status)) await run(latest.mode === "summary" ? "summary" : "review", true);
  } catch (cause) {
    if (active === generation && !busy.value && !task.value) error.value = cause instanceof Error ? cause.message : "读取历史AI任务失败，请刷新后重试";
  }
}
async function run(mode: "review" | "summary", resume = false) {
  if (busy.value || props.version === undefined) return;
  const active = generation;
  controller?.abort(); controller = new AbortController();
  const signal = controller.signal;
  busy.value = true; error.value = "";
  try {
    const initial = resume && task.value ? await readAiTask(task.value.id) : await analyseSubmission(props.submissionId, props.version, mode);
    if (active !== generation) return;
    task.value = initial;
    await waitForAiTask(initial, { signal, onUpdate(value) { if (active === generation) task.value = value; } });
  } catch (cause) {
    if (active === generation && !signal.aborted) error.value = cause instanceof Error ? cause.message : "AI 请求失败，请重试";
  } finally { if (active === generation) busy.value = false; }
}
async function refreshManuscript() {
  error.value = "";
  try { await loadWorkspace(); await refreshStatus(); await restoreLatest(); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "刷新稿件失败"; }
}
</script>
<template>
  <section class="submission-ai" aria-label="稿件 AI 辅助">
    <p>生成摘要、主题和核对建议，参考当前可检索的资料提供相似片段。审核结论、评分和发布仍由人工确认。</p>
    <el-alert v-if="status?.external" title="开发模式使用外部模型 API。主动分析将向模型服务发送当前稿件正文。" type="warning" :closable="false" />
    <el-alert v-if="status && !status.enabled" title="AI 服务尚未启用，请联系管理员配置模型。" type="info" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="actions">
      <el-button type="primary" :loading="busy" :disabled="!status?.enabled || version === undefined" @click="run('review')">审核辅助</el-button>
      <el-button :disabled="busy || !status?.enabled || version === undefined" @click="run('summary')">生成摘要</el-button>
      <el-button v-if="task && ['queued', 'running'].includes(task.status)" :disabled="busy" @click="run(task.mode === 'summary' ? 'summary' : 'review', true)">刷新任务</el-button>
      <el-button :disabled="busy" @click="refreshManuscript">刷新稿件与服务状态</el-button>
    </div>
    <AiTaskResult v-if="task" :task="task" :stale="isTaskStale(task, submissionId, version)" />
    <el-empty v-else :image-size="70" description="尚未分析当前稿件" />
  </section>
</template>
<style scoped>
.submission-ai { padding: 10px 0; }
.submission-ai > p { font-size: 13px; line-height: 1.8; color: #6d7864; }
.submission-ai :deep(.el-alert) { margin: 12px 0; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.actions :deep(.el-button) { margin-left: 0; }
</style>
