<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import PageHeading from "./PageHeading.vue";
import ChartPanel from "./ChartPanel.vue";
import { workspace, navigation } from "../domain/workspace";
import { api, reportError, newRequestId } from "../services/http";
import { can, canVisit } from "../services/session";
import { computed } from "vue";
const props = defineProps<{ overview?: boolean }>();
type Statistics = { engagement: {signedInViews:number;shareIntents:number};engagementDefinition:string; totals: { submissions: number; participants: number; reviewing: number; selected: number }; regions: { region: string; works: number; reviewing: number; selected: number }[]; trend: { date: string; submitted: number }[]; asOf: string; definition: string };
const statistics = ref<Statistics>();
const loading = ref(false);
const error = ref("");
const router = useRouter();
const shortcuts = computed(() => navigation.filter(item => item.path !== '/overview' && canVisit(item.path)));
let generation = 0;
async function load() {
  const request = ++generation;
  statistics.value = undefined;
  if (!can('analytics:read')) return;
  loading.value = true; error.value = '';
  try { const result = await api<Statistics>(`/admin/statistics?region=${encodeURIComponent(workspace.region)}`); if (request === generation) statistics.value = result; }
  catch (e) { if(request === generation) error.value = e instanceof Error ? e.message : '统计读取失败'; }
  finally { if(request === generation) loading.value = false; }
}
watch(() => workspace.region, load, { immediate: true });
const trend = computed(() => {
  const rows = [...(statistics.value?.trend || [])].reverse();
  return { tooltip: { trigger: 'axis' }, grid: { left: 45, right: 20, bottom: 35, top: 20 }, xAxis: { type: 'category', data: rows.map(r=>r.date) }, yAxis: { type: 'value', minInterval: 1 }, series: [{ type: 'line', data: rows.map(r=>Number(r.submitted)), smooth: false, color: '#a94335' }] };
});
async function exportReport() {
  try { await api('/admin/exports', { method: 'POST', headers: { 'Idempotency-Key': newRequestId() }, body: JSON.stringify({ kind: 'report', region: workspace.region }) }); await router.push('/jobs'); }
  catch(e) { reportError(e); }
}
</script>
<template>
  <PageHeading :title="props.overview ? '运营工作台' : '数据智库'" description="按当前岗位与地区范围读取服务端业务记录。" eyebrow="WORKSPACE / 业务工作台">
    <template #actions><el-button v-if="can('analytics:read')" :loading="loading" @click="load">刷新统计</el-button><el-button v-if="can('analytics:export')" @click="exportReport">归档统计报告</el-button></template>
  </PageHeading>
  <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
  <div v-if="statistics" class="server-analytics">
    <div class="metric-row"><article v-for="item in [{label:'投稿稿件',value:statistics.totals.submissions},{label:'参与账号',value:statistics.totals.participants},{label:'评审中',value:statistics.totals.reviewing},{label:'当前入选',value:statistics.totals.selected}]" :key="item.label"><span>{{item.label}}</span><strong>{{item.value}}</strong></article></div>
    <p class="metric-note">登录访问记录：{{statistics.engagement.signedInViews}} · 分享意向：{{statistics.engagement.shareIntents}}。{{statistics.engagementDefinition}}</p>
    <p class="metric-note">{{statistics.definition}} 截至 {{new Date(statistics.asOf).toLocaleString('zh-CN')}}。</p>
    <h2>投稿趋势 · 最近90个有投稿记录的日期</h2><ChartPanel label="最近投稿趋势" :option="trend" />
    <el-table :data="statistics.regions" stripe><el-table-column prop="region" label="地区"/><el-table-column prop="works" label="稿件"/><el-table-column prop="reviewing" label="评审中"/><el-table-column prop="selected" label="入选"/></el-table>
  </div>
  <section v-if="props.overview" class="shortcuts" aria-label="岗位工作入口"><h2>我的工作入口</h2><el-button v-for="item in shortcuts" :key="item.path" @click="router.push(item.path)">{{item.title}}</el-button><p v-if="!shortcuts.length">当前账号暂未分配后台模块权限，请联系账号管理员。</p></section>
</template>
<style scoped>
.metric-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.metric-row article{background:#fffdf8;border:1px solid #e3e5d9;padding:22px;border-radius:8px}.metric-row span{display:block;color:#68765e}.metric-row strong{display:block;font-size:32px;margin-top:12px;color:#9e4034}.metric-note{color:#69775d;font-size:13px;line-height:1.8}.shortcuts{margin-top:24px}.shortcuts .el-button{margin:6px}.shortcuts h2{font-size:18px}.server-analytics{display:grid;gap:18px}@media(max-width:640px){.metric-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.metric-row article{padding:14px}}
</style>
