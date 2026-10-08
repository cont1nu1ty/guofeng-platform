<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Refresh } from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import Pagination from "../components/upstream/Pagination.vue";
import { can } from "../services/session";
import { isHttpMode } from "../services/mode";
import { listCertificates, eligibleCertificates, prepareCredentialWrite, downloadCertificate, verifyCertificate } from "../services/credentials";
import type { Certificate, CertificateSource } from "../domain/credentials";
const items=ref<Certificate[]>([]),total=ref(0),page=ref(1),pageSize=ref(20),loading=ref(false),busy=ref(false),error=ref("");
const issueOpen=ref(false),query=ref(""),sources=ref<CertificateSource[]>([]),selected=ref<number>(),issuer=ref("家风中华行"),issueError=ref("");
const verification=ref<Awaited<ReturnType<typeof verifyCertificate>>|null>(null),verificationOpen=ref(false),verifyToken=ref("");
const source=computed(()=>selected.value===undefined?null:sources.value[selected.value]);
let prepared: {signature:string;run:ReturnType<typeof prepareCredentialWrite>}|undefined;
async function load(){if(!isHttpMode)return;loading.value=true;error.value="";try{const value=await listCertificates(page.value,pageSize.value);items.value=value.items;total.value=value.total;}catch(e){error.value=e instanceof Error?e.message:"证书加载失败";}finally{loading.value=false;}}
async function findSources(){busy.value=true;issueError.value="";selected.value=undefined;try{sources.value=(await eligibleCertificates(query.value)).items;}catch(e){issueError.value=e instanceof Error?e.message:"资格加载失败";}finally{busy.value=false;}}
async function openIssue(){issueOpen.value=true;prepared=undefined;await findSources();}
async function issue(){if(!source.value||issuer.value.trim().length<2){issueError.value="请选择签发依据并填写签发单位。";return;}const payload={...source.value,issuer:issuer.value.trim()},signature=JSON.stringify(payload);if(!prepared||prepared.signature!==signature)prepared={signature,run:prepareCredentialWrite("/admin/certificates",payload)};busy.value=true;issueError.value="";try{await prepared.run();issueOpen.value=false;prepared=undefined;ElMessage.success("证书已签发并存入持有人账号");await load();}catch(e){issueError.value=e instanceof Error?e.message:"签发失败，请重试";}finally{busy.value=false;}}
async function revoke(item:Certificate){let reason:string;try{reason=(await ElMessageBox.prompt(`撤销 ${item.certificateNo} 后，验真将显示已撤销，并停止下载有效文件。`,"撤销证书",{inputType:"textarea",inputPlaceholder:"填写至少5字的撤销依据",inputValidator:(v:string)=>v.trim().length>=5||"请说明撤销依据",confirmButtonText:"确认撤销",cancelButtonText:"取消"})).value;}catch{return;}busy.value=true;try{await prepareCredentialWrite(`/admin/certificates/${encodeURIComponent(item.id)}/revoke`,{version:item.version,reason})();ElMessage.success("证书已撤销");await load();}catch(e){error.value=e instanceof Error?e.message:"撤销失败";}finally{busy.value=false;}}
async function download(item:Certificate){try{await downloadCertificate(item.id);}catch(e){error.value=e instanceof Error?e.message:"下载失败";}}
async function verify(token?:string){if(token)verifyToken.value=token;verificationOpen.value=true;verification.value=null;error.value="";try{verification.value=await verifyCertificate(verifyToken.value);}catch(e){error.value=e instanceof Error?e.message:"验真失败";}}
onMounted(load);
</script>
<template>
  <PageHeading title="证书签发" description="依据已确认的获奖结果或课程版本完成记录签发，并保留撤销和验真状态。" eyebrow="CERTIFICATES">
    <template #actions><el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button><el-button v-if="can('certificates:write')&&isHttpMode" :icon="Plus" type="primary" @click="openIssue">人工签发</el-button></template>
  </PageHeading>
  <el-alert v-if="!isHttpMode" title="证书签发需要连接真实服务。当前为界面演示模式。" type="info" :closable="false" />
  <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
  <section v-if="isHttpMode" class="panel">
    <el-table v-loading="loading" :data="items" row-key="id" empty-text="暂无证书签发记录">
      <el-table-column prop="certificateNo" label="编号" min-width="205" /><el-table-column prop="holderName" label="持有人" min-width="110" />
      <el-table-column label="签发依据" min-width="210"><template #default="{row}"><b>{{row.sourceTitle}}</b><div class="muted">{{row.kind==='award'?'获奖作品':'课程结业'}} · {{row.region}}</div></template></el-table-column>
      <el-table-column prop="issuer" label="签发单位" min-width="130" /><el-table-column label="状态" width="95"><template #default="{row}"><el-tag :type="row.status==='issued'?'success':'danger'">{{row.status==='issued'?'有效':'已撤销'}}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="185" fixed="right"><template #default="{row}"><el-button link type="primary" @click="verify(row.verifyToken)">验真</el-button><el-button link :disabled="row.status!=='issued'" @click="download(row)">下载</el-button><el-button v-if="can('certificates:write')" link type="danger" :disabled="row.status!=='issued'||busy" @click="revoke(row)">撤销</el-button></template></el-table-column>
    </el-table><Pagination v-model:page="page" v-model:limit="pageSize" :total="total" @pagination="load" />
  </section>
  <el-alert class="certificate-note" title="证书保存为可持续查询的业务记录，下载链接按次授权、短时有效。平台人工签发不等于第三方电子签章；公共验真不会返回持有人姓名或账号。" type="info" :closable="false" show-icon />
  <el-dialog v-model="issueOpen" title="人工签发证书" width="min(680px,94vw)" :close-on-click-modal="!busy">
    <el-alert v-if="issueError" :title="issueError" type="error" :closable="false" show-icon />
    <el-form label-position="top" :disabled="busy">
      <el-form-item label="查找持有人、作品或课程"><div class="certificate-search"><el-input v-model="query" @keyup.enter="findSources" /><el-button @click="findSources">查询资格</el-button></div></el-form-item>
      <el-form-item label="签发依据" required><el-select v-model="selected" filterable aria-label="选择签发依据"><el-option v-for="(item,index) in sources" :key="`${item.kind}:${item.sourceId}:${item.ownerId}:${item.courseVersion}`" :value="index" :label="`${item.name} · ${item.title} · ${item.kind==='award'?'获奖':'结业 v'+item.courseVersion}`" /></el-select></el-form-item>
      <p class="muted">每类最多显示100条，请按姓名或标题缩小查询。签发时服务端会再次核对资格。</p>
      <el-form-item label="签发单位" required><el-input v-model="issuer" maxlength="120" /></el-form-item>
      <el-alert title="保存会生成真实的平台签发文件并通知持有人，请确认签发权限、单位名称和业务依据。" type="warning" :closable="false" />
    </el-form><template #footer><el-button :disabled="busy" @click="issueOpen=false">取消</el-button><el-button type="primary" :loading="busy" :disabled="!source" @click="issue">确认签发</el-button></template>
  </el-dialog>
  <el-dialog v-model="verificationOpen" title="证书验真" width="min(620px,94vw)"><div class="certificate-search"><el-input v-model="verifyToken" aria-label="证书验真码" placeholder="输入证书上的验真码" /><el-button @click="verify()">查询</el-button></div>
    <el-descriptions v-if="verification" :column="1" border class="certificate-note"><el-descriptions-item label="证书编号">{{verification.certificateNo}}</el-descriptions-item><el-descriptions-item label="名称">{{verification.title}}</el-descriptions-item><el-descriptions-item label="签发单位">{{verification.issuer}}</el-descriptions-item><el-descriptions-item label="状态">{{verification.status==='issued'?'有效':'已撤销'}}</el-descriptions-item><el-descriptions-item label="文件SHA-256"><span class="certificate-hash">{{verification.fileHash}}</span></el-descriptions-item></el-descriptions>
  </el-dialog>
</template>
<style scoped>.certificate-note{margin-top:20px}.certificate-search{display:flex;gap:10px;width:100%}.el-select{width:100%}.certificate-hash{overflow-wrap:anywhere}.el-form-item .muted{font-size:12px}.el-alert+.panel{margin-top:18px}@media(max-width:600px){.certificate-search{flex-wrap:wrap}}</style>
