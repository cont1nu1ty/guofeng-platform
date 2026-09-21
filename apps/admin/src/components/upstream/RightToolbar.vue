<!-- Adapted from plus-ui RightToolbar at 259325b4eecd715279b66b70f90eb9a2f741133c. MIT; see licenses/plus-ui.MIT.txt. -->
<script setup lang="ts">
import { Search, Refresh } from "@element-plus/icons-vue";
withDefaults(defineProps<{ showSearch?: boolean; search?: boolean }>(), {
  showSearch: true,
  search: true,
});
defineEmits<{ "update:showSearch": [value: boolean]; queryTable: [] }>();
</script>
<template>
  <div class="right-toolbar">
    <el-tooltip
      v-if="search"
      :content="showSearch ? '收起筛选' : '展开筛选'"
      placement="top"
      ><el-button
        :icon="Search"
        circle
        :aria-label="showSearch ? '收起筛选' : '展开筛选'"
        @click="$emit('update:showSearch', !showSearch)"
    /></el-tooltip>
    <el-tooltip content="重置当前筛选" placement="top"
      ><el-button
        :icon="Refresh"
        circle
        aria-label="重置当前筛选"
        @click="$emit('queryTable')"
    /></el-tooltip>
  </div>
</template>
