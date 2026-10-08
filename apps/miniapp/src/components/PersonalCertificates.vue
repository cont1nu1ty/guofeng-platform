<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { remoteUser } from '../services/api'
import { getCertificates, getConfirmations, downloadCredential, verifyCertificate } from '../services/credentials'
import type { CertificateRecord, CopyrightConfirmation } from '../domain/credentials'
import { validVerificationCode } from '../domain/credentials'
import { t } from '../composables/useLocale'
import { navigate } from '../composables/useNavigation'
const records=ref<CertificateRecord[]>([]), confirmations=ref<CopyrightConfirmation[]>([]), page=ref(1), total=ref(0), loading=ref(false), error=ref(''), busy=ref('')
const code=ref(''), verified=ref<Awaited<ReturnType<typeof verifyCertificate>>>(), expanded=ref('')
let generation=0
async function load() {
  const current=++generation; records.value=[]; confirmations.value=[]; total.value=0; error.value=''; loading.value=false
  if(!remoteUser.value)return
  loading.value=true
  try{const [certs,rights]=await Promise.all([getCertificates(page.value),getConfirmations()]);if(current===generation){records.value=certs.items;total.value=certs.total;confirmations.value=rights.items}}
  catch(failure){if(current===generation)error.value=failure instanceof Error?failure.message:t('记录加载失败','Failed to load records')}
  finally{if(current===generation)loading.value=false}
}
watch(()=>remoteUser.value?.id,()=>{page.value=1;verified.value=undefined;code.value='';busy.value='';void load()},{immediate:true})
onBeforeUnmount(()=>generation++)
async function download(item:CertificateRecord){const current=generation;busy.value=item.id;error.value='';try{await downloadCredential('certificate',item)}catch(failure){if(current===generation)error.value=failure instanceof Error?failure.message:t('下载失败','Download failed')}finally{if(current===generation)busy.value=''}}
async function verify(){if(!validVerificationCode(code.value)){error.value=t('请输入32位验真码','Enter a 32-character verification code');return}const current=generation;busy.value='verify';verified.value=undefined;error.value='';try{const result=await verifyCertificate(code.value);if(current===generation)verified.value=result}catch(failure){if(current===generation)error.value=failure instanceof Error?failure.message:t('验真失败','Verification failed')}finally{if(current===generation)busy.value=''}}
function turn(delta:number){page.value+=delta;void load()}
</script>
<template>
  <view class="credential-list">
    <text class="scope-note">{{t('人工签发的获奖与结业证书。云端保留签发记录，每次下载会重新核验权限及撤销状态。','Manually issued award and completion certificates. Cloud records are retained; every download checks access and revocation.')}}</text>
    <wd-button v-if="!remoteUser" size="small" @click="navigate('profile')">{{t('请在个人中心登录','Sign in in your profile')}}</wd-button>
    <text v-if="loading">{{t('正在读取记录…','Loading records…')}}</text>
    <text v-if="error" role="alert" class="credential-error">{{error}}</text>
    <view v-for="item in records" :key="item.id" class="credential-card">
      <view class="credential-top"><text class="credential-title">{{item.title}}</text><text :class="['tag',{'credential-error':item.status==='revoked'}]">{{item.status==='issued'?t('有效','Issued'):t('已撤销','Revoked')}}</text></view>
      <text>{{item.sourceTitle}}</text><text>{{item.holderName}} · {{item.issuer}}</text><text class="muted">{{item.certificateNo}} · {{item.issuedAt.slice(0,10)}}</text>
      <text v-if="item.revokeReason">{{t('撤销原因：','Revocation reason: ')}}{{item.revokeReason}}</text>
      <text selectable class="credential-code">{{t('验真码：','Verification code: ')}}{{item.verifyToken}}</text>
      <wd-button size="small" variant="plain" :loading="busy===item.id" :disabled="!!busy || item.status==='revoked'" @click="download(item)">{{t('下载证书 PDF','Download certificate PDF')}}</wd-button>
    </view>
    <text v-if="remoteUser&&!loading&&!records.length" class="muted">{{t('还没有签发记录。完成课程或获得授奖后，由管理人员核验资格并签发。','No issued certificates yet. Staff verify completed learning or an award before issuance.')}}</text>
    <view v-if="total>10" class="credential-top"><wd-button size="small" variant="text" :disabled="page===1||loading" @click="turn(-1)">{{t('上一页','Previous')}}</wd-button><text>{{page}} / {{Math.ceil(total/10)}}</text><wd-button size="small" variant="text" :disabled="page*10>=total||loading" @click="turn(1)">{{t('下一页','Next')}}</wd-button></view>
    <view class="credential-card"><text class="credential-title">{{t('公开验真','Verify a certificate')}}</text><text class="muted">{{t('验真仅显示编号、签发单位和状态，不公开持有人及作品信息。','Verification shows the number, issuer and status, without identifying the holder or submission.')}}</text><input v-model="code" :placeholder="t('输入32位验真码','Enter the 32-character code')" maxlength="32" class="credential-input"/><wd-button size="small" :loading="busy==='verify'" :disabled="!!busy" @click="verify">{{t('查询状态','Check status')}}</wd-button><text v-if="verified">{{verified.certificateNo}} · {{verified.issuer}} · {{verified.status==='issued'?t('有效','Issued'):t('已撤销','Revoked')}}</text></view>
    <text class="credential-title">{{t('投稿须知确认历史','Submission terms history')}}</text><text class="muted">{{t('这里记录本人明确确认的版本；历史勾选不会补造为正式签章或确认凭证。','Explicit confirmations are recorded here. Earlier checkboxes are not backfilled as signatures or confirmation evidence.')}}</text>
    <view v-for="item in confirmations" :key="item.id" class="credential-card"><text>{{item.submissionId}} · {{item.agreementVersion}}</text><text class="muted">{{item.acceptedAt}}</text><wd-button variant="text" size="small" @click="expanded=expanded===item.id?'':item.id">{{t('查看确认全文','Read the accepted terms')}}</wd-button><text v-if="expanded===item.id">{{item.agreementText}}</text></view>
    <text v-if="remoteUser&&!loading&&!confirmations.length" class="muted">{{t('暂无明确确认记录','No explicit confirmations yet')}}</text>
  </view>
</template>
<style scoped>
.credential-list{display:flex;flex-direction:column;gap:18px}.credential-card{overflow-wrap:anywhere;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:20px;border:1px solid #ded8cc;border-radius:10px;background:#fffdf8;line-height:1.7}.credential-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;width:100%}.credential-title{font-weight:700;font-size:18px}.credential-code{overflow-wrap:anywhere}.credential-error{color:#a6382c}.credential-input{box-sizing:border-box;width:100%;min-height:44px;padding:10px;border:1px solid #c9bcaa;border-radius:6px;font-size:15px}
</style>
