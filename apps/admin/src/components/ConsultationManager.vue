<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { api, newRequestId } from "../services/http";
import { loadWorkspace } from "../services/workspaceData";
const props = defineProps<{ claimId: string }>();
interface FollowUp {
  id: string;
  stage: string;
  note: string;
  quoteAmount: number | null;
  quoteDescription: string;
  createdAt: string;
}
interface Consultation {
  id: string;
  version: number;
  stage: string;
  cancelled: boolean;
  events: FollowUp[];
  notice: string;
}
const stages: Record<string, string> = {
  pending: "待受理",
  accepted: "已受理",
  discussion: "沟通中",
  quoted: "已报价",
  closed: "已结束",
};
const result = ref<Consultation>(),
  error = ref(""),
  busy = ref(false);
const form = reactive({
  stage: "discussion",
  note: "",
  quoteAmount: "",
  quoteDescription: "",
});
let sequence = 0,
  key = "",
  payload = "";
async function load() {
  const serial = ++sequence;
  busy.value = true;
  error.value = "";
  result.value = undefined;
  try {
    const next = await api<Consultation>(
      `/admin/consultations/${encodeURIComponent(props.claimId)}`,
    );
    if (serial === sequence) result.value = next;
  } catch (e) {
    if (serial === sequence)
      error.value = e instanceof Error ? e.message : "咨询记录加载失败";
  } finally {
    if (serial === sequence) busy.value = false;
  }
}
async function save() {
  if (busy.value || !result.value) return;
  busy.value = true;
  error.value = "";
  const data = { ...form, version: result.value.version };
  if (form.stage !== "quoted") {
    data.quoteAmount = "";
    data.quoteDescription = "";
  }
  const next = JSON.stringify(data);
  if (payload !== next) {
    key = newRequestId();
    payload = next;
  }
  try {
    result.value = await api<Consultation>(
      `/admin/consultations/${encodeURIComponent(props.claimId)}`,
      { method: "POST", headers: { "Idempotency-Key": key }, body: next },
    );
    Object.assign(form, { note: "", quoteAmount: "", quoteDescription: "" });
    await loadWorkspace();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "跟进未保存，请重试";
  } finally {
    busy.value = false;
  }
}
watch(() => props.claimId, load, { immediate: true });
</script>
<template>
  <section aria-label="定制咨询跟进" v-loading="busy">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="result">
      <el-alert :title="result.notice" type="info" :closable="false" />
      <h3>
        当前阶段：{{ result.cancelled ? "申请人已取消" : stages[result.stage] }}
      </h3>
      <el-timeline
        ><el-timeline-item
          v-for="event in result.events"
          :key="event.id"
          :timestamp="event.createdAt"
          ><strong>{{ stages[event.stage] }}</strong>
          <p class="consultation-copy">{{ event.note }}</p>
          <template v-if="event.quoteAmount !== null"
            ><p>参考报价：¥ {{ Number(event.quoteAmount).toFixed(2) }}</p>
            <p class="consultation-copy">
              {{ event.quoteDescription }}
            </p></template
          ></el-timeline-item
        ></el-timeline
      >
      <p v-if="!result.events.length">暂无跟进记录。</p>
      <el-form v-if="!result.cancelled" label-position="top">
        <el-form-item label="本次跟进阶段"
          ><el-select v-model="form.stage"
            ><el-option
              v-for="stage in ['accepted', 'discussion', 'quoted', 'closed']"
              :key="stage"
              :value="stage"
              :label="stages[stage]" /></el-select
        ></el-form-item>
        <el-form-item label="给申请人的跟进说明" required
          ><el-input
            v-model="form.note"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
        /></el-form-item>
        <template v-if="form.stage === 'quoted'"
          ><el-form-item label="参考报价（人民币元）" required
            ><el-input
              v-model="form.quoteAmount"
              inputmode="decimal"
              placeholder="如 1200.00" /></el-form-item
          ><el-form-item label="报价范围、有效期与后续确认方式" required
            ><el-input
              v-model="form.quoteDescription"
              type="textarea"
              :rows="3"
              maxlength="2000" /></el-form-item
        ></template>
        <el-button
          v-has-permi="'welfare:write'"
          type="primary"
          :loading="busy"
          @click="save"
          >保存并通知申请人</el-button
        >
      </el-form>
    </template>
  </section>
</template>
<style scoped>
.consultation-copy {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
