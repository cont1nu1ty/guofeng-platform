<script setup lang="ts">
import { ref } from 'vue'
import ConversationPanel from './ConversationPanel.vue'
import { t } from '../composables/useLocale'
import type { AssistantMode } from '../domain/personalArchive'
import type { ConversationReply } from '../domain/localConversation'
defineProps<{ draftTitle?: string; draftText?: string }>()
const emit = defineEmits<{ close: []; append: [text: string] }>()
const mode = ref<AssistantMode>('letter')
const modes = [
  { id: 'letter' as const, zh: '家书', en: 'Letter' },
  { id: 'rules' as const, zh: '家训', en: 'Principles' },
  { id: 'polish' as const, zh: '润色', en: 'Polish' },
]
function append(reply: ConversationReply) {
  if (reply.content) emit('append', reply.content)
}
</script>
<template>
  <view class="writing-inspiration">
    <view class="writing-inspiration-heading">
      <text>{{ t('边写边聊', 'Write and talk') }}</text>
      <button @click="emit('close')">{{ t('收起', 'Collapse') }} ×</button>
    </view>
    <view class="writing-inspiration-modes">
      <button
        v-for="item in modes"
        :key="item.id"
        :class="{ active: mode === item.id }"
        @click="mode = item.id"
      >
        {{ t(item.zh, item.en) }}
      </button>
    </view>
    <ConversationPanel
      :mode="mode"
      compact
      append
      :draft-title="draftTitle"
      :draft-text="draftText"
      @use="append"
    />
  </view>
</template>
<style scoped>
.writing-inspiration {
  min-width: 0;
}
.writing-inspiration-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  font-size: 15px;
  font-weight: 600;
}
.writing-inspiration-heading button {
  margin: 0;
  padding: 3px 7px;
  color: #c41a1a;
  background: transparent;
  line-height: 1.8;
  font-size: 12px;
}
.writing-inspiration-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 10px;
}
.writing-inspiration-modes button {
  margin: 0;
  padding: 4px 10px;
  line-height: 1.8;
  font-size: 12px;
  border: 1px solid #c9a96e;
  background: #f5f0e8;
  color: #2c2c2c;
}
.writing-inspiration-modes button.active {
  background: #c41a1a;
  color: #fff;
  border-color: #c41a1a;
}
</style>
