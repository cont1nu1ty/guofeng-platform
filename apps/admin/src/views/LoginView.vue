<script setup lang="ts">
// Form lifecycle adapted from the fixed plus-ui login.vue snapshot (MIT).
import { reactive, ref } from "vue";
import { User, Lock } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import { login } from "../services/session";
const emit = defineEmits<{ authenticated: [] }>();
const loginRef = ref<FormInstance>();
const loginForm = reactive({ username: "", password: "" });
const loading = ref(false);
const error = ref("");
const loginRules: FormRules = {
  username: [{ required: true, message: "请输入账号", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};
async function handleLogin() {
  if (!(await loginRef.value?.validate().catch(() => false)) || loading.value)
    return;
  loading.value = true;
  error.value = "";
  try {
    await login(loginForm.username, loginForm.password);
    loginForm.password = "";
    emit("authenticated");
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "登录失败";
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <main class="login-page">
    <section class="login-card">
      <div class="brand-seal">家</div>
      <p class="login-eyebrow">家风中华行 · 运营管理平台</p>
      <h1>欢迎回到工作空间</h1>
      <p class="muted">请使用已授权的运营账号登录</p>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
      />
      <el-form
        ref="loginRef"
        :model="loginForm"
        :rules="loginRules"
        label-position="top"
        @submit.prevent="handleLogin"
      >
        <el-form-item label="账号" prop="username"
          ><el-input
            v-model="loginForm.username"
            :prefix-icon="User"
            autocomplete="username"
            placeholder="运营账号"
        /></el-form-item>
        <el-form-item label="密码" prop="password"
          ><el-input
            v-model="loginForm.password"
            :prefix-icon="Lock"
            type="password"
            show-password
            autocomplete="current-password"
            placeholder="账号密码"
            @keyup.enter="handleLogin"
        /></el-form-item>
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          native-type="submit"
          style="width: 100%"
          >登录工作空间</el-button
        >
      </el-form>
      <p class="login-note">
        开发测试账号由部署环境提供；权限和地区范围由服务端验证。
      </p>
    </section>
  </main>
</template>
<style scoped>
.login-page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(ellipse at 14% 20%, #c7b99330, transparent 60%), #f5f4ed;
}
.login-card {
  width: min(440px, 100%);
  padding: 38px;
  background: #fff;
  border: 1px solid #e5e5db;
  border-radius: 16px;
  box-shadow: 0 24px 60px #333d3210;
}
.login-card h1 {
  font-family: JiafengSerif, serif;
  font-size: 28px;
  margin: 12px 0;
}
.login-eyebrow {
  color: #a64239;
  margin: 22px 0 4px;
  font-size: 12px;
  letter-spacing: 2px;
}
.login-card .el-form {
  margin-top: 28px;
}
.login-note {
  font-size: 11px;
  color: #919686;
  line-height: 1.8;
  margin: 22px 0 0;
}
.login-card .el-alert {
  margin-top: 20px;
}
.muted {
  color: #848c7a;
  font-size: 13px;
}
</style>
