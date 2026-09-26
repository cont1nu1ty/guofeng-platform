<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import { catalogState, type SupportTicket } from "../../domain/catalog";
import { matchesRegion } from "../../domain/workspace";
import { command } from "../../services/workspaceData";
import { connection } from "../../services/http";
const query = ref(""),
  status = ref(""),
  open = ref(false),
  selected = ref<SupportTicket>(),
  reply = ref(""),
  replyStatus = ref("已回复"),
  error = ref("");
const labels: Record<string, string> = {
  submission: "投稿咨询",
  review: "评审咨询",
  activity: "活动咨询",
  other: "其他咨询",
};
const list = computed(() =>
  catalogState.supportTickets.filter(
    (x) =>
      matchesRegion(x.region) &&
      (!status.value || x.status === status.value) &&
      `${x.subject} ${x.authorName} ${x.body}`.includes(query.value.trim()),
  ),
);
function edit(item: SupportTicket) {
  selected.value = JSON.parse(JSON.stringify(item));
  reply.value = item.reply || "";
  replyStatus.value = item.status === "已关闭" ? "已关闭" : "已回复";
  error.value = "";
  open.value = true;
}
async function save() {
  if (!selected.value) return;
  if (reply.value.trim().length < 2) {
    error.value = "请填写至少2个字的回复内容。";
    return;
  }
  try {
    await command(
      "replySupportTicket",
      { reply: reply.value.trim(), status: replyStatus.value },
      selected.value.id,
      selected.value.lockVersion,
    );
    open.value = false;
    ElMessage.success(
      replyStatus.value === "已关闭"
        ? "咨询已关闭，回复已保存"
        : "回复已保存，用户可在个人咨询中查看",
    );
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "回复未保存，请重试";
  }
}
</script>
<template>
  <section class="panel support-panel">
    <h2>人工咨询</h2>
    <p>回复保存在站内咨询记录中，用户登录后可查看。不会发送电子邮件。</p>
    <div class="support-filters">
      <el-input
        v-model="query"
        clearable
        placeholder="搜索主题、提问人或内容"
      /><el-select v-model="status" clearable placeholder="全部状态"
        ><el-option
          v-for="v in ['待处理', '已回复', '已关闭']"
          :key="v"
          :value="v"
          :label="v"
      /></el-select>
    </div>
    <el-table :data="list" row-key="id" empty-text="暂无匹配咨询"
      ><el-table-column
        prop="subject"
        label="咨询主题"
        min-width="240"
      /><el-table-column prop="authorName" label="提问人" width="120" /><el-table-column
        label="分类"
        width="100"
        ><template #default="{ row }">{{
          labels[row.category] || row.category
        }}</template></el-table-column
      ><el-table-column prop="region" label="地区" width="105" /><el-table-column
        prop="status"
        label="状态"
        width="100"
      /><el-table-column label="操作" fixed="right" width="110"
        ><template #default="{ row }"
          ><el-button
            v-has-permi="'content:write'"
            link
            type="primary"
            @click="edit(row)"
            >查看 / 回复</el-button
          ></template
        ></el-table-column
      ></el-table
    >
    <el-dialog
      v-model="open"
      title="咨询处理"
      width="min(680px, 94vw)"
      :close-on-click-modal="false"
      ><template v-if="selected"
        ><h3>{{ selected.subject }}</h3>
        <p class="support-meta">
          {{ selected.authorName }} · {{ selected.region }} · {{ selected.status }}
        </p>
        <div class="question-body">{{ selected.body }}</div>
        <el-alert v-if="error" :title="error" type="error" :closable="false" /><el-form
          label-position="top"
          :disabled="connection.pending > 0"
          ><el-form-item label="回复内容" required
            ><el-input
              v-model="reply"
              type="textarea"
              :rows="7"
              maxlength="5000"
              show-word-limit /></el-form-item
          ><el-form-item label="处理状态"
            ><el-radio-group v-model="replyStatus"
              ><el-radio value="已回复">已回复</el-radio
              ><el-radio value="已关闭">关闭咨询</el-radio></el-radio-group
            ></el-form-item
          ></el-form
        ></template
      ><template #footer
        ><el-button :disabled="connection.pending > 0" @click="open = false"
          >取消</el-button
        ><el-button
          v-has-permi="'content:write'"
          type="primary"
          :loading="connection.pending > 0"
          @click="save"
          >保存回复</el-button
        ></template
      ></el-dialog
    >
  </section>
</template>
<style scoped>
.support-panel {
  padding: 24px;
}
.support-panel h2 {
  font-size: 19px;
  margin-top: 0;
}
.support-panel > p,
.support-meta {
  font-size: 13px;
  color: #747b6c;
  line-height: 1.8;
}
.support-filters {
  display: grid;
  grid-template-columns: 1fr 150px;
  gap: 14px;
  margin: 18px 0;
}
.question-body {
  white-space: pre-wrap;
  line-height: 1.9;
  overflow-wrap: anywhere;
  background: #f6f7f3;
  padding: 18px;
  border-radius: 8px;
  margin: 18px 0;
}
.support-panel :deep(.el-alert) {
  margin-bottom: 16px;
}
@media (max-width: 600px) {
  .support-panel {
    padding: 18px 12px;
  }
  .support-filters {
    grid-template-columns: 1fr;
  }
}
</style>
