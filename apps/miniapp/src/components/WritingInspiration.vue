<script setup lang="ts">
import { computed, ref } from 'vue'
import { getAssistantTool } from '../domain/assistantExamples'
import { t } from '../composables/useLocale'
import { notify } from '../composables/useDemo'
const emit = defineEmits<{ close: []; append: [text: string] }>()
const samples = computed(() =>
  ['letter', 'rules', 'polish'].flatMap(
    (mode) => getAssistantTool(mode as 'letter' | 'rules' | 'polish').examples,
  ),
)
const selected = ref(samples.value[0]!.id)
const sample = computed(() => samples.value.find((item) => item.id === selected.value)!)
const confirming = ref(false)
const result = computed(() => t(sample.value.result.zh, sample.value.result.en))
function choose(id: string) {
  selected.value = id
  confirming.value = false
}
function copy() {
  uni.setClipboardData({
    data: result.value,
    showToast: false,
    success: () => notify(t('灵感示例已复制', 'Inspiration sample copied')),
    fail: () => notify(t('复制失败，可长按选择文字', 'Copy failed. Select text to copy manually.')),
  })
}
function append() {
  emit('append', result.value)
  confirming.value = false
}
</script>
<template>
  <view class="writing-inspiration">
    <view class="writing-inspiration-heading">
      <text>{{ t('灵感对话', 'Writing companion') }}</text>
      <button @click="emit('close')">{{ t('收起', 'Collapse') }} ×</button>
    </view>
    <text class="writing-inspiration-note">
      {{
        t(
          '从一个具体场景开始。下面是本地预设，选择后可阅读、复制或追加；不会替换你的原稿。',
          'Begin with a specific moment. These local presets can be read, copied or appended. Your existing draft stays intact.',
        )
      }}
    </text>
    <view class="writing-inspiration-choices">
      <button
        v-for="item in samples"
        :key="item.id"
        :class="{ active: selected === item.id }"
        @click="choose(item.id)"
      >
        {{ t(item.label.zh, item.label.en) }}
      </button>
    </view>
    <scroll-view scroll-y class="writing-inspiration-result">
      <text selectable>{{ result }}</text>
    </scroll-view>
    <view class="writing-inspiration-actions">
      <wd-button variant="plain" size="small" @click="copy">{{ t('复制', 'Copy') }}</wd-button>
      <wd-button size="small" @click="confirming = true">
        {{ t('追加到正文', 'Append to draft') }}
      </wd-button>
    </view>
    <view v-if="confirming" class="writing-inspiration-confirm">
      <text>
        {{
          t(
            '将把当前完整示例追加到正文末尾。请继续改写为自己的故事。',
            'Append this entire preset at the end of your draft. Adapt it into your own story.',
          )
        }}
      </text>
      <wd-button size="small" @click="append">
        {{ t('确认追加，保留原稿', 'Confirm append, keep original') }}
      </wd-button>
      <button @click="confirming = false">{{ t('取消', 'Cancel') }}</button>
    </view>
  </view>
</template>
<style scoped>
.writing-inspiration {
  min-width: 0;
  border: 1px solid #c9a96e;
  background: #f5f0e8;
  padding: 14px;
  border-radius: 8px;
}
.writing-inspiration-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}
.writing-inspiration-heading button,
.writing-inspiration-confirm button {
  margin: 0;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.7;
  color: #c41a1a;
  background: transparent;
}
.writing-inspiration-note {
  display: block;
  margin: 10px 0;
  font-size: 12px;
  line-height: 1.8;
  color: #525252;
}
.writing-inspiration-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 12px;
}
.writing-inspiration-choices button {
  font-size: 12px;
  line-height: 1.6;
  padding: 5px 7px;
  margin: 0;
  background: #fffdfa;
  color: #2c2c2c;
}
.writing-inspiration-choices button.active {
  color: #c41a1a;
  border: 1px solid #c41a1a;
}
.writing-inspiration-result {
  height: 260px;
  background: #fffdfa;
  padding: 12px;
  box-sizing: border-box;
  font-size: 13px;
  line-height: 1.9;
  white-space: pre-wrap;
}
.writing-inspiration-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.writing-inspiration-confirm {
  border-top: 1px solid #c9a96e;
  margin-top: 12px;
  padding-top: 12px;
}
.writing-inspiration-confirm text {
  display: block;
  font-size: 12px;
  line-height: 1.7;
  margin-bottom: 10px;
}
</style>
