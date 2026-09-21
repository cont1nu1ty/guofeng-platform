<script setup lang="ts">
import { ref } from 'vue'
import { t } from '../../composables/useLocale'
defineProps<{ destination: string }>()
const opened = ref(false)
const origin = ref<'none' | 'sample' | 'denied'>('none')
const transport = ref('walk')
const modes = [
  { id: 'walk', zh: '步行', en: 'Walk', time: '12' },
  { id: 'transit', zh: '公交', en: 'Transit', time: '18' },
  { id: 'drive', zh: '驾车', en: 'Drive', time: '6' },
]
</script>
<template>
  <view class="journey-wrap">
    <wd-button variant="plain" @click="opened = !opened">
      {{
        opened
          ? t('收起到场路线', 'Hide arrival route')
          : t('预览到场路线', 'Preview arrival route')
      }}
    </wd-button>
    <view v-if="opened" class="journey-panel">
      <text class="section-title">{{ t('到场路线示意', 'Illustrative arrival route') }}</text>
      <text class="scope-note">
        {{
          t(
            '使用虚构起终点演示导航选择，不读取你的位置，也不提供真实出行路线。',
            'This uses fictional places to preview navigation choices. It does not access your location or provide real directions.',
          )
        }}
      </text>
      <view class="journey-modes">
        <button
          v-for="mode in modes"
          :key="mode.id"
          :class="['choice-card', { active: transport === mode.id }]"
          @click="transport = mode.id"
        >
          {{ t(mode.zh, mode.en) }}
        </button>
      </view>
      <view v-if="origin !== 'sample'" class="journey-start">
        <text>
          {{
            origin === 'denied'
              ? t(
                  '定位未授权，仍可使用样例起点查看路线布局。',
                  'Location is not authorized. You can still use the sample origin.',
                )
              : t('尚未选择起点', 'Choose a starting point')
          }}
        </text>
        <view class="journey-actions">
          <wd-button size="small" @click="origin = 'sample'">
            {{ t('使用样例起点', 'Use sample origin') }}
          </wd-button>
          <wd-button size="small" variant="plain" @click="origin = 'denied'">
            {{ t('查看未授权状态', 'Preview denied permission') }}
          </wd-button>
        </view>
      </view>
      <view v-else>
        <view class="journey-map">
          <text class="journey-origin">● {{ t('样例文化广场', 'Sample Culture Square') }}</text>
          <view class="journey-path" />
          <text class="journey-destination">◆ {{ destination }}</text>
        </view>
        <text class="journey-time">
          {{ t('示例用时', 'Example time') }} {{ modes.find((m) => m.id === transport)?.time }}
          {{ t('分钟 · 仅展示', 'minutes · illustration only') }}
        </text>
        <text class="journey-step">
          1. {{ t('从样例文化广场出发', 'Start at the sample square') }}
        </text>
        <text class="journey-step">
          2. {{ t('沿示意文化街前往场馆入口', 'Follow the illustrative street to the entrance') }}
        </text>
        <text class="journey-step">
          3.
          {{
            t('查看预约记录，按活动安排签到', 'Check your booking and the event check-in details')
          }}
        </text>
        <button class="text-button" @click="origin = 'none'">
          {{ t('重新选择起点', 'Choose another origin') }}
        </button>
      </view>
    </view>
  </view>
</template>
<style scoped>
.journey-wrap {
  margin-top: 20px;
}
.journey-panel {
  margin: 20px 0;
  padding: 24px;
  border: 1px solid var(--jf-border);
  background: var(--jf-surface);
}
.journey-modes,
.journey-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 18px 0;
}
.journey-modes .choice-card {
  padding: 8px 15px;
  font-size: 14px;
}
.journey-start,
.journey-step,
.journey-time {
  font-size: 14px;
  line-height: 1.9;
  display: block;
}
.journey-map {
  padding: 22px;
  border: 1px solid var(--jf-gold);
  background: var(--jf-paper);
  margin-bottom: 18px;
}
.journey-origin,
.journey-destination {
  display: block;
}
.journey-path {
  height: 55px;
  border-left: 3px dashed var(--jf-red);
  margin: 10px 7px;
}
.journey-time {
  color: var(--jf-red);
  font-weight: 600;
  margin-bottom: 10px;
}
.journey-step {
  margin-bottom: 12px;
}
@media (max-width: 600px) {
  .journey-panel {
    padding: 16px;
  }
}
</style>
