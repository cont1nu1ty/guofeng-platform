<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../composables/useLocale'
import { newsArticles, newsCategories } from '../../domain/contentCatalog'
import {
  newsPreferences,
  newsPreferenceError,
  toggleNewsCategory,
  updateNewsPreferences,
} from '../composables/useNewsPreferences'
import { navigate } from '../../composables/useNavigation'
const selectedArticles = computed(() =>
  newsArticles.filter((a) => newsPreferences.value.categories.includes(a.category)),
)
const cadences = [
  { id: 'instant' as const, zh: '更新时', en: 'On updates' },
  { id: 'daily' as const, zh: '每日汇总', en: 'Daily digest' },
  { id: 'weekly' as const, zh: '每周汇总', en: 'Weekly digest' },
]
</script>
<template>
  <view class="subscription-panel">
    <text class="section-title">{{ t('我的订阅', 'My subscriptions') }}</text>
    <text class="section-subtitle">
      {{ t('选择关心的资讯，让阅读更有方向。', 'Choose the updates that matter to you.') }}
    </text>
    <view v-if="newsPreferenceError" class="scope-note">
      {{
        t(
          '原有订阅设置无法读取，暂不覆盖；请检查本机存储。',
          'Existing preferences could not be read. They will not be overwritten.',
        )
      }}
    </view>
    <view class="subscription-categories">
      <button
        v-for="item in newsCategories.filter((c) => c.id !== 'all')"
        :key="item.id"
        :class="['choice-card', { active: newsPreferences.categories.includes(item.id) }]"
        :disabled="newsPreferenceError"
        @click="toggleNewsCategory(item.id)"
      >
        <text>{{ t(item.label.zh, item.label.en) }}</text>
        <text>
          {{
            newsPreferences.categories.includes(item.id)
              ? t('已订阅 ✓', 'Subscribed ✓')
              : t('订阅 +', 'Subscribe +')
          }}
        </text>
      </button>
    </view>
    <view class="subscription-settings">
      <view class="subscription-row">
        <text>{{ t('接收订阅资讯提醒', 'Receive updates for subscriptions') }}</text>
        <wd-switch
          :model-value="newsPreferences.updates"
          :disabled="newsPreferenceError"
          @update:model-value="updateNewsPreferences({ updates: $event })"
          active-color="#C41A1A"
        />
      </view>
      <view class="subscription-row">
        <text>{{ t('夜间免打扰（22:00–08:00）', 'Quiet hours (22:00–08:00)') }}</text>
        <wd-switch
          :model-value="newsPreferences.quietHours"
          :disabled="newsPreferenceError"
          @update:model-value="updateNewsPreferences({ quietHours: $event })"
          active-color="#C41A1A"
        />
      </view>
      <text>{{ t('提醒频率', 'Update frequency') }}</text>
      <view class="subscription-cadence">
        <button
          v-for="item in cadences"
          :key="item.id"
          :class="['choice-card', { active: newsPreferences.digest === item.id }]"
          :disabled="newsPreferenceError || !newsPreferences.updates"
          @click="updateNewsPreferences({ digest: item.id })"
        >
          {{ t(item.zh, item.en) }}
        </button>
      </view>
      <text class="scope-note">
        {{
          t(
            '设置仅保存在本机，用于演示通知偏好；不会发送微信消息或系统通知。',
            'Preferences are saved on this device for the demo. No WeChat or system notifications are sent.',
          )
        }}
      </text>
    </view>
    <view class="subscription-results">
      <text class="section-title">{{ t('订阅内容预览', 'Preview your reading feed') }}</text>
      <view v-if="!selectedArticles.length" class="empty-state">
        {{ t('还没有订阅，选择上方分类开始。', 'Choose a category above to get started.') }}
      </view>
      <button
        v-for="item in selectedArticles"
        :key="item.id"
        class="subscription-story"
        @click="navigate('news', { id: item.id })"
      >
        <text>{{ t(item.title.zh, item.title.en) }}</text>
        <text>↗</text>
      </button>
    </view>
  </view>
</template>
<style scoped>
.subscription-panel {
  margin: 24px 0;
}
.subscription-categories {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
}
.subscription-categories .choice-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px;
  font-size: 14px;
  min-width: 0;
}
.subscription-settings {
  padding: 20px;
  border: 1px solid var(--jf-border);
  background: var(--jf-surface);
  font-size: 14px;
}
.subscription-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
}
.subscription-cadence {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 12px 0;
}
.subscription-cadence .choice-card {
  padding: 8px 12px;
  font-size: 13px;
}
.subscription-results {
  margin-top: 28px;
}
.subscription-story {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  background: var(--jf-surface);
  border: 1px solid var(--jf-border);
  margin: 12px 0;
  width: 100%;
  text-align: left;
  line-height: 1.8;
  font-size: 15px;
  color: var(--jf-ink);
}
@media (max-width: 600px) {
  .subscription-categories {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
