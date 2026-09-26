<script setup lang="ts">
import { isHttpMode } from '../config/dataMode'
import RemoteAccountPanel from './RemoteAccountPanel.vue'
import { computed, reactive, ref } from 'vue'
import { t } from '../composables/useLocale'
import { accountState, accountUnavailable, changeAccount } from '../composables/useAccountDemo'
import { readInputValue } from '../composables/readInputValue'
import type { VerificationForm } from '../domain/accountDemo'
const visible = ref(false)
const loginConsent = ref(false)
const error = ref('')
const editing = ref(false)
const formKey = ref(0)
const form = reactive<VerificationForm>({
  displayName: '',
  affiliation: '',
  category: 'individual',
  consent: false,
})
const status = computed(() => accountState.value.verification.status)
const statusLabel = computed(
  () =>
    ({
      unverified: t('未认证', 'Unverified'),
      pending: t('审核中', 'Review pending'),
      approved: t('认证通过（演示）', 'Verified · Demo'),
      rejected: t('认证未通过', 'Review declined'),
    })[status.value],
)
const statusNote = computed(
  () =>
    ({
      unverified: t(
        '填写虚构资料，体验认证流程。',
        'Use fictional details to explore identity verification.',
      ),
      pending: t(
        '资料已保存在本机。下方可以选择模拟审核结果。',
        'Details are saved locally. Choose a simulated review outcome below.',
      ),
      approved: t(
        '此结果仅用于界面演示，不构成真实实名认证。',
        'This is an interface demonstration, not real identity verification.',
      ),
      rejected: t(
        '示例原因：演示单位描述不完整。可修改资料后重新提交。',
        'Sample reason: the fictional organisation needs more detail. Edit and resubmit.',
      ),
    })[status.value],
)
function open() {
  error.value = ''
  editing.value = false
  visible.value = true
  Object.assign(
    form,
    accountState.value.verification.form ?? {
      displayName: '',
      affiliation: '',
      category: 'individual',
      consent: false,
    },
  )
  formKey.value++
}
function signIn() {
  error.value = changeAccount((account) => account.signIn(loginConsent.value))
  if (!error.value) loginConsent.value = false
}
function signOut() {
  error.value = changeAccount((account) => account.signOut())
  if (!error.value) editing.value = false
}
function fillExample() {
  Object.assign(form, {
    displayName: t('同行者小禾', 'Demo companion'),
    affiliation: t('示例社区读书小组', 'Fictional community reading group'),
    category: 'individual',
    consent: false,
  })
  formKey.value++
}
function submit() {
  error.value = changeAccount((account) => account.submit({ ...form }))
  if (!error.value) editing.value = false
}
function review(outcome: 'approved' | 'rejected') {
  error.value = changeAccount((account) => account.review(outcome))
}
function reset() {
  error.value = changeAccount((account) => account.resetVerification())
  if (!error.value) {
    Object.assign(form, {
      displayName: '',
      affiliation: '',
      category: 'individual',
      consent: false,
    })
    formKey.value++
    editing.value = false
  }
}
function edit() {
  editing.value = true
  form.consent = false
  error.value = ''
}
</script>
<template>
  <RemoteAccountPanel v-if="isHttpMode" />
  <view v-else class="account-entry">
    <view class="account-entry-copy">
      <text class="account-entry-title">{{ t('账户与身份认证', 'Account and identity') }}</text>
      <text class="account-entry-note">
        {{
          accountState.signedIn
            ? t('演示账户已启用', 'Demo account enabled') + ' · ' + statusLabel
            : t(
                '访客浏览 · 可体验登录与认证',
                'Browsing as a guest · explore sign-in and verification',
              )
        }}
      </text>
    </view>
    <wd-button variant="plain" size="small" @click="open">
      {{
        accountState.signedIn
          ? t('查看认证', 'View identity')
          : t('登录 / 认证', 'Sign in / verify')
      }}
    </wd-button>
    <wd-popup
      v-model="visible"
      position="center"
      closable
      :z-index="100"
      custom-class="content-popup"
    >
      <view class="account-dialog">
        <text class="section-title">{{ t('账户与身份认证', 'Account and identity') }}</text>
        <text class="scope-note">
          {{
            t(
              '仅在本机模拟，不调用微信授权，也不上传资料。请勿填写真实证件、电话或住址。',
              'Local simulation only, with no WeChat authorisation or upload. Do not enter real IDs, phone numbers or addresses.',
            )
          }}
        </text>
        <text v-if="accountUnavailable" class="account-error">
          {{
            t(
              '账户记录无法读取，原数据未覆盖。',
              'The account record could not be read. Existing data was preserved.',
            )
          }}
        </text>
        <template v-else-if="!accountState.signedIn">
          <text class="account-paragraph">
            {{
              t(
                '启用后可体验认证状态；投稿、学习与收藏仍属于当前设备的演示记录。',
                'Enable a sample account to explore verification states. Submissions, learning and favourites remain local demo records.',
              )
            }}
          </text>
          <wd-checkbox v-model="loginConsent" shape="square">
            {{
              t(
                '我已了解本机演示说明，使用虚构资料体验',
                'I understand the local demo and will use fictional details',
              )
            }}
          </wd-checkbox>
          <wd-button @click="signIn">
            {{ t('同意并启用演示账户', 'Agree and enable demo account') }}
          </wd-button>
        </template>
        <template v-else>
          <view class="account-status">
            <text class="tag">{{ statusLabel }}</text>
            <text class="account-paragraph">{{ statusNote }}</text>
          </view>
          <template v-if="status === 'unverified' || editing">
            <button class="text-button account-example" @click="fillExample">
              {{ t('填入虚构样例', 'Fill fictional example') }}
            </button>
            <view class="account-field">
              <text>{{ t('演示称呼', 'Fictional display name') }}</text>
              <input
                :key="'name-' + formKey"
                v-model="form.displayName"
                class="form-input"
                :maxlength="30"
                :placeholder="t('如：同行者小禾', 'e.g. Demo companion')"
                @blur="form.displayName = readInputValue($event, form.displayName)"
                @confirm="form.displayName = readInputValue($event, form.displayName)"
              />
            </view>
            <view class="account-field">
              <text>{{ t('演示单位 / 团体', 'Fictional organisation / group') }}</text>
              <input
                :key="'org-' + formKey"
                v-model="form.affiliation"
                class="form-input"
                :maxlength="60"
                :placeholder="t('如：示例社区读书小组', 'e.g. Fictional reading group')"
                @blur="form.affiliation = readInputValue($event, form.affiliation)"
                @confirm="form.affiliation = readInputValue($event, form.affiliation)"
              />
            </view>
            <view class="account-field">
              <text>{{ t('身份类别', 'Identity category') }}</text>
              <view class="account-categories">
                <button
                  v-for="item in [
                    { id: 'individual' as const, zh: '个人', en: 'Individual' },
                    { id: 'student' as const, zh: '校园', en: 'Student' },
                    { id: 'overseas' as const, zh: '海外', en: 'Overseas' },
                  ]"
                  :key="item.id"
                  :class="['account-category', { active: form.category === item.id }]"
                  @click="form.category = item.id"
                >
                  {{ t(item.zh, item.en) }}
                </button>
              </view>
            </view>
            <wd-checkbox v-model="form.consent" shape="square">
              {{
                t(
                  '资料为虚构样例，同意保存在当前设备用于演示',
                  'These fictional details may be stored on this device for demonstration',
                )
              }}
            </wd-checkbox>
            <wd-button @click="submit">
              {{ t('提交演示认证', 'Submit sample verification') }}
            </wd-button>
          </template>
          <template v-else>
            <view class="account-detail">
              <text class="account-detail-line">
                {{ accountState.verification.form?.displayName }}
              </text>
              <text class="account-detail-line">
                {{ accountState.verification.form?.affiliation }}
              </text>
              <text class="muted account-detail-line">
                {{ t('提交日期：', 'Submitted: ')
                }}{{ accountState.verification.submittedAt?.slice(0, 10) }}
              </text>
            </view>
            <view v-if="status === 'pending'" class="account-review-tools">
              <text class="account-paragraph">
                {{
                  t(
                    '演示控制：选择一种结果查看后续界面，不会进行真实审核。',
                    'Demo controls: choose an outcome to preview the next screen. No real review occurs.',
                  )
                }}
              </text>
              <view class="account-actions">
                <wd-button @click="review('approved')">
                  {{ t('模拟审核通过', 'Simulate approval') }}
                </wd-button>
                <wd-button variant="plain" @click="review('rejected')">
                  {{ t('模拟审核不通过', 'Simulate rejection') }}
                </wd-button>
              </view>
            </view>
            <wd-button
              v-if="status === 'rejected' || status === 'approved'"
              variant="plain"
              @click="edit"
            >
              {{ t('修改资料并重试', 'Edit details and retry') }}
            </wd-button>
            <button class="text-button" @click="reset">
              {{ t('重新体验未认证状态', 'Restart verification demo') }}
            </button>
          </template>
          <view class="account-signout">
            <button class="text-button" @click="signOut">
              {{ t('退出演示账户', 'Sign out of demo account') }}
            </button>
            <text class="muted">
              {{
                t(
                  '退出后保留本机记录与认证样例，不会删除投稿或收藏。',
                  'Signing out retains local records and sample verification, including submissions and favourites.',
                )
              }}
            </text>
          </view>
        </template>
        <text v-if="error" class="account-error">{{ error }}</text>
        <wd-button variant="plain" @click="visible = false">
          {{ t('返回个人中心', 'Back to my account') }}
        </wd-button>
      </view>
    </wd-popup>
  </view>
</template>
<style scoped>
.account-entry {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  background: #fffaf1;
  border: 1px solid #c9a96e;
  padding: 20px 24px;
  margin: 20px 0;
}
.account-entry-copy {
  min-width: 0;
  flex: 1;
}
.account-entry-title {
  display: block;
  color: #2c2c2c;
  font-weight: 600;
  font-size: 17px;
}
.account-entry-note {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: #555;
  line-height: 1.7;
}
.account-dialog {
  padding: 30px 24px;
  display: block;
  color: #2c2c2c;
  max-height: 78vh;
  overflow-y: auto;
  box-sizing: border-box;
}
.account-paragraph {
  display: block;
  font-size: 14px;
  line-height: 1.8;
}
.account-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.account-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
}
.account-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.account-category {
  font-size: 13px;
  padding: 8px 16px;
  border: 1px solid #c9a96e;
  line-height: 1.5;
  margin: 0;
  background: #fffaf1;
}
.account-category.active {
  border-color: #c41a1a;
  background: #f7e8e8;
  color: #c41a1a;
}
.account-detail,
.account-review-tools,
.account-signout {
  display: flex;
  flex-direction: column;
  gap: 10px;
  line-height: 1.7;
}
.account-review-tools {
  padding: 16px;
  background: #f5f0e8;
}
.account-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.account-signout {
  border-top: 1px solid #c9a96e;
  padding-top: 18px;
}
.account-error {
  color: #c41a1a;
  font-size: 14px;
  line-height: 1.7;
}
.account-example {
  align-self: flex-start;
}
@media (max-width: 480px) {
  .account-entry {
    padding: 18px;
    flex-wrap: wrap;
  }
  .account-entry-copy {
    flex-basis: 100%;
  }
  .account-dialog {
    padding: 30px 18px;
  }
}

.account-dialog .scope-note,
.account-dialog .account-status,
.account-dialog .account-field,
.account-dialog .account-detail,
.account-dialog .account-review-tools,
.account-dialog .account-signout,
.account-dialog .account-error {
  display: block;
  margin: 16px 0;
}
.account-dialog :deep(.wd-checkbox),
.account-dialog :deep(.wd-button) {
  margin-top: 14px;
  flex-shrink: 0;
}
.account-dialog .account-field .form-input,
.account-dialog .account-field .account-categories {
  margin-top: 9px;
}
.account-dialog .account-detail .account-detail-line {
  display: block;
  margin-top: 5px;
}
.account-dialog .account-error {
  line-height: 1.7;
}
</style>
