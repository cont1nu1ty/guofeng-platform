<script setup lang="ts">
import { isHttpMode, modeText } from "../services/mode";
import EducationManager from "../components/EducationManager.vue";

import { saveCourse, toggleCourse } from "../services/actions";

import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  Search,
  Plus,
  Reading,
  Collection,
  User,
} from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import {
  courses,
  learningGroups,
  type Course,
  type LearningGroup,
} from "../domain/operations";
import { matchesRegion } from "../domain/workspace";
const tab = ref("courses"),
  query = ref(""),
  category = ref("");
const visibleCourses = computed(() =>
  courses.filter(
    (item) =>
      (!query.value ||
        `${item.title}${item.teacher}`.includes(query.value.trim())) &&
      (!category.value || item.category === category.value),
  ),
);
const regionalGroups = computed(() =>
  learningGroups.filter((item) => matchesRegion(item.region)),
);
const visibleGroups = computed(() =>
  regionalGroups.value.filter(
    (item) =>
      !query.value || `${item.name}${item.region}`.includes(query.value.trim()),
  ),
);
const learners = computed(() =>
  regionalGroups.value.reduce((sum, item) => sum + item.members, 0),
);
const completed = computed(() =>
  regionalGroups.value.reduce((sum, item) => sum + item.completed, 0),
);
const courseOpen = ref(false),
  groupOpen = ref(false),
  selectedGroup = ref<LearningGroup | null>(null);
const form = reactive({
  id: "",
  title: "",
  category: "清廉家风",
  duration: 30,
  chapters: 4,
  teacher: "家风教研组",
  description: "",
});
function editCourse(course?: Course) {
  Object.assign(
    form,
    course
      ? { ...course }
      : {
          id: "",
          title: "",
          category: "清廉家风",
          duration: 30,
          chapters: 4,
          teacher: "家风教研组",
          description: "",
        },
  );
  courseOpen.value = true;
}
async function submit() {
  const result = await saveCourse(form);
  if (!result.ok) return ElMessage.warning(result.message);
  ElMessage.success(result.message);
  courseOpen.value = false;
}
async function changeCourse(course: Course) {
  await toggleCourse(course.id);
  ElMessage.success("课程状态已更新");
}
function openGroup(group: LearningGroup) {
  selectedGroup.value = group;
  groupOpen.value = true;
}
function titleFor(id: string) {
  return courses.find((item) => item.id === id)?.title ?? id;
}
</script>
<template>
  <EducationManager v-if="isHttpMode" />
  <template v-else>
    <PageHeading
      title="清廉教育"
      description="以清廉家风涵养清正作风，做好课程、班组与学习台账管理。"
      eyebrow="INTEGRITY EDUCATION"
      ><template #actions
        ><el-button
          v-has-permi="'education:write'"
          type="primary"
          :icon="Plus"
          @click="editCourse()"
          >新建课程</el-button
        ></template
      ></PageHeading
    >
    <div class="education-intro">
      <div class="intro-emblem">
        <el-icon><Reading /></el-icon>
      </div>
      <div>
        <h2>家风润心，清廉同行</h2>
        <p>课程编排 · 分组学习 · 台账留痕</p>
      </div>
      <span class="intro-mark">修身 · 齐家</span>
    </div>
    <div class="stat-grid education-stats">
      <div class="stat-card">
        <span class="muted">课程</span
        ><strong>{{ courses.length }}<small>门</small></strong
        ><el-icon><Collection /></el-icon>
      </div>
      <div class="stat-card">
        <span class="muted">当前地区学习组</span
        ><strong>{{ regionalGroups.length }}<small>组</small></strong
        ><el-icon><User /></el-icon>
      </div>
      <div class="stat-card">
        <span class="muted">参与人数</span
        ><strong>{{ learners }}<small>人</small></strong
        ><el-icon><Reading /></el-icon>
      </div>
      <div class="stat-card">
        <span class="muted">完成记录</span
        ><strong>{{ completed }}<small>条</small></strong
        ><el-icon><Collection /></el-icon>
      </div>
    </div>
    <section class="panel">
      <el-tabs v-model="tab" @tab-change="query = ''"
        ><el-tab-pane name="courses" label="课程资源" /><el-tab-pane
          name="ledger"
          label="班组学习台账"
      /></el-tabs>
      <div class="filter-bar">
        <el-input
          v-model="query"
          :placeholder="
            tab === 'courses' ? '搜索课程名称或教研组' : '搜索班组名称或地区'
          "
          clearable
          :prefix-icon="Search"
          aria-label="搜索课程或班组"
        /><el-select
          v-if="tab === 'courses'"
          v-model="category"
          placeholder="全部课程分类"
          clearable
          aria-label="课程分类"
          ><el-option
            v-for="item in ['清廉家风', '红色家风', '主题教育']"
            :key="item"
            :value="item"
            :label="item"
        /></el-select>
      </div>
      <template v-if="tab === 'courses'"
        ><div class="course-list">
          <article
            v-for="(course, index) in visibleCourses"
            :key="course.id"
            class="course-row"
          >
            <div class="course-cover" :class="`tone-${index % 3}`">
              <span>家风课堂</span><el-icon><Reading /></el-icon
              ><small>{{ course.category }}</small>
            </div>
            <div class="course-main">
              <div class="course-top">
                <el-tag size="small" effect="plain" type="info">{{
                  course.category
                }}</el-tag
                ><el-tag
                  :type="course.status === '已上架' ? 'success' : 'info'"
                  size="small"
                  >{{ course.status }}</el-tag
                >
              </div>
              <h3>{{ course.title }}</h3>
              <p>{{ course.description }}</p>
              <div class="course-meta">
                <span>{{ course.teacher }}</span
                ><span>{{ course.duration }} 分钟</span
                ><span>{{ course.chapters }} 章节</span>
              </div>
            </div>
            <div class="course-actions">
              <el-button
                v-has-permi="'education:write'"
                @click="editCourse(course)"
                >编辑课程</el-button
              ><el-button
                v-has-permi="'education:write'"
                link
                type="primary"
                @click="changeCourse(course)"
                >{{
                  course.status === "已上架" ? "下架课程" : "上架课程"
                }}</el-button
              >
            </div>
          </article>
        </div>
        <el-empty
          v-if="!visibleCourses.length"
          description="没有匹配的课程，请调整搜索条件"
      /></template>
      <template v-else
        ><el-alert
          class="ledger-note"
          :title="
            modeText(
              '台账汇总用户学习记录，不代表实名核验或正式承诺书签署。',
              '台账数值为预置样例，不代表实际学习、实名核验或承诺书签署。',
            )
          "
          type="info"
          :closable="false"
          show-icon
        /><el-table :data="visibleGroups" row-key="id"
          ><el-table-column
            prop="name"
            label="学习班组"
            min-width="220" /><el-table-column
            prop="region"
            label="地区"
            width="100" /><el-table-column label="学习课程" min-width="220"
            ><template #default="{ row }">{{
              titleFor(row.courseId)
            }}</template></el-table-column
          ><el-table-column
            prop="members"
            label="人数"
            width="70" /><el-table-column label="进度" width="155"
            ><template #default="{ row }"
              ><el-progress
                :percentage="Math.round((row.completed / row.members) * 100)"
                :stroke-width="5"
                color="#7b9580" /></template></el-table-column
          ><el-table-column label="操作" width="105" fixed="right"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="openGroup(row)"
                >查看台账</el-button
              ></template
            ></el-table-column
          ><template #empty
            ><el-empty description="当前地区没有符合条件的学习班组" /></template
        ></el-table>
        <div class="table-tools muted">
          共 {{ visibleGroups.length }} 个学习班组 ·
          真实学习完成标准与签署证据待后续接入
        </div></template
      >
    </section>
    <el-dialog
      v-model="courseOpen"
      :title="form.id ? '编辑课程' : '新建课程草稿'"
      width="min(620px, 92vw)"
      ><el-form label-position="top"
        ><el-form-item label="课程名称" required
          ><el-input
            v-model="form.title"
            maxlength="60"
            placeholder="输入课程名称，至少 4 字"
        /></el-form-item>
        <div class="form-two">
          <el-form-item label="课程分类" required
            ><el-select v-model="form.category"
              ><el-option
                v-for="item in ['清廉家风', '红色家风', '主题教育']"
                :key="item"
                :value="item"
                :label="item" /></el-select></el-form-item
          ><el-form-item label="授课 / 教研团队" required
            ><el-input v-model="form.teacher" maxlength="40" /></el-form-item
          ><el-form-item label="课程时长（分钟）" required
            ><el-input-number
              v-model="form.duration"
              :min="1"
              :max="300"
              :precision="0" /></el-form-item
          ><el-form-item label="章节数量" required
            ><el-input-number
              v-model="form.chapters"
              :min="1"
              :max="50"
              :precision="0"
          /></el-form-item>
        </div>
        <el-form-item label="课程简介" required
          ><el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="说明学习主题与内容，至少 10 字" /></el-form-item
      ></el-form>
      <p class="muted">
        本次编辑课程信息，不上传视频、创建真实学习任务或生成证书。
      </p>
      <template #footer
        ><el-button @click="courseOpen = false">取消</el-button
        ><el-button
          v-has-permi="'education:write'"
          type="primary"
          @click="submit"
          >保存课程</el-button
        ></template
      ></el-dialog
    >
    <el-drawer v-model="groupOpen" title="学习班组台账" size="min(640px, 100vw)"
      ><template v-if="selectedGroup"
        ><el-tag effect="plain">{{ selectedGroup.region }}</el-tag>
        <h2 class="group-title">{{ selectedGroup.name }}</h2>
        <p class="muted">{{ titleFor(selectedGroup.courseId) }}</p>
        <div class="group-numbers">
          <div>
            <strong>{{ selectedGroup.members }}</strong
            ><span>班组人数</span>
          </div>
          <div>
            <strong>{{ selectedGroup.completed }}</strong
            ><span>完成记录</span>
          </div>
          <div>
            <strong>{{ selectedGroup.declarations }}</strong
            ><span>承诺书记录</span>
          </div>
        </div>
        <h3 class="section-title">学习安排</h3>
        <el-timeline class="learning-timeline"
          ><el-timeline-item timestamp="课程分配" color="#9c493e">{{
            titleFor(selectedGroup.courseId)
          }}</el-timeline-item
          ><el-timeline-item timestamp="学习材料" color="#b99a63"
            >课程章节、讨论问题与情景练习（结构示例）</el-timeline-item
          ><el-timeline-item
            :timestamp="`更新于 ${selectedGroup.date}`"
            color="#7d967e"
            >进度来自学习台账，课程完成不等于已完成正式签署</el-timeline-item
          ></el-timeline
        ><el-alert
          title="正式接入时需关联身份、学习证据与签署记录；本页不产生真实学习或签署证明。"
          :closable="false"
          type="info"
          show-icon /></template
    ></el-drawer>
  </template>
</template>
<style scoped>
.education-intro {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 26px 30px;
  border: 1px solid #dfe6dc;
  border-radius: 12px;
  background: #edf2e9;
  margin-bottom: 22px;
}
.intro-emblem {
  width: 62px;
  height: 62px;
  background: #dce6d7;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #68805c;
  font-size: 31px;
  flex-shrink: 0;
}
.education-intro h2 {
  font-family: serif;
  font-size: 25px;
  letter-spacing: 3px;
  color: #4d6046;
  margin: 0 0 10px;
}
.education-intro p {
  font-size: 12px;
  color: #8c9b81;
  letter-spacing: 2px;
  margin: 0;
}
.intro-mark {
  margin-left: auto;
  color: #9da88d;
  font-family: serif;
  font-size: 23px;
  letter-spacing: 5px;
}
.education-stats .stat-card {
  position: relative;
}
.stat-card strong {
  display: block;
  font-size: 30px;
  margin-top: 13px;
  color: #4d5847;
}
.stat-card small {
  font-size: 12px;
  font-weight: 400;
  color: #969d91;
  margin-left: 7px;
}
.stat-card .el-icon {
  position: absolute;
  right: 22px;
  bottom: 24px;
  color: #bdc9b5;
  font-size: 28px;
}
.course-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.course-row {
  display: flex;
  gap: 24px;
  padding: 20px;
  border: 1px solid #e8e8e0;
  border-radius: 9px;
}
.course-cover {
  width: 130px;
  min-height: 154px;
  flex-shrink: 0;
  background: #e9eee4;
  color: #6c805c;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 15px;
  position: relative;
}
.course-cover:after {
  content: "";
  position: absolute;
  inset: 10px;
  border: 1px solid #b7c6ab66;
}
.course-cover > span {
  font-size: 11px;
  letter-spacing: 4px;
}
.course-cover .el-icon {
  font-size: 40px;
}
.course-cover > small {
  font-size: 10px;
  letter-spacing: 2px;
}
.tone-1 {
  background: #f2ecdf;
  color: #a68d5c;
}
.tone-2 {
  background: #f2e5df;
  color: #aa6e5d;
}
.course-main {
  flex: 1;
  min-width: 0;
}
.course-top {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.course-main h3 {
  font-size: 18px;
  color: #454c3f;
  margin: 14px 0 9px;
}
.course-main p {
  font-size: 13px;
  color: #8c9385;
  line-height: 1.7;
  margin: 0;
}
.course-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  color: #a0a596;
  font-size: 12px;
  margin-top: 16px;
}
.course-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  flex-shrink: 0;
}
.course-actions .el-button {
  margin: 0;
}
.filter-bar .el-input {
  max-width: 320px;
}
.filter-bar .el-select {
  width: 180px;
}
.form-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 18px;
}
.form-two .el-input-number {
  width: 100%;
}
.ledger-note {
  margin-bottom: 22px;
}
.group-title {
  font-size: 23px;
  margin: 22px 0 10px;
}
.group-numbers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: #f2f5ef;
  border-radius: 8px;
  margin: 25px 0 30px;
  padding: 22px 10px;
  text-align: center;
  gap: 8px;
}
.group-numbers strong {
  display: block;
  font-size: 29px;
  color: #627553;
  margin-bottom: 8px;
}
.group-numbers span {
  font-size: 11px;
  color: #8d9882;
}
.learning-timeline {
  margin: 24px 0;
  padding-left: 7px;
}
@media (max-width: 700px) {
  .intro-mark {
    display: none;
  }
  .education-intro {
    padding: 23px 19px;
    gap: 13px;
  }
  .education-intro h2 {
    font-size: 20px;
    letter-spacing: 1px;
  }
  .education-intro p {
    letter-spacing: 0;
  }
  .intro-emblem {
    width: 46px;
    height: 46px;
    font-size: 24px;
  }
  .course-row {
    flex-wrap: wrap;
    padding: 16px;
    gap: 16px;
  }
  .course-cover {
    width: 78px;
    min-height: 145px;
  }
  .course-cover > span {
    letter-spacing: 1px;
    font-size: 10px;
  }
  .course-actions {
    flex-basis: 100%;
    flex-direction: row;
    justify-content: flex-end;
  }
  .course-main h3 {
    font-size: 16px;
    line-height: 1.6;
    margin: 9px 0;
  }
  .course-meta {
    gap: 9px;
    font-size: 11px;
  }
  .form-two {
    grid-template-columns: 1fr;
  }
  .filter-bar .el-input,
  .filter-bar .el-select {
    width: 100%;
    max-width: none;
  }
}
</style>
