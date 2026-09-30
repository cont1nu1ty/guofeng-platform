<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type { ReviewTask } from "../domain/review";
import {
  beijingInput,
  windowInstant,
  windowError,
} from "../domain/reviewWindow";
import { command } from "../services/workspaceData";
import { refreshReviewNotices } from "../services/reviewAlerts";
const props = defineProps<{ modelValue: boolean; task?: ReviewTask }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const startsAt = ref(""),
  dueAt = ref(""),
  reason = ref(""),
  error = ref(""),
  busy = ref(false);
const started = computed(() => props.task?.windowStatus !== "not_started");
watch(
  () => props.modelValue,
  (open) => {
    if (!open || !props.task) return;
    startsAt.value = beijingInput(props.task.startsAt);
    dueAt.value = beijingInput(props.task.dueAt);
    reason.value = "";
    error.value = "";
  },
);
async function save() {
  const task = props.task;
  if (!task || busy.value) return;
  error.value = windowError(startsAt.value, dueAt.value);
  if (!error.value && reason.value.trim().length < 5)
    error.value = "请填写 5–2000 字的调整原因。";
  if (
    !error.value &&
    started.value &&
    Date.parse(windowInstant(dueAt.value)) <= Date.parse(task.dueAt)
  )
    error.value = "评审已开始，只能将截止时间延长。";
  if (error.value) return;
  busy.value = true;
  try {
    await command(
      "updateReviewWindow",
      {
        startsAt:
          startsAt.value === beijingInput(task.startsAt)
            ? task.startsAt
            : windowInstant(startsAt.value),
        dueAt: windowInstant(dueAt.value),
        reason: reason.value.trim(),
      },
      task.id,
      task.lockVersion,
    );
    await refreshReviewNotices();
    emit("update:modelValue", false);
    ElMessage.success("评审时间已更新，专家可在消息中查看变更。");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "时间调整失败，请刷新后重试";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <el-dialog
    append-to-body
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="调整评审时间"
    width="min(560px, 92vw)"
  >
    <p>
      {{
        started
          ? "评审已开始：开始时间保持不变，仅可延长截止时间。"
          : "评审未开始：可调整开始与截止时间。"
      }}
      保存后通知被分配的专家。
    </p>
    <el-form label-position="top">
      <el-form-item label="开始时间（北京时间）" required
        ><el-date-picker
          v-model="startsAt"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          :disabled="started || busy"
          style="width: 100%"
      /></el-form-item>
      <el-form-item label="截止时间（北京时间）" required
        ><el-date-picker
          v-model="dueAt"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          :disabled="busy"
          style="width: 100%"
      /></el-form-item>
      <el-form-item label="调整原因（5–2000 字）" required
        ><el-input
          v-model="reason"
          type="textarea"
          :rows="3"
          maxlength="2000"
          show-word-limit
          :disabled="busy"
          placeholder="说明为什么调整评审时间，专家将收到此原因。"
      /></el-form-item>
    </el-form>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
    />
    <template #footer
      ><el-button :disabled="busy" @click="emit('update:modelValue', false)"
        >取消</el-button
      ><el-button type="primary" :loading="busy" @click="save"
        >保存并通知专家</el-button
      ></template
    >
  </el-dialog>
</template>
