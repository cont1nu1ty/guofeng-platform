<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import PageHeading from "./PageHeading.vue";
import { session } from "../services/session";
import {
  fetchEducation,
  educationCommand,
  searchEducationMembers,
} from "../services/education";
import {
  newCourse,
  newLesson,
  newQuestion,
  validateCourse,
  contentId,
  type EducationCourse,
  type EducationGroup,
  type EducationIdentity,
  type EducationWorkspace,
} from "../domain/education";
const data = reactive<EducationWorkspace>({
  courses: [],
  learningGroups: [],
  identities: [],
  members: [],
});
const pages = reactive({ coursePage: 1, groupPage: 1, identityPage: 1 });
const memberSearchBusy = ref(false);
const selectedMembers = ref<EducationWorkspace["members"]>([]);
const memberOptions = computed(() => [
  ...new Map(
    [...selectedMembers.value, ...data.members].map((m) => [m.id, m]),
  ).values(),
]);
let memberSearchSerial = 0;
async function searchMembers(q: string) {
  const serial = ++memberSearchSerial;
  memberSearchBusy.value = true;
  try {
    const result = await searchEducationMembers(q);
    if (serial === memberSearchSerial) data.members = result.items;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "成员搜索失败";
  } finally {
    if (serial === memberSearchSerial) memberSearchBusy.value = false;
  }
}
const tab = ref("courses"),
  query = ref(""),
  busy = ref(false),
  error = ref("");
const courseOpen = ref(false),
  groupOpen = ref(false),
  ledger = ref<EducationGroup | null>(null);
const form = ref(newCourse());
const group = reactive({
  id: "",
  name: "",
  region: "all",
  courseId: "",
  publicationVersion: 0,
  cadreOnly: false,
  declarationText: "",
  version: undefined as number | undefined,
  memberIds: [] as string[],
});
const regions = computed(() =>
  session.user?.roles.includes("national_admin")
    ? ["all", ...new Set(data.members.flatMap((x) => x.regions))]
    : session.user?.regionIds || [],
);
const visible = computed(() => data.courses);
const selectedCourse = computed(() =>
  data.courses.find((x) => x.id === group.courseId),
);
const statusName = (s: string) =>
  ({ pending: "待人工审核", approved: "人工审核通过", rejected: "已退回" })[
    s
  ] || "未申请";
async function reload() {
  Object.assign(data, await fetchEducation({ ...pages, q: query.value }));
}
async function run(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await action();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "操作未完成，请重试。";
  } finally {
    busy.value = false;
  }
}
onMounted(() => run(reload));
function edit(course?: EducationCourse) {
  error.value = "";
  form.value = course
    ? JSON.parse(JSON.stringify(course))
    : newCourse(regions.value[0] || "all");
  courseOpen.value = true;
}
function move(index: number, delta: number) {
  const lessons = form.value.lessons;
  const target = index + delta;
  if (target < 0 || target >= lessons.length) return;
  [lessons[index], lessons[target]] = [lessons[target]!, lessons[index]!];
}
function removeQuestion(id: string) {
  form.value.questions = form.value.questions.filter((q) => q.id !== id);
  form.value.examQuestionIds = form.value.examQuestionIds.filter(
    (q) => q !== id,
  );
}
function toggleExam(id: string, value: unknown) {
  form.value.examQuestionIds = value
    ? [...form.value.examQuestionIds, id]
    : form.value.examQuestionIds.filter((q) => q !== id);
}
async function save() {
  error.value = validateCourse(form.value);
  if (error.value) return;
  await run(async () => {
    await educationCommand(
      "saveCourse",
      form.value.id,
      form.value.lockVersion,
      form.value,
    );
    await reload();
    courseOpen.value = false;
    ElMessage.success("草稿已保存，已发布版本保持不变");
  });
}
async function publish(course: EducationCourse) {
  try {
    await ElMessageBox.confirm(
      `将“${course.title}”草稿发布为新版本。旧班组和旧学习记录继续绑定原版本。`,
      "发布课程",
      { confirmButtonText: "发布新版本", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  await run(async () => {
    await educationCommand("publishCourse", course.id, course.lockVersion);
    await reload();
    ElMessage.success("课程版本已发布");
  });
}
function editGroup(item?: EducationGroup) {
  selectedMembers.value = (item?.memberRecords || []).map((m) => ({
    id: m.id,
    name: m.name,
    regions: [item!.region],
  }));
  error.value = "";
  Object.assign(
    group,
    item
      ? { ...item, memberIds: item.memberRecords.map((m) => m.id) }
      : {
          id: "",
          name: "",
          region: regions.value[0] || "all",
          courseId: "",
          publicationVersion: 0,
          cadreOnly: false,
          declarationText: "",
          version: undefined,
          memberIds: [],
        },
  );
  groupOpen.value = true;
}
async function saveGroup() {
  if (!group.name.trim() || !group.courseId || !group.publicationVersion) {
    error.value = "请填写班组名称并选择已发布课程版本。";
    return;
  }
  await run(async () => {
    await educationCommand(
      "education.saveGroup",
      group.id,
      group.version,
      group,
    );
    await reload();
    groupOpen.value = false;
    ElMessage.success("班组与成员分配已保存");
  });
}
async function review(identity: EducationIdentity, status: string) {
  let reason: string;
  try {
    reason = (
      await ElMessageBox.prompt(
        "填写人工核验依据或退回原因（至少2字）；该记录不替代外部实名核验。",
        status === "approved" ? "确认干部身份" : "退回身份申请",
        {
          inputType: "textarea",
          inputValidator: (value) =>
            (!!value && value.trim().length >= 2) || "请填写依据或原因",
        },
      )
    ).value;
  } catch {
    return;
  }
  await run(async () => {
    await educationCommand(
      "education.reviewIdentity",
      identity.userId,
      identity.version,
      { status, reason },
    );
    await reload();
    ElMessage.success("审核结果已记录");
  });
}
</script>
<template>
  <PageHeading
    title="清廉教育"
    eyebrow="INTEGRITY EDUCATION"
    description="课程版本、单选题库、班组学习与人工核验台账。"
    ><template #actions
      ><el-button v-has-permi="'education:write'" type="primary" @click="edit()"
        >新建课程</el-button
      ></template
    ></PageHeading
  >
  <el-alert
    v-if="error"
    :title="error"
    type="error"
    :closable="false"
    show-icon
    role="alert"
  />
  <section class="panel education-panel" v-loading="busy">
    <el-tabs v-model="tab"
      ><el-tab-pane name="courses" label="课程与题库" /><el-tab-pane
        name="groups"
        label="班组与承诺" /><el-tab-pane
        name="identities"
        label="干部身份人工审核"
    /></el-tabs>
    <template v-if="tab === 'courses'">
      <div class="filter-bar">
        <el-input
          v-model="query"
          aria-label="搜索课程"
          placeholder="搜索课程名称或教研团队"
          @change="
            pages.coursePage = 1;
            run(reload);
          "
          clearable
        /><el-button :disabled="busy" @click="run(reload)">刷新</el-button>
      </div>
      <el-alert
        title="编辑只保存草稿。发布产生不可变版本；阅读确认和测验通过不代表真实学时或正式证书。"
        type="info"
        :closable="false"
      />
      <article
        v-for="course in visible"
        :key="course.id"
        class="education-course"
      >
        <div>
          <el-tag :type="course.status === '已上架' ? 'success' : 'info'">{{
            course.status
          }}</el-tag
          ><span class="muted">
            · 已发布 v{{ course.publishedVersion }} · 草稿
            {{ course.lessons.length }} 章 /
            {{ course.questions.length }} 题</span
          >
          <h3>{{ course.title }}</h3>
          <p>{{ course.description }}</p>
          <span class="muted"
            >{{ course.teacher }} · 参考 {{ course.duration }} 分钟 · 测验及格
            {{ course.passPercent }}%</span
          >
        </div>
        <div class="education-actions">
          <el-button v-has-permi="'education:write'" @click="edit(course)"
            >编辑草稿</el-button
          ><el-button
            v-has-permi="'education:write'"
            type="primary"
            plain
            @click="publish(course)"
            >发布新版本</el-button
          ><el-button
            v-if="course.status === '已上架'"
            v-has-permi="'education:write'"
            link
            type="danger"
            @click="
              run(async () => {
                await educationCommand(
                  'unpublishCourse',
                  course.id,
                  course.lockVersion,
                );
                await reload();
              })
            "
            >下架</el-button
          >
        </div>
      </article>
      <el-empty v-if="!visible.length" description="没有符合条件的课程" />
    </template>
    <template v-else-if="tab === 'groups'">
      <div class="filter-bar">
        <el-button
          v-has-permi="'education:write'"
          type="primary"
          @click="editGroup()"
          >新建学习班组</el-button
        ><span class="muted"
          >班组固定课程版本；更换版本请新建班组，保留原台账。</span
        >
      </div>
      <el-table :data="data.learningGroups"
        ><el-table-column
          prop="name"
          label="班组"
          min-width="170"
        /><el-table-column label="课程版本" min-width="150"
          ><template #default="{ row }"
            >{{
              data.courses.find((c) => c.id === row.courseId)?.title ||
              row.courseId
            }}
            · v{{ row.publicationVersion }}</template
          ></el-table-column
        ><el-table-column label="学习 / 承诺" min-width="140"
          ><template #default="{ row }"
            >{{ row.completed }}/{{ row.members }} 完成 ·
            {{ row.declarations }} 确认</template
          ></el-table-column
        ><el-table-column label="操作" min-width="160"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="ledger = row"
              >台账</el-button
            ><el-button
              v-has-permi="'education:write'"
              link
              @click="editGroup(row)"
              >维护成员</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </template>
    <template v-else>
      <el-alert
        title="依据线下或获准资料人工核验。用户自填内容仅为申请，不自动产生干部身份。"
        type="info"
        :closable="false"
      />
      <el-table :data="data.identities"
        ><el-table-column
          prop="name"
          label="申请人"
          min-width="100"
        /><el-table-column
          prop="organization"
          label="单位"
          min-width="150"
        /><el-table-column
          prop="requestNote"
          label="申请说明"
          min-width="230"
        /><el-table-column label="状态 / 依据" min-width="180"
          ><template #default="{ row }"
            >{{ statusName(row.status) }}
            <p>{{ row.reason }}</p></template
          ></el-table-column
        ><el-table-column label="人工审核" min-width="150"
          ><template #default="{ row }"
            ><el-button
              v-has-permi="'education:write'"
              link
              type="primary"
              @click="review(row, 'approved')"
              >通过</el-button
            ><el-button
              v-has-permi="'education:write'"
              link
              type="danger"
              @click="review(row, 'rejected')"
              >退回</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </template>
    <el-pagination
      v-if="tab === 'courses'"
      v-model:current-page="pages.coursePage"
      :page-size="20"
      :total="data.courseTotal || 0"
      layout="prev,pager,next,total"
      @current-change="run(reload)"
    />
    <el-pagination
      v-else-if="tab === 'groups'"
      v-model:current-page="pages.groupPage"
      :page-size="20"
      :total="data.groupTotal || 0"
      layout="prev,pager,next,total"
      @current-change="run(reload)"
    />
    <el-pagination
      v-else
      v-model:current-page="pages.identityPage"
      :page-size="20"
      :total="data.identityTotal || 0"
      layout="prev,pager,next,total"
      @current-change="run(reload)"
    />
  </section>
  <el-dialog
    v-model="courseOpen"
    title="编辑课程草稿"
    width="min(900px, 95vw)"
    :close-on-click-modal="false"
  >
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      role="alert"
    />
    <el-form label-position="top"
      ><div class="education-grid">
        <el-form-item label="课程名称" required
          ><el-input v-model="form.title" maxlength="100" /></el-form-item
        ><el-form-item label="教研团队" required
          ><el-input v-model="form.teacher" maxlength="100" /></el-form-item
        ><el-form-item label="分类" required
          ><el-input v-model="form.category" maxlength="100" /></el-form-item
        ><el-form-item label="归属地区"
          ><el-select
            v-model="form.region"
            :disabled="form.publishedVersion > 0"
            ><el-option
              v-for="r in regions"
              :key="r"
              :value="r"
              :label="r === 'all' ? '全国' : r" /></el-select></el-form-item
        ><el-form-item label="参考时长（分钟，不计真实学时）"
          ><el-input-number
            v-model="form.duration"
            :min="1"
            :max="300" /></el-form-item
        ><el-form-item label="发布后的测验及格线（百分比）"
          ><el-input-number v-model="form.passPercent" :min="1" :max="100"
        /></el-form-item>
      </div>
      <el-form-item label="课程简介" required
        ><el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          maxlength="10000"
      /></el-form-item>
      <h3>章节编排</h3>
      <div
        v-for="(lesson, i) in form.lessons"
        :key="lesson.id"
        class="education-editor"
      >
        <div class="education-between">
          <strong>第 {{ i + 1 }} 章</strong>
          <div>
            <el-button size="small" :disabled="i === 0" @click="move(i, -1)"
              >上移</el-button
            ><el-button
              size="small"
              :disabled="i === form.lessons.length - 1"
              @click="move(i, 1)"
              >下移</el-button
            ><el-button
              size="small"
              type="danger"
              plain
              :disabled="form.lessons.length === 1"
              @click="form.lessons.splice(i, 1)"
              >删除章节</el-button
            >
          </div>
        </div>
        <el-form-item label="章节标题" required
          ><el-input v-model="lesson.title" maxlength="150" /></el-form-item
        ><el-form-item label="章节正文" required
          ><el-input
            v-model="lesson.body"
            type="textarea"
            :rows="5"
            maxlength="30000" /></el-form-item
        ><el-form-item label="讨论与实践提示"
          ><el-input
            v-model="lesson.practice"
            type="textarea"
            :rows="2"
            maxlength="10000"
        /></el-form-item>
      </div>
      <el-button
        :disabled="form.lessons.length >= 50"
        @click="form.lessons.push(newLesson())"
        >添加章节</el-button
      >
      <h3>单选题库与组卷</h3>
      <p class="muted">
        勾选“纳入本版本测验”组卷。题库答案仅管理端可见，由服务端判分；不组卷则按全部章节阅读确认完成。
      </p>
      <div
        v-for="(q, i) in form.questions"
        :key="q.id"
        class="education-editor"
      >
        <div class="education-between">
          <strong>题目 {{ i + 1 }}</strong
          ><el-button type="danger" link @click="removeQuestion(q.id)"
            >删除题目</el-button
          >
        </div>
        <el-checkbox
          :model-value="form.examQuestionIds.includes(q.id)"
          @change="toggleExam(q.id, $event)"
          >纳入本版本测验</el-checkbox
        ><el-form-item label="题干" required
          ><el-input
            v-model="q.prompt"
            type="textarea"
            :rows="2"
            maxlength="3000" /></el-form-item
        ><el-form-item
          v-for="(option, oi) in q.options"
          :key="option.id"
          :label="`选项 ${oi + 1}`"
          required
          ><div class="education-option">
            <el-input v-model="option.text" maxlength="2000" /><el-button
              :disabled="q.options.length <= 2"
              @click="
                q.options.splice(oi, 1);
                if (q.answerId === option.id) q.answerId = q.options[0]!.id;
              "
              >移除</el-button
            >
          </div></el-form-item
        ><el-button
          size="small"
          :disabled="q.options.length >= 6"
          @click="q.options.push({ id: contentId('option'), text: '' })"
          >添加选项</el-button
        ><el-form-item label="正确答案（不发送给学员）" required
          ><el-select v-model="q.answerId"
            ><el-option
              v-for="(o, oi) in q.options"
              :key="o.id"
              :value="o.id"
              :label="`选项 ${oi + 1}`" /></el-select></el-form-item
        ><el-form-item label="内部解析"
          ><el-input
            v-model="q.explanation"
            type="textarea"
            :rows="2"
            maxlength="5000"
        /></el-form-item>
      </div>
      <el-button
        :disabled="form.questions.length >= 200"
        @click="form.questions.push(newQuestion())"
        >添加单选题</el-button
      > </el-form
    ><template #footer
      ><el-button :disabled="busy" @click="courseOpen = false">取消</el-button
      ><el-button type="primary" :loading="busy" @click="save"
        >保存草稿</el-button
      ></template
    >
  </el-dialog>
  <el-dialog
    v-model="groupOpen"
    title="学习班组与成员分配"
    width="min(680px, 95vw)"
    :close-on-click-modal="false"
    ><el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      role="alert"
    /><el-form label-position="top"
      ><el-form-item label="班组名称" required
        ><el-input v-model="group.name" maxlength="150"
      /></el-form-item>
      <div class="education-grid">
        <el-form-item label="地区"
          ><el-select v-model="group.region" :disabled="!!group.id"
            ><el-option
              v-for="r in regions"
              :key="r"
              :value="r"
              :label="r" /></el-select></el-form-item
        ><el-form-item label="课程" required
          ><el-select
            v-model="group.courseId"
            :disabled="!!group.id"
            @change="
              group.publicationVersion = selectedCourse?.publishedVersion || 0
            "
            ><el-option
              v-for="c in data.courses.filter((c) => c.publishedVersion > 0)"
              :key="c.id"
              :value="c.id"
              :label="c.title" /></el-select></el-form-item
        ><el-form-item label="固定发布版本" required
          ><el-select v-model="group.publicationVersion" :disabled="!!group.id"
            ><el-option
              v-for="v in selectedCourse?.versions || []"
              :key="v.version"
              :value="v.version"
              :label="`v${v.version}`" /></el-select></el-form-item
        ><el-form-item label="成员身份要求"
          ><el-switch v-model="group.cadreOnly" active-text="仅限人工审核干部"
        /></el-form-item>
      </div>
      <el-form-item label="班组成员"
        ><el-select
          v-model="group.memberIds"
          remote
          :remote-method="searchMembers"
          :loading="memberSearchBusy"
          placeholder="搜索姓名或输入完整账号ID（最多显示50个候选）"
          multiple
          filterable
          collapse-tags
          :max-collapse-tags="5"
          ><el-option
            v-for="m in memberOptions"
            :key="m.id"
            :value="m.id"
            :label="`${m.name} (${m.id})`" /></el-select></el-form-item
      ><el-form-item label="承诺内容（可选）"
        ><el-input
          v-model="group.declarationText"
          type="textarea"
          :rows="6"
          maxlength="10000"
      /></el-form-item>
      <p class="muted">
        成员主动阅读确认后保存版本、时间和内容摘要；属于承诺确认台账，不是电子签章。修改班组后需按新版本重新确认。
      </p></el-form
    ><template #footer
      ><el-button @click="groupOpen = false">取消</el-button
      ><el-button type="primary" :loading="busy" @click="saveGroup"
        >保存班组</el-button
      ></template
    ></el-dialog
  >
  <el-drawer
    :model-value="!!ledger"
    title="班组学习与承诺台账"
    size="min(760px, 100vw)"
    @close="ledger = null"
    ><template v-if="ledger"
      ><h2>{{ ledger.name }}</h2>
      <p>
        课程 v{{ ledger.publicationVersion }} · {{ ledger.completed }}/{{
          ledger.members
        }}
        完成 · {{ ledger.declarations }} 份本版本承诺确认
      </p>
      <el-table :data="ledger.memberRecords"
        ><el-table-column prop="name" label="成员" /><el-table-column
          label="干部身份"
          ><template #default="{ row }">{{
            statusName(row.identityStatus)
          }}</template></el-table-column
        ><el-table-column prop="bestScore" label="最佳成绩" /><el-table-column
          prop="completedAt"
          label="完成时间"
          min-width="180"
      /></el-table>
      <h3>承诺确认归档</h3>
      <el-collapse
        ><el-collapse-item
          v-for="entry in ledger.declarationHistory"
          :key="entry.id"
          :name="entry.id"
          :title="`${entry.name} · v${entry.groupVersion} · ${entry.confirmedAt}`"
          ><p class="education-text">{{ entry.text }}</p>
          <p class="muted">SHA-256：{{ entry.textHash }}</p></el-collapse-item
        ></el-collapse
      >
      <h3>当前承诺内容</h3>
      <p class="education-text">
        {{ ledger.declarationText || "本班组未要求承诺确认。" }}
      </p></template
    ></el-drawer
  >
</template>
<style scoped>
.education-panel {
  margin-top: 18px;
}
.education-course {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding: 24px 0;
}
.education-course > div:first-child {
  min-width: 0;
}
.education-course p {
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.education-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.education-actions .el-button {
  margin: 0;
}
.education-editor {
  padding: 18px;
  margin: 16px 0;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}
.education-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 18px;
}
.education-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.education-option {
  display: flex;
  gap: 10px;
  width: 100%;
}
.education-text {
  white-space: pre-wrap;
  line-height: 1.8;
}
.el-select {
  width: 100%;
}
@media (max-width: 700px) {
  .education-course {
    flex-direction: column;
    gap: 12px;
  }
  .education-grid {
    grid-template-columns: 1fr;
  }
  .education-between {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .education-actions {
    justify-content: flex-start;
  }
  .education-editor {
    padding: 12px;
  }
  .education-between .el-button {
    margin: 3px;
  }
}
</style>
