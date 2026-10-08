<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { remoteUser } from '../services/api'
import { getResources, downloadCredential } from '../services/credentials'
import type { ResourceRecord } from '../domain/credentials'
import { t } from '../composables/useLocale'
import { navigate } from '../composables/useNavigation'
const records=ref<ResourceRecord[]>([]),page=ref(1),total=ref(0),loading=ref(false),error=ref(''),busy=ref(''),selected=ref(''),accepted=ref(false)
let generation=0
async function load(){const current=++generation;records.value=[];selected.value='';accepted.value=false;error.value='';loading.value=true;try{const result=await getResources(page.value);if(current===generation){records.value=result.items;total.value=result.total}}catch(failure){if(current===generation)error.value=failure instanceof Error?failure.message:t('资源加载失败','Failed to load resources')}finally{if(current===generation)loading.value=false}}
watch(()=>remoteUser.value?.id,()=>{page.value=1;busy.value='';void load()},{immediate:true});onBeforeUnmount(()=>generation++)
async function download(item:ResourceRecord){if(!remoteUser.value){navigate('profile');return}if(!accepted.value)return;const current=generation;busy.value=item.id;error.value='';try{await downloadCredential('resource',item)}catch(failure){if(current===generation)error.value=failure instanceof Error?failure.message:t('下载失败，请刷新目录后重试','Download failed. Refresh this directory and retry.')}finally{if(current===generation)busy.value=''}}
function turn(delta:number){page.value+=delta;void load()}
</script>
<template>
  <view class="resource-directory">
    <view class="resource-heading"><text class="resource-title">{{t('授权资源下载','Authorized resources')}}</text><wd-button variant="text" size="small" :disabled="loading" @click="load">{{t('刷新目录','Refresh')}}</wd-button></view>
    <text class="muted">{{t('请阅读每份资源的使用许可和署名要求。下载需登录，并按账号地区授权。','Read each resource’s licence and attribution requirements. Sign-in and any required regional access are checked for download.')}}</text>
    <text v-if="loading">{{t('正在读取目录…','Loading directory…')}}</text><text v-if="error" role="alert" class="resource-error">{{error}}</text>
    <view v-for="item in records" :key="item.id" class="resource-card"><text class="resource-title">{{item.title}}</text><text>{{item.description}}</text><text class="muted">{{item.fileName}} · {{Math.ceil(item.size/1024)}} KB</text><text>{{t('来源 / 署名：','Source / attribution: ')}}{{item.attribution}}</text><wd-button variant="plain" size="small" @click="selected=selected===item.id?'':item.id;accepted=false">{{t('使用许可与下载','Licence and download')}}</wd-button><view v-if="selected===item.id" class="resource-license"><text>{{item.licenseText}}</text><wd-checkbox v-if="remoteUser" v-model="accepted" :disabled="!!busy">{{t('已阅读并同意本版本使用许可','I agree to this version of the licence')}}</wd-checkbox><wd-button size="small" :disabled="!!busy || (!!remoteUser&&!accepted)" :loading="busy===item.id" @click="download(item)">{{remoteUser?t('授权下载','Download'):t('登录后下载','Sign in to download')}}</wd-button></view></view>
    <text v-if="!loading&&!records.length" class="muted">{{t('暂无可下载的授权资源','No authorized resources are available yet')}}</text>
    <view v-if="total>10" class="resource-heading"><wd-button size="small" variant="text" :disabled="page===1||loading" @click="turn(-1)">{{t('上一页','Previous')}}</wd-button><text>{{page}} / {{Math.ceil(total/10)}}</text><wd-button size="small" variant="text" :disabled="page*10>=total||loading" @click="turn(1)">{{t('下一页','Next')}}</wd-button></view>
  </view>
</template>
<style scoped>
.resource-directory{margin:30px 0;padding:24px;background:#f7f3e9;border:1px solid #ded8cc;border-radius:12px;display:flex;flex-direction:column;gap:16px;line-height:1.8}.resource-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.resource-title{font-size:20px;font-weight:700}.resource-card{padding:20px;background:#fffdf8;border-radius:8px;display:flex;flex-direction:column;align-items:flex-start;gap:10px}.resource-license{display:flex;flex-direction:column;align-items:flex-start;gap:14px;white-space:pre-wrap}.resource-error{color:#a6382c}@media(max-width:600px){.resource-directory{padding:16px}.resource-card{padding:16px}}
</style>
