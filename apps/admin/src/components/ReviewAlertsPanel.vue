<script setup lang="ts">
import { ref, watch } from "vue";
import { session } from "../services/session";
import { isHttpMode } from "../services/mode";
import {
  fetchReviewAlerts,
  markReviewAlertRead,
  type ReviewAlert,
} from "../services/reviewAlerts";
import { beijingTime, windowLabel } from "../domain/reviewWindow";
import Pagination from "./upstream/Pagination.vue";
const emit = defineEmits<{ open: [taskId: string] }>();
const phase = ref("all"),
  scope = ref("mine"),
  unreadOnly = ref(false),
  page = ref(1),
  pageSize = ref(10);
const items = ref<ReviewAlert[]>([]),
  total = ref(0),
  loading = ref(false),
  error = ref(""),
  serverNow = ref("");
let sequence = 0;
async function load() {
  if (!isHttpMode) return;
  const id = ++sequence;
  loading.value = true;
  error.value = "";
  try {
    const result = await fetchReviewAlerts({
      page: page.value,
      pageSize: pageSize.value,
      phase: phase.value,
      scope: scope.value,
      unreadOnly: unreadOnly.value,
    });
    if (id !== sequence) return;
    items.value = result.items;
    total.value = result.total;
    serverNow.value = result.serverNow;
  } catch (e) {
    if (id === sequence) {
      items.value = [];
      total.value = 0;
      error.value = e instanceof Error ? e.message : "预警读取失败";
    }
  } finally {
    if (id === sequence) loading.value = false;
  }
}
async function open(item: ReviewAlert) {
  try {
    for (const id of item.notificationIds || []) await markReviewAlertRead(id);
    emit("open", item.taskId);
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "提醒未更新，请重试";
  }
}
watch([phase, scope, unreadOnly, pageSize], () => {
  page.value = 1;
  void load();
});
watch(page, () => void load());
watch(
  () => session.user?.id,
  () => void load(),
  { immediate: true },
);
</script>
<template>
  <div class="alerts-panel">
    <p class="muted">
      按服务端授权范围列出临期与逾期任务；“未读”仅代表发给当前账号的提醒。历史逾期任务仍可查看，未必有提醒。
    </p>
    <template v-if="isHttpMode">
      <div class="filter-bar alerts-filters">
        <el-select v-model="phase" aria-label="预警阶段"
          ><el-option label="全部预警" value="all" /><el-option
            label="24 小时内截止"
            value="due_soon" /><el-option label="已逾期" value="overdue"
        /></el-select>
        <el-select v-model="scope" aria-label="预警范围"
          ><el-option label="与我相关" value="mine" /><el-option
            v-if="
              !session.user?.roles.includes('expert') ||
              session.user?.roles.some((role) => role.includes('admin'))
            "
            label="全部授权范围"
            value="all"
        /></el-select>
        <el-checkbox v-model="unreadOnly">仅看我的未读</el-checkbox
        ><el-button :loading="loading" @click="load">刷新预警</el-button>
      </div>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
      />
      <el-table
        :data="items"
        v-loading="loading"
        empty-text="当前筛选下没有评审预警"
      >
        <el-table-column prop="title" label="评审作品" min-width="200" />
        <el-table-column prop="expertName" label="负责专家" min-width="110" />
        <el-table-column label="状态" min-width="130"
          ><template #default="{ row }"
            ><el-tag
              :type="row.windowStatus === 'overdue' ? 'danger' : 'warning'"
              >{{ windowLabel(row) }}</el-tag
            ><span v-if="row.unread" class="unread-label">未读</span></template
          ></el-table-column
        >
        <el-table-column label="评审时间（北京时间）" min-width="260"
          ><template #default="{ row }"
            ><div>开始 {{ beijingTime(row.startsAt) }}</div>
            <div>截止 {{ beijingTime(row.dueAt) }}</div></template
          ></el-table-column
        >
        <el-table-column label="操作" width="120"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="open(row)"
              >查看任务</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <Pagination v-model:page="page" v-model:limit="pageSize" :total="total" />
      <p v-if="serverNow" class="muted">
        本次状态时间：{{ beijingTime(serverNow) }}
      </p>
    </template>
    <el-empty
      v-else
      description="演示模式不发送自动提醒；切换到真实服务后可查看本人提醒和授权范围预警。"
    />
  </div>
</template>
<style scoped>
.alerts-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}
.alerts-filters .el-select {
  width: 190px;
}
.unread-label {
  display: inline-block;
  margin-left: 8px;
  color: #a03d36;
}
.alerts-panel {
  padding: 6px 0 12px;
}
@media (max-width: 600px) {
  .alerts-filters .el-select {
    width: 100%;
  }
}
</style>
