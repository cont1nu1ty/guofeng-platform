<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  Odometer,
  Document,
  Checked,
  UserFilled,
  Reading,
  Collection,
  Calendar,
  School,
  Present,
  User,
  MagicStick,
  DataAnalysis,
  Setting,
} from "@element-plus/icons-vue";
import { navGroups, workspace } from "../domain/workspace";
const route = useRoute();
const icons = {
  Odometer,
  Document,
  Checked,
  UserFilled,
  Reading,
  Collection,
  Calendar,
  School,
  Present,
  User,
  MagicStick,
  DataAnalysis,
  Setting,
};
const currentPath = computed(() => route.path);
</script>
<template>
  <nav class="sidebar-nav" aria-label="后台功能导航">
    <div v-for="group in navGroups" :key="group.label" class="nav-group">
      <div class="nav-group-label">{{ group.label }}</div>
      <router-link
        v-for="item in group.items"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: currentPath === item.path }"
        :aria-current="currentPath === item.path ? 'page' : undefined"
        @click="workspace.sidebarOpen = false"
      >
        <el-icon
          ><component :is="icons[item.icon as keyof typeof icons]"
        /></el-icon>
        <span>{{ item.title }}</span>
        <span v-if="item.path === '/submissions'" class="nav-marker" />
      </router-link>
    </div>
  </nav>
</template>
