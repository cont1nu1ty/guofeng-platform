<script setup lang="ts">
import type { Screen } from '../composables/useNavigation'
import HomeView from './HomeView.vue'
import SubmitView from './SubmitView.vue'
import LibraryView from './LibraryView.vue'
import ReviewView from './ReviewView.vue'
import ProfileView from './ProfileView.vue'
import AssistantView from './AssistantView.vue'
import AdminView from './AdminView.vue'
import SearchView from './SearchView.vue'
defineProps<{ screen: Screen }>()
</script>
<template>
  <HomeView v-if="screen === 'home'" />
  <SubmitView v-else-if="screen === 'submit'" />
  <LibraryView v-else-if="screen === 'library'" />
  <ReviewView v-else-if="screen === 'review'" />
  <ProfileView v-else-if="screen === 'profile'" />
  <AssistantView v-else-if="screen === 'assistant'" />
  <AdminView v-else-if="screen === 'admin'" />
  <SearchView v-else-if="screen === 'search'" />
</template>
