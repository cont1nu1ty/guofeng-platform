<script setup lang="ts">
import type { ReviewRubric } from "../domain/reviewRubrics";
const props = defineProps<{
  rubrics: ReviewRubric[];
  stages: { name: string }[];
}>();
function add(rubric: ReviewRubric) {
  let index = 1;
  while (
    rubric.dimensions.some((dimension) => dimension.id === `dimension${index}`)
  )
    index++;
  rubric.dimensions.push({
    id: `dimension${index}`,
    label: "新维度",
    max: 10,
    description: "",
  });
}
</script>
<template>
  <div class="rubric-editor">
    <p>
      每个节点独立维护量表，合计 100
      分。发布后只绑定新提交的稿件版本；已绑定稿件和已分配任务保持原规则。
    </p>
    <el-collapse>
      <el-collapse-item
        v-for="(rubric, index) in props.rubrics"
        :key="index"
        :name="index"
        :title="`${index + 1}. ${props.stages[index]?.name} · ${rubric.dimensions.reduce((sum, value) => sum + value.max, 0)} / 100 分`"
      >
        <el-form-item label="量表名称"
          ><el-input v-model="rubric.title" maxlength="100"
        /></el-form-item>
        <div
          v-for="(dimension, position) in rubric.dimensions"
          :key="position"
          class="rubric-dimension"
        >
          <el-form-item label="维度标识"
            ><el-input v-model="dimension.id" maxlength="40"
          /></el-form-item>
          <el-form-item label="维度名称"
            ><el-input v-model="dimension.label" maxlength="80"
          /></el-form-item>
          <el-form-item label="满分"
            ><el-input-number
              v-model="dimension.max"
              :min="1"
              :max="100"
              :precision="0"
          /></el-form-item>
          <el-form-item label="评分标准"
            ><el-input
              v-model="dimension.description"
              type="textarea"
              maxlength="1000"
              :rows="2"
          /></el-form-item>
          <el-button
            :disabled="rubric.dimensions.length === 1"
            @click="rubric.dimensions.splice(position, 1)"
            >删除维度</el-button
          >
        </div>
        <el-button
          :disabled="rubric.dimensions.length >= 10"
          @click="add(rubric)"
          >添加维度</el-button
        >
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
<style scoped>
.rubric-editor {
  width: 100%;
}
.rubric-editor p {
  line-height: 1.7;
}
.rubric-dimension {
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}
</style>
