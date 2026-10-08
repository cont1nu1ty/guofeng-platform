<script setup lang="ts">
import { ref } from "vue";
import { api, newRequestId } from "../services/http";
import {
  importHeaders,
  parseSubmissionImport,
  type OfflineSubmissionRow,
} from "../domain/submissionImport";
const visible = defineModel<boolean>({ required: true });
const emit = defineEmits<{ imported: [] }>();
const busy = ref(false),
  error = ref(""),
  filename = ref("");
const rows = ref<OfflineSubmissionRow[]>([]);
interface Preview {
  fingerprint: string;
  rows: { row: number; ownerName: string; data: OfflineSubmissionRow }[];
  errors: { row: number; message: string }[];
}
const preview = ref<Preview>();
let retryKey = "";
async function select(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  rows.value = [];
  preview.value = undefined;
  error.value = "";
  filename.value = file?.name ?? "";
  if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error("文件不能超过 1 MB。");
    rows.value = parseSubmissionImport(await file.text());
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "文件无法读取";
  }
}
function template() {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", importHeaders.join(",") + "\r\n"], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "线下稿件归集模板.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function check() {
  busy.value = true;
  error.value = "";
  preview.value = undefined;
  try {
    preview.value = await api<Preview>("/admin/submission-imports/preview", {
      method: "POST",
      body: JSON.stringify({ rows: rows.value }),
    });
    retryKey = newRequestId();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "预检失败";
  } finally {
    busy.value = false;
  }
}
async function confirm() {
  if (!preview.value || preview.value.errors.length) return;
  busy.value = true;
  error.value = "";
  try {
    await api("/admin/submission-imports/confirm", {
      method: "POST",
      headers: { "Idempotency-Key": retryKey },
      body: JSON.stringify({
        rows: rows.value,
        fingerprint: preview.value.fingerprint,
      }),
    });
    visible.value = false;
    rows.value = [];
    preview.value = undefined;
    emit("imported");
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "导入失败，请重试";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <el-dialog
    v-model="visible"
    title="线下稿件归集"
    width="min(960px, 94vw)"
    :close-on-click-modal="!busy"
  >
    <el-alert
      title="归集会关联指定的已有投稿账号，并发送核对提醒。账号本人确认正文和投稿声明前，稿件不能通过初审。"
      type="info"
      :closable="false"
    />
    <p>
      每批 1–100
      条文字稿件。来源名称＋来源编号不能重复；附件请按后续稿件修订流程上传。
    </p>
    <el-button @click="template">下载 CSV 空模板</el-button>
    <label class="import-file"
      >选择 UTF-8 CSV 文件<input
        type="file"
        accept=".csv,text/csv"
        :disabled="busy"
        @change="select"
    /></label>
    <el-collapse
      ><el-collapse-item title="填写说明" name="help">
        <p>
          账号ID：填写用户管理中的既有投稿账号ID；地区编码：如
          zhejiang、beijing，与账号授权范围一致。
        </p>
        <p>
          体裁：letter、essay、poetry、memoir、biography、family-rules、family-notes、commentary。
        </p>
        <p>
          通道：public-service、school、community、special；主题可留空或用 |
          分隔：integrity、filial、neighbor、patriotism、heritage、family-history。
        </p>
        <p>
          正文包含换行或逗号时请保留 CSV
          导出器生成的引号。海外地区须填写国家城市。
        </p>
      </el-collapse-item></el-collapse
    >
    <p v-if="filename">{{ filename }} · {{ rows.length }} 条已读取</p>
    <el-button :disabled="!rows.length" :loading="busy" @click="check"
      >服务端预检</el-button
    >
    <template v-if="preview">
      <el-table :data="preview.rows"
        ><el-table-column prop="row" label="行" width="60" /><el-table-column
          prop="data.title"
          label="标题"
          min-width="180" /><el-table-column
          prop="ownerName"
          label="接收账号"
          min-width="120" /><el-table-column
          prop="data.sourceRef"
          label="来源编号"
          min-width="120"
      /></el-table>
      <el-table v-if="preview.errors.length" :data="preview.errors"
        ><el-table-column
          prop="row"
          label="错误行"
          width="80" /><el-table-column prop="message" label="需修正"
      /></el-table>
    </template>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template #footer
      ><el-button :disabled="busy" @click="visible = false">取消</el-button
      ><el-button
        type="primary"
        :loading="busy"
        :disabled="!preview || !!preview.errors.length"
        @click="confirm"
        >确认归集并提醒本人</el-button
      ></template
    >
  </el-dialog>
</template>
<style scoped>
.import-file {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin: 20px 0;
}
p {
  line-height: 1.7;
  overflow-wrap: anywhere;
}
</style>
