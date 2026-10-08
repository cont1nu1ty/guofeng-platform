<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import { isHttpMode } from "../services/mode";
import { recordPage, resetRecordPage, loadCurrentPage, collectionsForRoute } from "../services/workspaceData";
import { reportError } from "../services/http";
import { workspace } from "../domain/workspace";
import { api, newRequestId } from "../services/http";
import { can } from "../services/session";
import { useRouter } from "vue-router";
const route = useRoute();
const router = useRouter();
const choices = computed(() => collectionsForRoute(route.path));
const labels: Record<string, string> = { submissions: "稿件", tasks: "评审任务", experts: "专家", contents: "资讯", collections: "卷册", activities: "活动", products: "产品", welfareClaims: "申领与咨询", banners: "轮播", mediaItems: "媒体", venues: "阵地", hallPeople: "人物", supportTickets: "问题单", notificationDrafts: "通知", activityLog: "审计日志" };
const statuses = computed(() => ({ submissions:['待初审','评审中','退回修改','已入围','已获奖','已入藏','未入围'],tasks:['待评分','已完成','已取消'],contents:['草稿','已发布','已下架'],collections:['编纂中','待发布','已入藏'],activities:['草稿','报名中','进行中','已结束'],products:['已上架','已下架'],mediaItems:['待审核','已发布','已退回'],banners:['草稿','已发布','已下架'],venues:['草稿','已发布','已下架'] } as Record<string,string[]>)[recordPage.collection] || []);
async function exportCsv() { try { await api('/admin/exports',{method:'POST',headers:{'Idempotency-Key':newRequestId()},body:JSON.stringify({kind:'csv',collection:recordPage.collection,q:recordPage.q,status:recordPage.status,region:workspace.region})});await router.push('/jobs'); }catch(e){reportError(e);} }
async function reload(reset = false) { if (reset) recordPage.page = 1; try { await loadCurrentPage(); } catch (e) { reportError(e); } }
watch(() => route.path, path => { resetRecordPage(path); void reload(); });
watch(() => workspace.region, () => { void reload(true); });
</script>
<template>
  <section v-if="isHttpMode && choices.length" class="server-page-bar" aria-label="服务端列表筛选">
    <strong>{{labels[recordPage.collection] || recordPage.collection}}</strong>
    <el-input v-model="recordPage.q" clearable placeholder="搜索全部记录的标题、名称或编号" aria-label="搜索全部记录" @keyup.enter="reload(true)" @clear="reload(true)" />
    <el-button :loading="recordPage.loading" @click="reload(true)">查询</el-button>
    <el-select v-if="statuses.length" v-model="recordPage.status" clearable placeholder="全部状态" aria-label="状态筛选" @change="reload(true)"><el-option v-for="status in statuses" :key="status" :value="status"/></el-select>
    <el-button v-if="recordPage.collection!=='activityLog' && can(recordPage.collection==='submissions'?'submissions:export':'jobs:export')" @click="exportCsv">导出筛选结果</el-button>
    <el-pagination v-model:current-page="recordPage.page" v-model:page-size="recordPage.pageSize" :page-sizes="[10,25,50,100]" :total="recordPage.total" layout="total, prev, pager, next" :pager-count="5" small @current-change="reload()" @size-change="reload(true)" />
    <p>这里的搜索、状态和地区筛选作用于全部记录；页面内分类筛选作用于当前页。导出最多5000条。</p>
  </section>
</template>
<style scoped>
.server-page-bar { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:20px; padding:14px; border:1px solid var(--border-color, #e5e3d9); border-radius:8px; background:var(--card-bg, #fffdf8); }
.server-page-bar .el-input { flex:1; min-width:180px; max-width:420px; }
.server-page-bar .el-select { width:130px; }
.server-page-bar p { flex-basis:100%; margin:0; font-size:12px; color:#66705d; }
@media(max-width:600px){ .server-page-bar .el-pagination { max-width:100%; overflow-x:auto; } }
</style>
