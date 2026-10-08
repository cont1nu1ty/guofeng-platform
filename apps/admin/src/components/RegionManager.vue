<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  regionChildren,
  saveRegion,
  type RegionNode,
} from "../services/regions";
import { can } from "../services/session";
import { newRequestId } from "../services/http";
const path = ref<RegionNode[]>([]),
  items = ref<RegionNode[]>([]),
  busy = ref(false),
  error = ref("");
const parent = computed(() => path.value.at(-1));
const editing = ref(false),
  form = reactive<Record<string, any>>({});
let epoch = 0,
  key = "",
  payload = "";
async function load() {
  const seq = ++epoch;
  busy.value = true;
  error.value = "";
  try {
    const result = await regionChildren(parent.value?.id);
    if (seq === epoch) items.value = result;
  } catch (e) {
    if (seq === epoch)
      error.value = e instanceof Error ? e.message : "地区加载失败";
  } finally {
    if (seq === epoch) busy.value = false;
  }
}
function enter(item: RegionNode) {
  path.value.push(item);
  void load();
}
function back(index: number) {
  path.value = path.value.slice(0, index);
  void load();
}
function edit(item?: RegionNode) {
  Object.keys(form).forEach((k) => delete form[k]);
  Object.assign(
    form,
    item || {
      parentId: parent.value?.id,
      name: "",
      nameEn: "",
      officialCode: "",
      source: "",
      enabled: true,
    },
  );
  editing.value = true;
}
async function save() {
  if (busy.value || !can("regions:write")) return;
  if (!String(form.name).trim() || String(form.source).trim().length < 2)
    return ElMessage.warning("请填写名称及核对来源");
  const next = JSON.stringify(form);
  if (payload !== next) {
    key = newRequestId();
    payload = next;
  }
  busy.value = true;
  error.value = "";
  try {
    await saveRegion(form, key);
    editing.value = false;
    ElMessage.success("地区目录已保存");
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "地区未保存，请重试";
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section aria-label="市县地区目录">
    <el-alert
      title="维护经核对的省、市、区县目录；请记录来源。地区目录用于阵地筛选，账号权限仍按原有省级范围控制。停用父节点后，下级也不向用户展示。"
      type="info"
      :closable="false"
    />
    <div class="region-toolbar">
      <el-button :disabled="busy || !path.length" @click="back(0)"
        >全部省级地区</el-button
      >
      <el-button
        v-for="(item, index) in path"
        :key="item.id"
        :disabled="busy"
        @click="back(index + 1)"
        >{{ item.name }}</el-button
      >
      <el-button
        v-if="parent && parent.level < 2 && can('regions:write')"
        type="primary"
        :disabled="busy"
        @click="edit()"
        >新增{{ parent.level === 0 ? "城市" : "区县" }}</el-button
      >
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table
      :data="items"
      v-loading="busy"
      empty-text="当前没有下级节点，可依据核对来源新增。"
    >
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="nameEn" label="英文名称" />
      <el-table-column prop="officialCode" label="行政区划编码" />
      <el-table-column label="状态"
        ><template #default="{ row }">{{
          row.enabled ? "启用" : "停用"
        }}</template></el-table-column
      >
      <el-table-column label="操作"
        ><template #default="{ row }">
          <el-button
            v-if="row.level < 2"
            link
            :disabled="busy"
            @click="enter(row)"
            >下级目录</el-button
          >
          <el-button
            v-if="row.level > 0 && can('regions:write')"
            link
            :disabled="busy"
            @click="edit(row)"
            >编辑</el-button
          >
        </template></el-table-column
      >
    </el-table>
    <el-dialog v-model="editing" title="维护地区节点" width="min(600px, 94vw)">
      <el-form label-position="top">
        <el-form-item label="地区名称" required
          ><el-input v-model="form.name" maxlength="100"
        /></el-form-item>
        <el-form-item label="英文名称"
          ><el-input v-model="form.nameEn" maxlength="200"
        /></el-form-item>
        <el-form-item label="行政区划编码（有依据时填写）"
          ><el-input v-model="form.officialCode" maxlength="40"
        /></el-form-item>
        <el-form-item label="核对来源与日期" required
          ><el-input
            v-model="form.source"
            type="textarea"
            :rows="3"
            maxlength="1000"
            placeholder="填写公开资料名称、发布机构或链接，以及核对日期"
        /></el-form-item>
        <el-form-item label="允许用户筛选"
          ><el-switch v-model="form.enabled"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="editing = false">取消</el-button
        ><el-button
          v-if="can('regions:write')"
          type="primary"
          :loading="busy"
          @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>
<style scoped>
.region-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
}
.region-toolbar .el-button {
  margin-left: 0;
}
</style>
