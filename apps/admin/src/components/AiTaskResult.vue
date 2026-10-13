<script setup lang="ts">
import { aiModeLabels, aiStatusLabels, type AiTask } from "../services/ai";
defineProps<{ task: AiTask; stale?: boolean }>();
</script>

<template>
  <section class="ai-task-result" aria-live="polite">
    <div class="result-meta">
      <el-tag :type="task.status === 'failed' ? 'danger' : task.status === 'succeeded' ? 'success' : 'warning'">{{ aiStatusLabels[task.status] }}</el-tag>
      <span>{{ aiModeLabels[task.mode] || task.mode }} · {{ task.model || '模型信息待返回' }}</span>
    </div>
    <p class="task-id">{{ task.id }}<span v-if="task.sourceVersion !== undefined"> · 稿件版本 {{ task.sourceVersion }}</span></p>
    <el-alert v-if="stale" title="稿件版本已变化，此结果已过期。请刷新稿件并重新分析。" type="warning" :closable="false" />
    <el-alert v-else-if="task.status === 'failed'" :title="task.error?.message || '任务处理失败，请重试或联系管理员。'" type="error" :closable="false" />
    <template v-else-if="task.status === 'succeeded'">
      <h3>分析结果</h3>
      <div class="result-text">{{ task.result || '服务未返回文本结果。' }}</div>
      <template v-if="task.issues?.length">
        <h3>需要人工核对</h3>
        <article v-for="(issue, index) in task.issues" :key="index" class="evidence">
          <el-tag :type="issue.severity === 'high' ? 'danger' : 'warning'" size="small">{{ { high: '较高关注', medium: '需要关注', low: '一般提示' }[issue.severity] || issue.severity }}</el-tag>
          <blockquote v-if="issue.quote">{{ issue.quote }}</blockquote>
          <p>{{ issue.reason }}</p>
        </article>
      </template>
      <template v-if="task.similarities?.length">
        <h3>相似内容证据</h3>
        <p class="result-note">相似片段仅供核对，不构成抄袭认定。检索分数不是抄袭概率。</p>
        <article v-for="item in task.similarities" :key="item.id" class="evidence">
          <b>{{ item.title }}</b><span class="result-note"> · 检索分数 {{ Number.isFinite(item.score) ? item.score.toFixed(2) : '—' }}</span>
          <blockquote>{{ item.excerpt }}</blockquote>
        </article>
      </template>
      <template v-if="task.citations?.length">
        <h3>参考资料</h3>
        <article v-for="item in task.citations" :key="item.id" class="evidence"><b>{{ item.title }}</b><blockquote>{{ item.excerpt }}</blockquote></article>
      </template>
    </template>
    <p v-else class="result-note">任务正在服务端处理，完成后会显示结果。关闭页面不会取消已受理的任务。</p>
  </section>
</template>

<style scoped>
.ai-task-result { margin-top: 20px; min-width: 0; }
.result-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 12px; }
.task-id,.result-note { color: #788172; font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
h3 { font-size: 14px; margin: 22px 0 10px; }
.result-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.9; padding: 16px; background: #f5f7f1; border-radius: 6px; }
.evidence { padding: 14px 0; border-bottom: 1px solid #e8ede1; font-size: 13px; line-height: 1.8; }
blockquote { margin: 10px 0; padding: 8px 12px; border-left: 3px solid #b4c0a5; background: #fafbf8; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
