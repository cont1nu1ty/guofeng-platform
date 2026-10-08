<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { api, reportError } from '../services/http';
import { can } from '../services/session';
const value=reactive({digest:'off',draftNotice:true,reports:[] as string[]});
const busy=ref(false),saved=ref(false);
onMounted(async()=>{try{Object.assign(value,await api('/me/delivery-preferences'));}catch(e){reportError(e);}});
async function save(){busy.value=true;saved.value=false;try{Object.assign(value,await api('/me/delivery-preferences',{method:'PUT',body:JSON.stringify(value)}));saved.value=true;}catch(e){reportError(e);}finally{busy.value=false;}}
</script>
<template><section class="delivery"><h2>我的自动提醒与报告</h2><p>摘要只统计本人业务消息；草稿超过三天未修改时提醒一次。自动报告按北京时间归档完整的上一月、季度或年度，从启用后的周期边界开始。</p><el-form label-position="top"><el-form-item label="站内消息摘要"><el-select v-model="value.digest" aria-label="摘要频率"><el-option value="off" label="关闭"/><el-option value="daily" label="每天"/><el-option value="weekly" label="每周"/></el-select></el-form-item><el-form-item label="草稿提醒"><el-switch v-model="value.draftNotice" aria-label="草稿提醒"/></el-form-item><el-form-item v-if="can('analytics:export')" label="自动报告归档"><el-checkbox-group v-model="value.reports"><el-checkbox value="month">月报</el-checkbox><el-checkbox value="quarter">季报</el-checkbox><el-checkbox value="year">年报</el-checkbox></el-checkbox-group></el-form-item><el-button :loading="busy" @click="save">保存设置</el-button><span v-if="saved" role="status"> 已保存，调度服务将按设置执行。</span></el-form></section></template>
<style scoped>.delivery{margin-top:26px;border-top:1px solid #e3e5d9;padding-top:20px}.delivery h2{font-size:18px}.delivery p{color:#64725a;line-height:1.7}.el-select{max-width:220px}</style>
