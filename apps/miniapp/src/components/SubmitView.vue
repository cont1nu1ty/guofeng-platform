<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import SectionHeading from './SectionHeading.vue'
import { genres, channels, regions } from '../domain/fixtures'
import type { SubmissionDraft, ValidationErrors } from '../domain/types'
import { repo, region, safely, navigate, notify } from '../composables/useDemo'
const blank = (): SubmissionDraft => ({
  title: '',
  content: '',
  genre: 'letter',
  channel: 'community',
  region: region.value === 'all' ? 'beijing' : region.value,
  author: '',
  copyrightAccepted: false,
})
const form = reactive<SubmissionDraft>(repo.getDraft() ?? blank())
const errors = ref<ValidationErrors>({})
const draftMessage = ref(repo.getDraft() ? '已恢复本机草稿' : '填写后自动保存到本机')
const submittedId = ref('')
const showAgreement = ref(false)
let pauseSave = false
watch(
  form,
  () => {
    if (pauseSave) return
    try {
      repo.saveDraft({ ...form })
      draftMessage.value = '已自动保存到本机'
    } catch {
      draftMessage.value = '保存失败，请检查设备存储空间'
    }
  },
  { deep: true, flush: 'sync' },
)
function submit() {
  errors.value = repo.validateSubmission({ ...form })
  if (Object.keys(errors.value).length) {
    notify('请完善标红的必填信息')
    return
  }
  const result = safely(() => repo.submitWork({ ...form }))
  if (result) {
    pauseSave = true
    submittedId.value = result.id
    Object.assign(form, blank())
    pauseSave = false
    draftMessage.value = '新投稿可重新填写'
  }
}
</script>
<template>
  <SectionHeading
    title="把家的故事，写给时代"
    eyebrow="CONTRIBUTE YOUR STORY"
    subtitle="每一种平凡的坚守，都值得被记住。"
  />
  <view v-if="submittedId" class="success-panel">
    <view class="success-mark">✓</view>
    <text class="section-title">作品已提交到本机演示库</text>
    <text class="muted">作品编号：{{ submittedId }}</text>
    <text>当前状态：待区县初审。此操作不向真实平台投稿。</text>
    <view class="button-row">
      <wd-button @click="navigate('profile')">查看我的投稿</wd-button>
      <wd-button plain @click="submittedId = ''">继续创作</wd-button>
    </view>
  </view>
  <view v-else class="form-layout">
    <view class="form-card">
      <view class="form-step">
        <text class="step-badge">01</text>
        <text>选择投稿方向</text>
      </view>
      <text class="field-label">投稿通道</text>
      <view class="channel-grid">
        <button
          v-for="item in channels"
          :key="item.id"
          :class="['choice-card', { active: form.channel === item.id }]"
          @click="form.channel = item.id"
        >
          {{ item.label }}
        </button>
      </view>
      <text class="field-label">作品体裁</text>
      <view class="choice-grid">
        <button
          v-for="item in genres"
          :key="item.id"
          :class="['choice-chip', { active: form.genre === item.id }]"
          @click="form.genre = item.id"
        >
          {{ item.label }}
        </button>
      </view>
      <view class="two-fields">
        <view>
          <text class="field-label">所属地区</text>
          <picker
            :range="regions.slice(1)"
            range-key="label"
            @change="form.region = regions[Number($event.detail.value) + 1]!.id"
          >
            <view class="form-input picker-value">
              {{ regions.find((r) => r.id === form.region)?.label }}
              <text>⌄</text>
            </view>
          </picker>
          <text class="field-error">{{ errors.region }}</text>
        </view>
        <view>
          <text class="field-label">作者署名（可选）</text>
          <input
            v-model="form.author"
            class="form-input"
            placeholder="仅填写演示署名"
            maxlength="20"
          />
        </view>
      </view>
      <view class="form-step">
        <text class="step-badge">02</text>
        <text>写下你的家风故事</text>
      </view>
      <text class="field-label">
        作品标题
        <text class="required">*</text>
      </text>
      <input
        v-model="form.title"
        :class="['form-input', { invalid: errors.title }]"
        placeholder="为故事起一个名字（2–50字）"
        maxlength="50"
        aria-label="作品标题"
      />
      <text v-if="errors.title" class="field-error">{{ errors.title }}</text>
      <view class="field-label-row">
        <text class="field-label">
          作品正文
          <text class="required">*</text>
        </text>
        <button class="text-button" @click="navigate('assistant')">✦ 寻找创作灵感</button>
      </view>
      <textarea
        v-model="form.content"
        :class="['writing-area', { invalid: errors.content }]"
        placeholder="从一段回忆、一句家训或一封家书开始……（至少20字）"
        :maxlength="10000"
        aria-label="作品正文"
      />
      <view class="editor-meta">
        <text>{{ draftMessage }}</text>
        <text>{{ form.content.length }} / 10000</text>
      </view>
      <text v-if="errors.content" class="field-error">{{ errors.content }}</text>
      <view class="scope-note">
        当前支持文字草稿；Word / PDF / 手稿上传将在接入文件服务后开放。
      </view>
      <view class="agreement">
        <wd-checkbox v-model="form.copyrightAccepted" checked-color="#C41A1A">
          我已阅读并同意
        </wd-checkbox>
        <button class="text-button" @click="showAgreement = true">《演示投稿须知》</button>
      </view>
      <text v-if="errors.copyrightAccepted" class="field-error">
        {{ errors.copyrightAccepted }}
      </text>
      <view class="submit-footer">
        <text class="muted">仅在本机保存，请勿输入个人敏感信息</text>
        <wd-button @click="submit">提交演示作品 →</wd-button>
      </view>
    </view>
    <view class="form-aside">
      <text class="eyebrow">落笔之前</text>
      <text class="aside-title">
        家风，藏在
        <br />
        生活的细节里。
      </text>
      <text class="aside-copy">
        一顿团圆饭的规矩，
        <br />
        一次长辈的叮嘱，
        <br />
        一个代代相传的习惯。
        <br />
        <br />
        真实的故事，自有力量。
      </text>
      <view class="fine-line" />
      <text class="field-label">投稿小贴士</text>
      <text class="aside-copy">
        01　围绕真实经历展开
        <br />
        02　保留自己的语言与情感
        <br />
        03　尊重他人隐私和版权
        <br />
        04　提交前仔细检查
      </text>
      <button class="text-button" @click="navigate('review')">了解评审流程 →</button>
    </view>
  </view>
  <wd-popup v-model="showAgreement" position="center" closable custom-class="content-popup">
    <view class="dialog-body">
      <text class="section-title">演示投稿须知</text>
      <text class="reader-paragraph">
        本原型仅用于需求沟通，提交后只保存在当前设备。请使用有权使用的演示文本，不填写真实隐私资料。
      </text>
      <text class="reader-paragraph">
        勾选用于演示版权确认交互，不构成电子签章、版权转让或正式版权协议。正式征集规则、版权授权范围及隐私条款需业务方另行确认。
      </text>
      <wd-button block @click="showAgreement = false">我已了解</wd-button>
    </view>
  </wd-popup>
</template>
