<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import ExploreContent from '../../components/ExploreContent.vue'
import { screens, contentScreens, screenUrl, type Screen } from '../../composables/useNavigation'
const screen = ref<Screen>('home')
const params = ref<Record<string, string>>({})
onLoad((options) => {
  const { screen: requested, ...rest } = options ?? {}
  screen.value = screens.includes(requested as Screen) ? (requested as Screen) : 'home'
  params.value = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, String(v ?? '')]))
  if (contentScreens.includes(screen.value))
    uni.redirectTo({ url: screenUrl(screen.value, params.value) })
})
</script>
<template>
  <AppShell :screen="screen" :params="params"><ExploreContent :screen="screen" /></AppShell>
</template>
