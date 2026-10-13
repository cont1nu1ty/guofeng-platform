<script setup lang="ts">
import { citationTarget, type AiCitation } from '../domain/aiTasks'
import { navigate } from '../composables/useNavigation'
import { t } from '../composables/useLocale'
defineProps<{ items: AiCitation[] }>()
function openSource(item: AiCitation) {
  const target = citationTarget(item.url)
  if (target) navigate(target.screen, { id: target.id })
}
</script>
<template>
  <view class="ai-citations">
    <text class="ai-citation-heading">
      {{ t('参考来源（请对照原文）', 'Sources — check the original text') }}
    </text>
    <view v-for="(item, index) in items" :key="item.id" class="ai-citation">
      <text class="ai-citation-heading">[{{ index + 1 }}] {{ item.title }}</text>
      <text selectable>{{ item.excerpt }}</text>
      <button
        v-if="citationTarget(item.url)"
        class="text-button ai-source-link"
        @click="openSource(item)"
      >
        {{ t('查看原文', 'Read source') }} →
      </button>
    </view>
  </view>
</template>
<style scoped>
.ai-citations {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--jf-border);
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.ai-citation {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 12px;
}
.ai-citation-heading {
  display: block;
  color: var(--jf-muted);
  font-weight: 600;
}
.ai-source-link {
  text-align: left;
  padding: 0;
  margin: 0;
  font-size: 12px;
}
</style>
