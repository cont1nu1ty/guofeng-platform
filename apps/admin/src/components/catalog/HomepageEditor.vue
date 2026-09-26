<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { homepageConfig, sectionLabels } from "../../domain/catalog";
import { command } from "../../services/workspaceData";
import { session } from "../../services/session";
import { connection } from "../../services/http";
const rows = ref<{ id: string; enabled: boolean; order: number }[]>([]),
  version = ref<number>(),
  dirty = ref(false),
  error = ref("");
const allowed = computed(() => session.user?.roles.includes("national_admin"));
function reset() {
  rows.value = homepageConfig.sections
    .map((x) => ({ ...x }))
    .sort((a, b) => a.order - b.order);
  version.value = homepageConfig.lockVersion;
  dirty.value = false;
  error.value = "";
}
watch(
  () => homepageConfig.lockVersion,
  () => {
    if (!dirty.value) reset();
  },
  { immediate: true },
);
function move(index: number, direction: number) {
  const target = index + direction;
  if (target < 0 || target >= rows.value.length) return;
  [rows.value[index], rows.value[target]] = [rows.value[target]!, rows.value[index]!];
  dirty.value = true;
}
async function save() {
  if (!allowed.value || !dirty.value) return;
  try {
    await command(
      "saveHomepageConfig",
      { sections: rows.value.map((x, index) => ({ ...x, order: index })) },
      undefined,
      version.value,
    );
    reset();
    ElMessage.success("首页栏目设置已保存");
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "保存失败，修改已保留";
  }
}
</script>
<template>
  <section class="panel homepage-editor">
    <h2>首页栏目</h2>
    <p>轮播固定在首页首位；下列栏目可以排序和启停，用户端读取保存后的布局。</p>
    <el-alert
      v-if="!allowed"
      title="仅全国管理员可以修改首页栏目。"
      type="info"
      :closable="false"
    /><el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-for="(row, index) in rows" :key="row.id" class="section-row">
      <span class="section-order">{{ index + 1 }}</span
      ><strong>{{ sectionLabels[row.id] || row.id }}</strong
      ><el-switch
        v-model="row.enabled"
        :disabled="!allowed || connection.pending > 0"
        active-text="展示"
        inactive-text="隐藏"
        @change="dirty = true"
      />
      <div>
        <el-button
          :disabled="!allowed || index === 0 || connection.pending > 0"
          @click="move(index, -1)"
          >上移</el-button
        ><el-button
          :disabled="!allowed || index === rows.length - 1 || connection.pending > 0"
          @click="move(index, 1)"
          >下移</el-button
        >
      </div>
    </div>
    <el-empty v-if="!rows.length" description="首页配置尚未加载" />
    <div class="home-actions">
      <el-button :disabled="!dirty || connection.pending > 0" @click="reset"
        >撤销修改</el-button
      ><el-button
        type="primary"
        :disabled="!allowed || !dirty"
        :loading="connection.pending > 0"
        @click="save"
        >保存首页布局</el-button
      >
    </div>
  </section>
</template>
<style scoped>
.homepage-editor {
  padding: 24px;
}
.homepage-editor h2 {
  font-size: 19px;
  margin-top: 0;
}
.homepage-editor > p {
  font-size: 13px;
  color: #6c7365;
  line-height: 1.8;
}
.section-row {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 16px 0;
  border-bottom: 1px solid #ecefe8;
}
.section-order {
  color: #939a8d;
}
.section-row strong {
  flex: 1;
  min-width: 90px;
  font-size: 14px;
}
.home-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}
@media (max-width: 600px) {
  .homepage-editor {
    padding: 18px 12px;
  }
  .section-row {
    flex-wrap: wrap;
    gap: 12px;
  }
  .section-row > div {
    width: 100%;
    padding-left: 24px;
  }
}
</style>
