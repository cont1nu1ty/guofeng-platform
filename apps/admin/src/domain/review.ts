import { reactive } from "vue";
import { recordActivity } from "./workspace";

export type SubmissionStatus = "待初审" | "评审中" | "退回修改" | "已入围";
export interface Submission {
  id: string;
  title: string;
  author: string;
  region: string;
  genre: string;
  theme: string;
  channel: string;
  source: string;
  submittedAt: string;
  status: SubmissionStatus;
  content: string;
  version: number;
  attachments: string[];
  history: { time: string; title: string; detail: string }[];
}
export interface Expert {
  id: string;
  name: string;
  region: string;
  title: string;
  organization: string;
  specialties: string[];
  group: string;
  availability: "可分配" | "暂不接单";
  biography: string;
}
export interface ReviewTask {
  id: string;
  submissionId: string;
  expertId: string;
  region: string;
  stage: string;
  assignedAt: string;
  dueAt: string;
  status: "待评分" | "已完成";
  scores?: number[];
  comment?: string;
  completedAt?: string;
}
export interface ActionResult {
  ok: boolean;
  message: string;
}
export const submissionStatuses: SubmissionStatus[] = [
  "待初审",
  "评审中",
  "退回修改",
  "已入围",
];
export const expertGroups = ["文史研究组", "文学创作组", "家风教育组"];
export const scoringDimensions = [
  {
    label: "思想与价值",
    max: 30,
    description: "主题积极，体现家风文化的当代价值",
  },
  { label: "内容与表达", max: 30, description: "叙事完整，表达真切，文字准确" },
  {
    label: "文化与传承",
    max: 25,
    description: "有文化内涵，有家庭记忆与传承意义",
  },
  { label: "原创与特色", max: 15, description: "具有独特视角与具体生活细节" },
];

const manuscriptSeeds: [
  string,
  string,
  string,
  string,
  string,
  SubmissionStatus,
][] = [
  ["一封写给女儿的家书", "林知远", "浙江省", "家风家书", "孝老爱亲", "待初审"],
  ["老院里的那盏灯", "陈时安", "北京市", "家风纪实散文", "邻里互助", "待初审"],
  ["清白传家，勤俭立身", "许清禾", "四川省", "家训手记", "清廉家书", "评审中"],
  ["祖母的针线盒", "周慕云", "江苏省", "最美家庭手记", "孝老爱亲", "待初审"],
  [
    "一碗热汤里的乡情",
    "沈以宁",
    "广东省",
    "家风纪实散文",
    "邻里互助",
    "评审中",
  ],
  ["从故乡出发", "赵怀瑾", "浙江省", "红色家风回忆录", "爱国奉献", "退回修改"],
  [
    "书香一脉，薪火相传",
    "叶知秋",
    "北京市",
    "乡贤家族传记",
    "先贤文脉",
    "已入围",
  ],
  ["父亲的旧木尺", "顾明川", "四川省", "家风纪实散文", "爱国奉献", "待初审"],
  ["春风入家门", "陆云舒", "江苏省", "家风诗词楹联", "孝老爱亲", "评审中"],
  ["家训里的日常", "方予安", "广东省", "家风文论", "先贤文脉", "待初审"],
  ["饭桌前的一句叮嘱", "秦书遥", "浙江省", "家训手记", "清廉家书", "评审中"],
  ["三代人的一本账", "唐青和", "江苏省", "最美家庭手记", "家族传记", "已入围"],
  [
    "走过小巷的四季",
    "宋亦舟",
    "北京市",
    "家风纪实散文",
    "邻里互助",
    "退回修改",
  ],
  ["留在扉页上的话", "何映雪", "四川省", "家风家书", "孝老爱亲", "待初审"],
];
const initialSubmissions: Submission[] = manuscriptSeeds.map((item, index) => ({
  id: `DEMO-2026-${String(index + 101).padStart(4, "0")}`,
  title: item[0],
  author: item[1],
  region: item[2],
  genre: item[3],
  theme: item[4],
  status: item[5],
  channel:
    index % 3 === 0 ? "校园青少年" : index % 3 === 1 ? "城乡群众" : "党政干部",
  source: index % 4 === 0 ? "线下归集" : "小程序投稿",
  submittedAt: `2026-09-${String(20 - Math.floor(index / 3)).padStart(2, "0")} ${String(9 + (index % 8)).padStart(2, "0")}:30`,
  version: item[5] === "退回修改" ? 2 : 1,
  attachments: index % 3 === 0 ? ["家书手稿（示例附件）.pdf"] : [],
  content: `记忆里的家，总有一种安静而坚定的力量。小时候，长辈常说，做事要认真，待人要诚恳。这些话没有写成规矩，却藏在每天的生活里。\n\n那一年，邻居家有困难，父亲收拾好工具便去了。回来时天已黑了，他只说：“能帮一点，就帮一点。”后来我才明白，家风不只是挂在墙上的几句话，更是遇到事情时愿意做出的选择。\n\n如今，我们也把这份心意交给下一代：珍惜一粥一饭，尊重每一份劳动，在平凡的日子里认真生活。愿这些细小的善意，像一盏灯，照亮我们归家的路。\n\n——《${item[0]}》原创演示节选。作者、作品与经历均为虚构样例，仅用于后台界面讨论。`,
  history: [
    {
      time: `09-${String(20 - Math.floor(index / 3)).padStart(2, "0")} 09:30`,
      title: "稿件已归集",
      detail: "示例稿件进入投稿作品库，等待运营处理。",
    },
    ...(item[5] === "评审中" || item[5] === "已入围"
      ? [
          {
            time: "09-20 11:10",
            title: "初审通过",
            detail: "资料完整，转入专家评审示例。",
          },
        ]
      : []),
    ...(item[5] === "退回修改"
      ? [
          {
            time: "09-20 14:20",
            title: "退回修改",
            detail: "请补充引用出处，并核对作品标题与附件内容。",
          },
        ]
      : []),
    ...(item[5] === "已入围"
      ? [
          {
            time: "09-20 16:40",
            title: "示例入围",
            detail: "预设入围状态，尚未进行公示发布。",
          },
        ]
      : []),
  ],
}));
const initialExperts: Expert[] = [
  {
    id: "EXP-001",
    name: "王文清",
    region: "北京市",
    title: "文史研究员",
    organization: "燕京文化研究中心（示例）",
    specialties: ["家风文论", "乡贤家族传记"],
    group: "文史研究组",
    availability: "可分配",
    biography:
      "长期关注地方文献整理与家庭文化传承。本档案为虚构样例，用于展示专家分组、任务分配和评审工作量。",
  },
  {
    id: "EXP-002",
    name: "李若川",
    region: "浙江省",
    title: "文学编辑",
    organization: "江南文学社（示例）",
    specialties: ["家风家书", "家风纪实散文"],
    group: "文学创作组",
    availability: "可分配",
    biography:
      "关注散文、家书与生活叙事，侧重作品的语言表达和真实细节。姓名与机构为演示信息。",
  },
  {
    id: "EXP-003",
    name: "张素宁",
    region: "江苏省",
    title: "家庭教育研究员",
    organization: "知行教育研究所（示例）",
    specialties: ["家训手记", "最美家庭手记"],
    group: "家风教育组",
    availability: "可分配",
    biography:
      "关注代际沟通与家庭教育，侧重家训在日常生活中的实践。姓名与机构为演示信息。",
  },
  {
    id: "EXP-004",
    name: "陈望舒",
    region: "四川省",
    title: "诗词研究员",
    organization: "西川诗词学社（示例）",
    specialties: ["家风诗词楹联", "红色家风回忆录"],
    group: "文学创作组",
    availability: "暂不接单",
    biography:
      "关注诗词楹联与红色文化叙事，当前暂停接收新任务。姓名与机构为演示信息。",
  },
  {
    id: "EXP-005",
    name: "赵知微",
    region: "广东省",
    title: "文化研究员",
    organization: "岭南文化工作室（示例）",
    specialties: ["家风纪实散文", "家风文论"],
    group: "文史研究组",
    availability: "可分配",
    biography: "关注民间文化、乡土记忆与家族文献。姓名与机构为演示信息。",
  },
];
const initialTasks: ReviewTask[] = [
  {
    id: "TASK-001",
    submissionId: initialSubmissions[2]!.id,
    expertId: "EXP-003",
    region: "四川省",
    stage: "文史专家评审",
    assignedAt: "2026-09-20",
    dueAt: "2026-09-23",
    status: "待评分",
  },
  {
    id: "TASK-002",
    submissionId: initialSubmissions[4]!.id,
    expertId: "EXP-005",
    region: "广东省",
    stage: "文史专家评审",
    assignedAt: "2026-09-19",
    dueAt: "2026-09-20",
    status: "待评分",
  },
  {
    id: "TASK-003",
    submissionId: initialSubmissions[8]!.id,
    expertId: "EXP-002",
    region: "江苏省",
    stage: "文史专家评审",
    assignedAt: "2026-09-19",
    dueAt: "2026-09-24",
    status: "待评分",
  },
  {
    id: "TASK-004",
    submissionId: initialSubmissions[10]!.id,
    expertId: "EXP-003",
    region: "浙江省",
    stage: "文史专家评审",
    assignedAt: "2026-09-18",
    dueAt: "2026-09-22",
    status: "待评分",
  },
  {
    id: "TASK-005",
    submissionId: initialSubmissions[6]!.id,
    expertId: "EXP-001",
    region: "北京市",
    stage: "文史专家评审",
    assignedAt: "2026-09-17",
    dueAt: "2026-09-20",
    status: "已完成",
    scores: [27, 26, 22, 13],
    comment:
      "叙事完整，家庭记忆与文化传承结合自然，建议进入下一轮讨论。此为示例评语。",
    completedAt: "2026-09-20",
  },
];

export const reviewState = reactive({
  submissions: initialSubmissions,
  experts: initialExperts,
  tasks: initialTasks,
});
const fail = (message: string): ActionResult => ({ ok: false, message });
const success = (message: string): ActionResult => ({ ok: true, message });
const timestamp = () => new Date().toLocaleString("zh-CN", { hour12: false });
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function addHistory(submission: Submission, title: string, detail: string) {
  submission.history.push({ time: timestamp(), title, detail });
  recordActivity(title, submission.title);
}

export function approveSubmission(id: string): ActionResult {
  const submission = reviewState.submissions.find((item) => item.id === id);
  if (!submission || submission.status !== "待初审")
    return fail("仅待初审稿件可以通过初审。");
  submission.status = "评审中";
  addHistory(
    submission,
    "初审通过",
    "已转入评审中，可分配专家任务；未发布公示。",
  );
  return success("初审已通过，请分配评审专家。");
}
export function batchApproveSubmissions(ids: string[]): ActionResult {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return fail("请先选择待初审稿件。");
  if (
    uniqueIds.some(
      (id) =>
        reviewState.submissions.find((item) => item.id === id)?.status !==
        "待初审",
    )
  )
    return fail("所选稿件中包含非待初审状态，请重新选择。");
  uniqueIds.forEach((id) => approveSubmission(id));
  return success(`已通过 ${uniqueIds.length} 篇稿件的初审，请继续分配专家。`);
}
export function returnSubmission(id: string, reason: string): ActionResult {
  const submission = reviewState.submissions.find((item) => item.id === id);
  if (!submission || submission.status !== "待初审")
    return fail("仅待初审稿件可以退回修改。");
  if (reason.trim().length < 5 || reason.trim().length > 500)
    return fail("请填写 5–500 字的退回理由。");
  submission.status = "退回修改";
  addHistory(submission, "退回修改", reason.trim());
  return success("已在本次演示中退回修改。");
}
export function assignReview(
  submissionId: string,
  expertId: string,
  dueAt: string,
): ActionResult {
  const submission = reviewState.submissions.find(
    (item) => item.id === submissionId,
  );
  const expert = reviewState.experts.find((item) => item.id === expertId);
  if (!submission || submission.status !== "评审中")
    return fail("请先通过初审，再分配专家。");
  if (!expert || expert.availability !== "可分配")
    return fail("请选择可接收任务的专家。");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dueAt) ||
    dateKey(new Date(`${dueAt}T00:00:00`)) !== dueAt
  )
    return fail("请选择有效的截止日期。");
  if (dueAt < dateKey(new Date())) return fail("截止日期不能早于今天。");
  if (
    reviewState.tasks.some(
      (task) =>
        task.submissionId === submissionId && task.expertId === expertId,
    )
  )
    return fail("该专家已分配此稿件，请勿重复分配。");
  reviewState.tasks.push({
    id: `TASK-${Date.now()}-${reviewState.tasks.length}`,
    submissionId,
    expertId,
    region: submission.region,
    stage: "文史专家评审",
    assignedAt: timestamp(),
    dueAt,
    status: "待评分",
  });
  addHistory(
    submission,
    "分配评审任务",
    `专家：${expert.name}；截止：${dueAt}。`,
  );
  return success("示例评审任务已分配。");
}
export function submitReview(
  taskId: string,
  scores: number[],
  comment: string,
): ActionResult {
  const task = reviewState.tasks.find((item) => item.id === taskId);
  if (!task || task.status !== "待评分")
    return fail("任务已完成或不存在，请勿重复提交。");
  if (
    scores.length !== scoringDimensions.length ||
    scores.some(
      (score, index) =>
        !Number.isFinite(score) ||
        score < 0 ||
        score > scoringDimensions[index]!.max,
    )
  )
    return fail("请为每项填写规定范围内的评分。");
  if (comment.trim().length < 10 || comment.trim().length > 1000)
    return fail("请填写 10–1000 字的评审意见。");
  task.scores = [...scores];
  task.comment = comment.trim();
  task.status = "已完成";
  task.completedAt = timestamp();
  const submission = reviewState.submissions.find(
    (item) => item.id === task.submissionId,
  );
  if (submission)
    addHistory(
      submission,
      "专家完成评分",
      `总分 ${scores.reduce((sum, score) => sum + score, 0)} 分；等待评审管理后续处理。`,
    );
  return success("评分已记录到本次演示，作品不会自动入围或公示。");
}
export function updateExpert(
  id: string,
  group: string,
  availability: Expert["availability"],
): ActionResult {
  const expert = reviewState.experts.find((item) => item.id === id);
  if (
    !expert ||
    !expertGroups.includes(group) ||
    !["可分配", "暂不接单"].includes(availability)
  )
    return fail("请填写有效的专家分组与接单状态。");
  expert.group = group;
  expert.availability = availability;
  recordActivity("更新专家档案", expert.name);
  return success("专家分组与接单状态已更新。");
}

export const reviewFlow = reactive({
  name: "2026 家风作品征集 · 讨论方案",
  blind: true,
  deadlineDays: 7,
  stages: [
    { name: "区县初审", owner: "区域运营", enabled: true },
    { name: "市级行业复审", owner: "行业评审组", enabled: true },
    { name: "文史专家评审", owner: "评审专家", enabled: true },
    { name: "专项终审", owner: "专项评审组", enabled: true },
    { name: "国家级复核", owner: "全国运营", enabled: true },
    { name: "全国标准审定", owner: "审定工作组", enabled: true },
  ],
});

export function configureReviewFlow(input: {
  blind: boolean;
  deadlineDays: number;
  enabled: boolean[];
}): ActionResult {
  if (
    !Number.isInteger(input.deadlineDays) ||
    input.deadlineDays < 1 ||
    input.deadlineDays > 90
  )
    return fail("评审时限需为 1–90 天的整数。");
  if (
    input.enabled.length !== reviewFlow.stages.length ||
    !input.enabled.some(Boolean)
  )
    return fail("请至少保留一个流程节点。");
  reviewFlow.blind = input.blind;
  reviewFlow.deadlineDays = input.deadlineDays;
  reviewFlow.stages.forEach((stage, index) => {
    stage.enabled = !!input.enabled[index];
  });
  recordActivity("调整评审讨论方案", reviewFlow.name);
  return success("讨论方案已更新，仅影响示意图与本页匿名展示。");
}
