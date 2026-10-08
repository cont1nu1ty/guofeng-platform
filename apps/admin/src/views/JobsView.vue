<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import PageHeading from '../components/PageHeading.vue';
import { api, reportError } from '../services/http';
import { isHttpMode } from '../services/mode';
import DeliveryPreferences from '../components/DeliveryPreferences.vue';
type Job = { id: string; kind: string; status: string; attempts: number; errorCode: string; createdAt: string; result: { name?: string; sha256?: string } };
const rows=ref<Job[]>([]), total=ref(0), page=ref(1), busy=ref(false), error=ref('');
const labels:Record<string,string>={queued:'等待执行',running:'生成中',completed:'已生成',failed:'失败',cancelled:'已取消'};
let timer:ReturnType<typeof setTimeout> | undefined; let disposed=false;
async function load(){if(!isHttpMode)return;busy.value=true;error.value='';try{const result=await api<{items:Job[];total:number}>(`/admin/exports?page=${page.value}&pageSize=20`);if(!disposed){rows.value=result.items;total.value=result.total;}}catch(e){error.value=e instanceof Error?e.message:'读取任务失败';}finally{busy.value=false;if(timer)clearTimeout(timer);if(!disposed&&rows.value.some(r=>['queued','running'].includes(r.status)))timer=setTimeout(load,5000);}}
async function action(row:Job, name:string){try{await api(`/admin/exports/${encodeURIComponent(row.id)}/${name}`,{method:'POST'});await load();}catch(e){reportError(e);}}
async function download(row:Job){try{const result=await api<{url:string}>(`/admin/exports/${encodeURIComponent(row.id)}/download`);const anchor=document.createElement('a');anchor.href=result.url;anchor.rel='noopener noreferrer';anchor.download=row.result.name||'';anchor.click();}catch(e){reportError(e);}}
onMounted(load);onUnmounted(()=>{disposed=true;if(timer)clearTimeout(timer);});
</script>
<template>
  <PageHeading title="导出与报告" description="任务保存提交时的数据快照，下载时再次检查当前权限。业务报告归档保留；临时导出可下载7天。" eyebrow="ARCHIVE / 导出任务"><template #actions><el-button :loading="busy" @click="load">刷新</el-button></template></PageHeading>
  <el-alert v-if="!isHttpMode" title="导出任务需要真实服务模式" type="info" :closable="false"/>
  <el-alert v-if="error" :title="error" type="error" :closable="false"/>
  <el-table :data="rows" stripe><el-table-column prop="id" label="任务编号" min-width="200"/><el-table-column label="类型" width="110"><template #default="{row}">{{row.kind==='report'?'统计报告':row.kind==='collection'?'典籍导出':'数据CSV'}}</template></el-table-column><el-table-column label="状态" width="110"><template #default="{row}">{{labels[row.status]||row.status}}</template></el-table-column><el-table-column label="创建时间" min-width="160"><template #default="{row}">{{new Date(row.createdAt).toLocaleString('zh-CN')}}</template></el-table-column><el-table-column prop="errorCode" label="失败原因"/><el-table-column label="操作" min-width="160"><template #default="{row}"><el-button v-if="row.status==='completed'" link type="primary" @click="download(row)">下载</el-button><el-button v-if="row.status==='failed'" link @click="action(row,'retry')">重试</el-button><el-button v-if="['queued','running','failed'].includes(row.status)" link @click="action(row,'cancel')">取消</el-button></template></el-table-column></el-table>
  <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="total,prev,pager,next" @current-change="load"/>
  <DeliveryPreferences v-if="isHttpMode"/>
</template>
