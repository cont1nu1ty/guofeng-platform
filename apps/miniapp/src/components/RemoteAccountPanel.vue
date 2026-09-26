<script setup lang="ts">
import { ref } from 'vue'
import { remoteUser, signInRemote, signOutRemote } from '../services/api'
const visible = ref(false)
const username = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
async function login() {
  if (busy.value) return
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = '请填写账号与密码。'
    return
  }
  busy.value = true
  try {
    await signInRemote(username.value.trim(), password.value)
    password.value = ''
    visible.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败，请重试。'
  } finally {
    busy.value = false
  }
}
async function logout() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await signOutRemote()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '退出失败，请重试。'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <view class="remote-account">
    <view>
      <text class="section-title">{{ remoteUser ? remoteUser.name : '账户登录' }}</text>
      <text class="muted account-description">
        {{
          remoteUser
            ? '已连接账户，投稿与个人记录由服务端保存。'
            : '登录后跨设备查看自己的投稿、预约和消息。'
        }}
      </text>
    </view>
    <wd-button v-if="!remoteUser" @click="visible = true">登录账户</wd-button>
    <wd-button v-else variant="plain" :loading="busy" @click="logout">退出登录</wd-button>
    <text v-if="error && !visible" class="error-message">{{ error }}</text>
    <wd-popup v-model="visible" position="center" closable custom-class="content-popup">
      <view class="account-form">
        <text class="section-title">登录家风中华行</text>
        <text class="muted">使用管理员提供的试点账户。登录不等于实名认证。</text>
        <view>
          <text>账号</text>
          <input v-model="username" class="form-input" placeholder="请输入账号" :disabled="busy" />
        </view>
        <view>
          <text>密码</text>
          <input
            v-model="password"
            class="form-input"
            password
            placeholder="请输入密码"
            :disabled="busy"
            @confirm="login"
          />
        </view>
        <text v-if="error" class="error-message">{{ error }}</text>
        <wd-button :loading="busy" @click="login">登录</wd-button>
      </view>
    </wd-popup>
  </view>
</template>
<style scoped>
.remote-account {
  padding: 24rpx;
  display: flex;
  gap: 24rpx;
  align-items: center;
  flex-wrap: wrap;
  border: 1px solid #ded8cd;
  border-radius: 12rpx;
  margin-bottom: 24rpx;
}
.remote-account > view:first-child {
  flex: 1;
  min-width: 200px;
}
.account-description {
  display: block;
  margin-top: 12rpx;
}
.account-form {
  padding: 56rpx 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  width: min(520px, 78vw);
  box-sizing: border-box;
}
.account-form .form-input {
  margin-top: 12rpx;
}
.error-message {
  color: #a32e27;
  display: block;
}
</style>
