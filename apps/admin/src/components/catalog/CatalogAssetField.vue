<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import type { UploadFile } from "element-plus";
import { uploadFile, downloadFile } from "../../services/files";
const props = defineProps<{
  modelValue: string;
  media?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [string]; busy: [boolean] }>();
const uploading = ref(false),
  name = ref(""),
  error = ref("");
async function select(file: UploadFile) {
  if (!file.raw || uploading.value) return;
  const allowed = props.media
    ? /\.(mp4|mov|webm|mp3|wav)$/i
    : /\.(png|jpe?g)$/i;
  const limit = (props.media ? 50 : 10) * 1024 * 1024;
  if (!allowed.test(file.name) || file.raw.size > limit) {
    error.value = props.media
      ? "请选择50MiB以内的MP4、MOV、WebM、MP3或WAV文件。"
      : "请选择10MiB以内的PNG或JPEG图片。";
    return;
  }
  uploading.value = true;
  emit("busy", true);
  error.value = "";
  try {
    const value = await uploadFile(file.raw, props.media ? "media" : undefined);
    emit("update:modelValue", value.fileId);
    name.value = value.name || file.name;
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "上传失败，请重试。";
  } finally {
    uploading.value = false;
    emit("busy", false);
  }
}
async function open() {
  try {
    await downloadFile(props.modelValue);
  } catch (reason) {
    ElMessage.error(
      reason instanceof Error ? reason.message : "文件暂时无法打开",
    );
  }
}
</script>
<template>
  <div class="asset-field">
    <div class="asset-actions">
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        :accept="media ? '.mp4,.mov,.webm,.mp3,.wav' : '.png,.jpg,.jpeg'"
        :on-change="select"
        :disabled="disabled || uploading"
      >
        <el-button :loading="uploading" :disabled="disabled">{{
          modelValue ? "替换文件" : "选择文件上传"
        }}</el-button>
      </el-upload>
      <template v-if="modelValue"
        ><span>{{ name || "已关联文件" }}</span
        ><el-button link @click="open">打开文件</el-button
        ><el-button
          link
          type="danger"
          :disabled="disabled || uploading"
          @click="
            emit('update:modelValue', '');
            name = '';
          "
          >移除关联</el-button
        ></template
      >
    </div>
    <p v-if="error" class="asset-error" role="alert">{{ error }}</p>
    <small v-else>{{
      uploading
        ? "上传中，请等待成功后再保存。"
        : media
          ? "视频支持MP4 / MOV / WebM（最长10分钟），转换为MP4；音频支持MP3 / WAV。最大50MiB。"
          : "支持 PNG / JPEG，最大10MiB。"
    }}</small>
  </div>
</template>
<style scoped>
.asset-field {
  width: 100%;
}
.asset-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.asset-actions span {
  overflow-wrap: anywhere;
}
.asset-field small {
  display: block;
  color: #777;
  margin-top: 5px;
}
.asset-error {
  color: #b42318;
  margin: 6px 0;
}
</style>
