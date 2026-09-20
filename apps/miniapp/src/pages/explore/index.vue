<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import { screens, type Screen } from '../../composables/useNavigation'
const screen = ref<Screen>('home')
const params = ref<Record<string, string>>({})
onLoad((options) => {
  const { screen: requested, ...rest } = options ?? {}
  screen.value = screens.includes(requested as Screen) ? (requested as Screen) : 'home'
  params.value = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, String(v ?? '')]))
})
</script>
<template><AppShell :screen="screen" :params="params" /></template>
