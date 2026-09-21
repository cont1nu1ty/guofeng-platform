<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import { contentScreens, type Screen } from '../../composables/useNavigation'
import NewsView from '../components/NewsView.vue'
import ClassroomView from '../components/ClassroomView.vue'
import VenuesView from '../components/VenuesView.vue'
import MediaView from '../components/MediaView.vue'
import HallView from '../components/HallView.vue'
import ShopView from '../components/ShopView.vue'
import LearningView from '../components/LearningView.vue'
const screen = ref<Screen>('news')
const params = ref<Record<string, string>>({})
onLoad((options) => {
  const { screen: requested, ...rest } = options ?? {}
  screen.value = contentScreens.includes(requested as Screen) ? (requested as Screen) : 'news'
  params.value = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, String(v ?? '')]))
})
</script>
<template>
  <AppShell :screen="screen" :params="params">
    <NewsView v-if="screen === 'news'" />
    <ClassroomView v-else-if="screen === 'classroom'" />
    <VenuesView v-else-if="screen === 'venues'" />
    <MediaView v-else-if="screen === 'media'" />
    <HallView v-else-if="screen === 'hall'" />
    <ShopView v-else-if="screen === 'shop'" />
    <LearningView v-else-if="screen === 'learning'" />
  </AppShell>
</template>
