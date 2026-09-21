<!-- Adapted from plus-ui Pagination at 259325b4eecd715279b66b70f90eb9a2f741133c. MIT; see licenses/plus-ui.MIT.txt. -->
<script setup lang="ts">
import { computed } from "vue";
const props = withDefaults(
  defineProps<{
    total: number;
    page?: number;
    limit?: number;
    pageSizes?: number[];
    hidden?: boolean;
  }>(),
  { page: 1, limit: 10, pageSizes: () => [5, 10, 20], hidden: false },
);
const emit = defineEmits<{
  "update:page": [value: number];
  "update:limit": [value: number];
  pagination: [value: { page: number; limit: number }];
}>();
const currentPage = computed({
  get: () => props.page,
  set: (value) => emit("update:page", value),
});
const pageSize = computed({
  get: () => props.limit,
  set: (value) => emit("update:limit", value),
});
function handleSizeChange(value: number) {
  currentPage.value = 1;
  emit("pagination", { page: 1, limit: value });
}
function handleCurrentChange(value: number) {
  emit("pagination", { page: value, limit: pageSize.value });
}
</script>
<template>
  <div v-if="!hidden" class="pagination-container">
    <span class="pagination-total">共 {{ total }} 条记录</span>
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      background
      layout="prev, pager, next, sizes"
      :page-sizes="pageSizes"
      :pager-count="5"
      :total="total"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>
