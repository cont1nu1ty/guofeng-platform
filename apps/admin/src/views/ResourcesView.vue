<script setup lang="ts">
import { computed,onMounted,reactive,ref } from "vue";
import { ElMessage,type UploadFile } from "element-plus";
import { Plus,Refresh } from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import Pagination from "../components/upstream/Pagination.vue";
import { can,session } from "../services/session";
import { isHttpMode } from "../services/mode";
import { regionCatalog } from "../domain/regions";
import { emptyResource,readableBytes,resourceFieldErrors,type AuthorizedResource } from "../domain/credentials";
import { listResources,prepareCredentialWrite } from "../services/credentials";
import { uploadFile } from "../services/files";
const items=ref<AuthorizedResource[]>([]),total=ref(0),page=ref(1),pageSize=ref(20),query=ref(""),loading=ref(false),busy=ref(false),error=ref("");
const open=ref(false),form=reactive(emptyResource()),errors=ref<Record<string,string>>({}),formError=ref("");
const regions=computed(()=>session.user?.roles.includes("national_admin")?[{id:"all",name:"全国"},...regionCatalog]:regionCatalog.filter(r=>session.user?.regionIds.includes(r.id)));
let prepared:{signature:string;run:ReturnType<typeof prepareCredentialWrite>}|undefined;
async function load(){if(!isHttpMode)return;loading.value=true;error.value="";try{const value=await listResources(page.value,pageSize.value,query.value);items.value=value.items;total.value=value.total;}catch(e){error.value=e instanceof Error?e.message:"目录加载失败";}finally{loading.value=false;}}
function edit(item?:AuthorizedResource){Object.assign(form,emptyResource(),item||{regionId:regions.value[0]?.id||""},{authorized:false});errors.value={};formError.value="";prepared=undefined;open.value=true;}
async function selectFile(item:UploadFile){if(!item.raw)return;busy.value=true;formError.value="";try{const file=await uploadFile(item.raw);form.fileId=file.fileId;form.fileName=file.name;}catch(e){formError.value=e instanceof Error?e.message:"文件上传失败";}finally{busy.value=false;}}
async function save(){errors.value=resourceFieldErrors(form);if(Object.keys(errors.value).length){formError.value="请补齐资源信息并核对分发授权。";return;}const payload={...form},signature=JSON.stringify(payload);if(!prepared||prepared.signature!==signature)prepared={signature,run:prepareCredentialWrite(form.id?`/admin/resources/${encodeURIComponent(form.id)}`:"/admin/resources",payload)};busy.value=true;formError.value="";try{await prepared.run();ElMessage.success("资源已保存");open.value=false;prepared=undefined;await load();}catch(e){formError.value=e instanceof Error?e.message:"资源保存失败";}finally{busy.value=false;}}
onMounted(load);
</script>
<template>
  <PageHeading title="授权资源" description="管理可下载文件、使用许可与适用范围，发布前确认分发授权。" eyebrow="AUTHORIZED RESOURCES"><template #actions><el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button><el-button v-if="isHttpMode&&can('resources:write')" :icon="Plus" type="primary" @click="edit()">新增资源</el-button></template></PageHeading>
  <el-alert v-if="!isHttpMode" title="授权资源需要连接真实服务，演示模式不会发布文件。" type="info" :closable="false" />
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
  <section v-if="isHttpMode" class="panel"><div class="filter-bar"><el-input v-model="query" placeholder="搜索资源标题" aria-label="搜索资源" clearable @keyup.enter="page=1;load()" /><el-button @click="page=1;load()">查询</el-button></div>
    <el-table v-loading="loading" :data="items" row-key="id" empty-text="暂无资源"><el-table-column prop="title" label="资源名称" min-width="190" /><el-table-column label="文件" min-width="210"><template #default="{row}">{{row.fileName}}<div class="muted">{{readableBytes(row.size)}}</div></template></el-table-column><el-table-column prop="attribution" label="权利人 / 来源" min-width="160" /><el-table-column prop="region" label="管理地区" min-width="110" /><el-table-column label="状态" width="100"><template #default="{row}"><el-tag :type="row.status==='published'?'success':'info'">{{row.status==='published'?'已发布':row.status==='withdrawn'?'已下架':'草稿'}}</el-tag></template></el-table-column><el-table-column label="操作" width="95" fixed="right"><template #default="{row}"><el-button v-if="can('resources:write')" link type="primary" @click="edit(row)">编辑</el-button></template></el-table-column></el-table>
    <Pagination v-model:page="page" v-model:limit="pageSize" :total="total" @pagination="load" />
  </section>
  <el-dialog v-model="open" :title="form.id?'编辑授权资源':'新增授权资源'" width="min(680px,94vw)" :close-on-click-modal="!busy"><el-alert v-if="formError" :title="formError" type="error" :closable="false" />
    <el-form label-position="top" :disabled="busy"><el-form-item label="资源标题" required :error="errors.title"><el-input v-model="form.title" maxlength="160" /></el-form-item><el-form-item label="资源说明" required :error="errors.description"><el-input v-model="form.description" type="textarea" :rows="2" maxlength="2000" /></el-form-item>
      <div class="resource-form-grid"><el-form-item label="管理地区" required :error="errors.regionId"><el-select v-model="form.regionId"><el-option v-for="r in regions" :key="r.id" :value="r.id" :label="r.name" /></el-select></el-form-item><el-form-item label="下载范围" required><el-select v-model="form.audience"><el-option value="all_members" label="全部登录用户" /><el-option value="authorized_regions" label="账号授权地区内用户" /></el-select></el-form-item></div>
      <el-form-item label="资源文件（PDF / Word / 图片，10MB以内）" required :error="errors.fileId"><el-upload :auto-upload="false" :show-file-list="false" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" :on-change="selectFile" :disabled="busy"><el-button :loading="busy">选择并上传文件</el-button></el-upload><p class="resource-filename">{{form.fileName||'尚未选择文件'}}</p></el-form-item>
      <el-form-item label="权利人或来源署名" required :error="errors.attribution"><el-input v-model="form.attribution" maxlength="500" /></el-form-item><el-form-item label="资源使用许可" required :error="errors.licenseText"><el-input v-model="form.licenseText" type="textarea" :rows="4" maxlength="4000" placeholder="说明允许用途、转载署名要求和禁止事项，不使用未经确认的默认授权" /></el-form-item>
      <el-form-item label="发布状态"><el-radio-group v-model="form.status"><el-radio value="draft">草稿</el-radio><el-radio value="published">发布</el-radio><el-radio value="withdrawn">下架</el-radio></el-radio-group></el-form-item>
      <el-form-item v-if="form.status==='published'" :error="errors.authorized"><el-checkbox v-model="form.authorized">我确认有权按以上许可向所选范围分发该文件</el-checkbox></el-form-item>
    </el-form><template #footer><el-button :disabled="busy" @click="open=false">取消</el-button><el-button type="primary" :loading="busy" @click="save">保存资源</el-button></template>
  </el-dialog>
</template>
<style scoped>.resource-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.el-select{width:100%}.resource-filename{width:100%;overflow-wrap:anywhere;margin:8px 0 0}.el-alert+.panel{margin-top:18px}@media(max-width:600px){.resource-form-grid{grid-template-columns:1fr;gap:0}}</style>
