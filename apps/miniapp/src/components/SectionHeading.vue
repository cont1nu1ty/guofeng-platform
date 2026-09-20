<script setup lang="ts">
defineProps<{ title: string; eyebrow?: string; subtitle?: string }>()
</script>
<template>
  <view class="section-heading">
    <view>
      <text v-if="eyebrow" class="eyebrow">{{ eyebrow }}</text>
      <text class="section-title">{{ title }}</text>
      <text v-if="subtitle" class="section-subtitle">{{ subtitle }}</text>
    </view>
    <slot />
  </view>
</template>
