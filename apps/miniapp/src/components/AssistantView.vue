<script setup lang="ts">
import { ref } from 'vue'
import SectionHeading from './SectionHeading.vue'
const prompt = ref('')
const answer = ref('')
const busy = ref(false)
const examples = [
  '帮我构思一封给孩子的家书',
  '家训可以从哪些日常小事写起？',
  '怎样投稿和查询评审进度？',
]
function ask(value?: string) {
  if (value) prompt.value = value
  if (!prompt.value.trim() || busy.value) return
  busy.value = true
  const input = prompt.value
  answer.value =
    input.includes('投稿') || input.includes('进度')
      ? '你可以从「家风投稿」选择通道与体裁，填写标题和正文，阅读演示须知后提交。系统会生成 DEMO- 开头的本机编号，可在「评审公示」中查询。\n\n当前是交互演示，不代表正式征集或实际审核结果。'
      : input.includes('家训')
        ? '可以从一个看得见的小习惯开始：按时归还借来的物品、吃饭时照顾长辈、答应的事情认真完成。\n\n写作线索：一件日常小事 → 家人的选择 → 自己的感受 → 愿意传下去的一句话。'
        : '不妨从一次共同经历写起，让家书保留你自己的声音。\n\n第一段：讲一件最近让你想起孩子的小事。\n第二段：分享家中代代相传的一个习惯，并举一个真实例子。\n第三段：留下温柔的祝愿，邀请孩子写下自己的想法。\n\n示例开头：「今天整理旧书，看到你小时候夹在书页里的叶子，忽然想把这些年的一些心里话写给你。」'
  busy.value = false
}
</script>
<template>
  <SectionHeading
    title="让灵感，落在笔尖"
    eyebrow="FAMILY CULTURE ASSISTANT"
    subtitle="从一点启发开始，写出属于自己的家风。"
  />
  <view class="assistant-panel">
    <view class="assistant-symbol">✦</view>
    <text class="section-title">你好，想从哪里开始？</text>
    <text class="muted">当前为预设回答演示，未连接任何 AI 模型</text>
    <view class="prompt-examples">
      <button v-for="item in examples" :key="item" @click="ask(item)">
        {{ item }}
        <text>↗</text>
      </button>
    </view>
    <view v-if="answer" class="answer-bubble">
      <text class="tag">预设示例 · 非 AI 实时生成</text>
      <text class="answer-text">{{ answer }}</text>
    </view>
    <view class="prompt-row">
      <textarea
        v-model="prompt"
        class="prompt-input"
        placeholder="写下你的问题或创作想法"
        :maxlength="500"
        aria-label="向家风助手提问"
      />
      <wd-button :disabled="!prompt.trim()" @click="ask()">查看示例 ↗</wd-button>
    </view>
  </view>
  <view class="scope-note">
    正式 AI 服务将独立部署；知识库、引用来源、生成留痕和内容审核需接入后验收。
  </view>
</template>
