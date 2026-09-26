import { reactive } from "vue";
import { recordActivity, regions } from "./workspace";

export const editorialRegions = regions;
export const contentCategories = ["资讯", "公告", "政策解读", "行业动态", "活动报道", "榜样人物", "Banner", "专题"] as const;
export const contentTopics = { red: "红色家风", integrity: "清廉家风", everyday: "百姓家风", classical: "先贤文脉" } as const;
export type ContentCategory = (typeof contentCategories)[number];
export type PublishStatus = "草稿" | "已发布" | "已下架";
export interface ContentItem {
  id: string;
  title: string;
  category: ContentCategory;
  region: string;
  language: string;
  summary: string;
  body: string;
  status: PublishStatus;
  author: string;
  updatedAt: string;
  views: number;
  topic?: keyof typeof contentTopics;
}
export type ContentDraft = Pick<
  ContentItem,
  "title" | "category" | "region" | "language" | "summary" | "body" | "topic"
>;
export interface Chapter {
  id: string;
  title: string;
  author: string;
  body: string;
}
export interface CollectionItem {
  id: string;
  title: string;
  subtitle: string;
  region: string;
  theme: string;
  status: "编纂中" | "已入藏";
  chapters: Chapter[];
  updatedAt: string;
  color: string;
}
export type CollectionDraft = Pick<
  CollectionItem,
  "title" | "subtitle" | "region" | "theme"
>;
export type ActivityStatus = "草稿" | "报名中" | "进行中" | "已结束";
export interface Registration {
  id: string;
  name: string;
  institution: string;
  registeredAt: string;
  checkedIn: boolean;
}
export interface ActivityItem {
  id: string;
  title: string;
  type: string;
  region: string;
  location: string;
  startAt: string;
  endAt: string;
  capacity: number;
  summary: string;
  status: ActivityStatus;
  registrations: Registration[];
}
export type ActivityDraft = Pick<
  ActivityItem,
  | "title"
  | "type"
  | "region"
  | "location"
  | "startAt"
  | "endAt"
  | "capacity"
  | "summary"
>;
export const activityTypes = [
  "主题征文",
  "家风诵读",
  "文化研学",
  "家风宣讲",
  "年度盛典",
];

const contentSeed: Array<
  [string, ContentCategory, string, PublishStatus, string]
> = [
  [
    "让好家风走进千家万户",
    "资讯",
    "全国",
    "已发布",
    "从一封家书、一条家训出发，记录日常生活里的文化传承。",
  ],
  [
    "一封家书里的清廉传承",
    "资讯",
    "浙江省",
    "已发布",
    "清廉家风主题分享会的原创活动报道样例。",
  ],
  [
    "院落里的家风故事",
    "资讯",
    "北京市",
    "草稿",
    "走进社区，听三代人讲述关于勤俭与守信的家庭故事。",
  ],
  [
    "书香伴成长：亲子共读新实践",
    "资讯",
    "江苏省",
    "已发布",
    "以亲子共读为起点，探索家校社共同参与的家风文化活动。",
  ],
  [
    "2026 年秋季家风作品征集启事",
    "公告",
    "全国",
    "已发布",
    "面向各地家风文化爱好者，征集家书、散文与诗词作品。",
  ],
  [
    "国庆期间传习活动安排",
    "公告",
    "四川省",
    "草稿",
    "活动排期与报名方式的讨论稿，具体安排以正式公告为准。",
  ],
  [
    "书写家风 · 共续文脉",
    "Banner",
    "全国",
    "已发布",
    "首页秋季征集主题视觉与跳转文案样例。",
  ],
  [
    "家风传习 · 秋日研学",
    "Banner",
    "广东省",
    "已下架",
    "在行走中读懂家风，在体验中传承文化。",
  ],
  [
    "清风传家：清廉家书专题",
    "专题",
    "全国",
    "已发布",
    "从家书出发，读懂清廉与责任。",
  ],
  [
    "寻访先贤 · 岭南家训",
    "专题",
    "广东省",
    "草稿",
    "整理岭南地区先贤家训的编辑导读与阅读线索。",
  ],
];

const chapterSeeds = (prefix: string): Chapter[] => [
  {
    id: `${prefix}-1`,
    title: "序言 · 家是最小国",
    author: "编纂组（样例）",
    body: "家风藏在日常的一言一行之中。长辈的叮嘱、饭桌边的约定、写给远方的一封信，构成了我们共同的文化记忆。\n\n本篇为界面演示的原创导读，不是正式出版内容。",
  },
  {
    id: `${prefix}-2`,
    title: "第一章 · 以诚立家",
    author: "陈知远（示例署名）",
    body: "祖母常说，答应别人的事情，就要认真做到。这句朴素的话，成为我们一家人相处的约定。\n\n本篇为原创示例片段，可用于体验章节编排与阅读预览。",
  },
  {
    id: `${prefix}-3`,
    title: "第二章 · 勤俭有度",
    author: "林书禾（示例署名）",
    body: "父亲修补旧物时，总会让我们坐在旁边。留下来的不仅是一张桌子，更是爱惜物品、珍惜劳动的习惯。",
  },
];

const registrations = (
  prefix: string,
  count: number,
  checked = 0,
): Registration[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    name:
      [
        "林同学",
        "陈老师",
        "周同学",
        "王老师",
        "许同学",
        "李老师",
        "赵同学",
        "吴老师",
      ][index % 8]! + "（示例）",
    institution: ["春和社区", "文脉读书会", "和美学校"][index % 3]!,
    registeredAt: "2026-09-18 14:20",
    checkedIn: index < checked,
  }));

export const editorialState = reactive<{
  contents: ContentItem[];
  collections: CollectionItem[];
  activities: ActivityItem[];
}>({
  contents: contentSeed.map(
    ([title, category, region, status, summary], i) => ({
      id: `CMS-${1001 + i}`,
      title,
      category,
      region,
      status,
      summary,
      language: "简体中文",
      body: `${summary}\n\n家风中华行，让文化走入生活。我们希望通过身边的真实细节，发现家庭中的美好品质，连接不同地区的文化实践。\n\n本文为后台界面沟通使用的原创样例，发布操作只改变本次会话状态，不会对外发布。`,
      author: ["内容运营组", "区域编辑组", "专题策划组"][i % 3]!,
      updatedAt: `2026-09-${String(20 - (i % 7)).padStart(2, "0")} 10:30`,
      views:
        status === "已发布"
          ? [1286, 862, 0, 436, 2108, 0, 3240, 0, 985, 0][i]!
          : 0,
    }),
  ),
  collections: [
    {
      id: "BOOK-001",
      title: "家风大典",
      subtitle: "总典 · 文脉之源",
      region: "全国",
      theme: "家风传承",
      status: "已入藏",
      chapters: chapterSeeds("book1"),
      updatedAt: "2026-09-20",
      color: "#783c36",
    },
    {
      id: "BOOK-002",
      title: "江南家书",
      subtitle: "浙江卷 · 书信里的家国",
      region: "浙江省",
      theme: "清廉家书",
      status: "编纂中",
      chapters: chapterSeeds("book2"),
      updatedAt: "2026-09-19",
      color: "#4f665d",
    },
    {
      id: "BOOK-003",
      title: "蜀地家训",
      subtitle: "四川卷 · 诗书继世长",
      region: "四川省",
      theme: "先贤文脉",
      status: "编纂中",
      chapters: chapterSeeds("book3").slice(0, 2),
      updatedAt: "2026-09-18",
      color: "#756249",
    },
    {
      id: "BOOK-004",
      title: "岭南清风",
      subtitle: "广东卷 · 清风自南来",
      region: "广东省",
      theme: "清廉家风",
      status: "已入藏",
      chapters: chapterSeeds("book4"),
      updatedAt: "2026-09-16",
      color: "#57677a",
    },
  ],
  activities: [
    {
      id: "EVT-001",
      title: "把家风写进一封信",
      type: "主题征文",
      region: "全国",
      location: "线上征集",
      startAt: "2026-10-01 09:00",
      endAt: "2026-10-31 18:00",
      capacity: 500,
      summary: "以家书为载体，记录代际之间的理解与传承。面向各地家庭开放参与。",
      status: "报名中",
      registrations: registrations("r1", 8),
    },
    {
      id: "EVT-002",
      title: "书香里的家风 · 周末共读",
      type: "家风诵读",
      region: "北京市",
      location: "春和社区文化空间（示例场地）",
      startAt: "2026-09-21 09:30",
      endAt: "2026-09-21 17:00",
      capacity: 40,
      summary: "亲子共读家训，分享日常生活中值得珍藏的家庭记忆。",
      status: "进行中",
      registrations: registrations("r2", 6, 2),
    },
    {
      id: "EVT-003",
      title: "寻访江南 · 家风研学日",
      type: "文化研学",
      region: "浙江省",
      location: "文脉传习馆（示例场地）",
      startAt: "2026-10-05 09:00",
      endAt: "2026-10-05 16:00",
      capacity: 60,
      summary: "在街巷与书院间，寻找勤学、守信与清廉的文化线索。",
      status: "草稿",
      registrations: [],
    },
    {
      id: "EVT-004",
      title: "清风传家主题分享会",
      type: "家风宣讲",
      region: "四川省",
      location: "和美文化中心（示例场地）",
      startAt: "2026-09-15 14:00",
      endAt: "2026-09-15 17:00",
      capacity: 80,
      summary: "以身边的故事讲述家风，让清廉与责任成为共同的家庭约定。",
      status: "已结束",
      registrations: registrations("r4", 5, 5),
    },
  ],
});

let sequence = 100;
const createId = (prefix: string) => `${prefix}-${Date.now()}-${sequence++}`;
const timestamp = () => new Date().toLocaleString("sv-SE").slice(0, 16);
const required = (value: string, label: string, min = 1, max = 100) =>
  value.trim().length < min || value.trim().length > max
    ? `${label}请填写 ${min}–${max} 个字符`
    : "";

export function validateContent(draft: ContentDraft): string {
  return (
    required(draft.title, "标题", 2, 100) ||
    (!contentCategories.includes(draft.category) ? "请选择栏目" : "") ||
    (!editorialRegions.includes(draft.region) ? "请选择地区" : "") ||
    (!["简体中文", "中文", "英文", "English", "zh", "en"].includes(draft.language) ? "请选择语言" : "") ||
    (draft.topic && !(draft.topic in contentTopics) ? "请选择家风专区" : "") ||
    required(draft.summary, "摘要", 1, 500) ||
    required(draft.body, "正文", 1, 50000)
  );
}
export function saveContent(draft: ContentDraft, id?: string): ContentItem {
  const error = validateContent(draft);
  if (error) throw new Error(error);
  const existing = editorialState.contents.find((item) => item.id === id);
  const value = {
    ...draft,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    body: draft.body.trim(),
    updatedAt: timestamp(),
  };
  if (existing) {
    Object.assign(existing, value);
    recordActivity("编辑内容", existing.title);
    return existing;
  }
  const item: ContentItem = {
    ...value,
    id: createId("CMS"),
    status: "草稿",
    author: "当前编辑（演示）",
    views: 0,
  };
  editorialState.contents.unshift(item);
  recordActivity("新增内容草稿", item.title);
  return item;
}
export function setContentStatus(item: ContentItem, status: PublishStatus) {
  if (status === "已发布") {
    const error = validateContent(item);
    if (error) throw new Error(error);
  }
  item.status = status;
  item.updatedAt = timestamp();
  recordActivity(
    status === "已发布" ? "模拟发布内容" : "模拟下架内容",
    item.title,
  );
}
export function validateCollection(draft: CollectionDraft): string {
  return (
    required(draft.title, "卷名", 2, 30) ||
    required(draft.subtitle, "副标题", 2, 50) ||
    (!editorialRegions.includes(draft.region) ? "请选择地区" : "") ||
    required(draft.theme, "主题", 2, 20)
  );
}
export function saveCollection(
  draft: CollectionDraft,
  id?: string,
): CollectionItem {
  const error = validateCollection(draft);
  if (error) throw new Error(error);
  const existing = editorialState.collections.find((item) => item.id === id);
  const values = {
    ...draft,
    title: draft.title.trim(),
    subtitle: draft.subtitle.trim(),
    theme: draft.theme.trim(),
    updatedAt: timestamp().slice(0, 10),
  };
  if (existing) {
    Object.assign(existing, values);
    recordActivity("编辑典籍分卷", existing.title);
    return existing;
  }
  const item: CollectionItem = {
    ...values,
    id: createId("BOOK"),
    chapters: [],
    color: "#783c36",
    status: "编纂中",
  };
  editorialState.collections.unshift(item);
  recordActivity("创建典籍分卷", item.title);
  return item;
}
export function saveChapter(
  collection: CollectionItem,
  draft: Omit<Chapter, "id">,
  id?: string,
) {
  const error =
    required(draft.title, "章节名称", 2, 50) ||
    required(draft.author, "署名", 2, 40) ||
    required(draft.body, "章节正文", 10, 10000);
  if (error) throw new Error(error);
  const existing = collection.chapters.find((chapter) => chapter.id === id);
  const values = {
    title: draft.title.trim(),
    author: draft.author.trim(),
    body: draft.body.trim(),
  };
  if (existing) Object.assign(existing, values);
  else collection.chapters.push({ ...values, id: createId("CH") });
  collection.updatedAt = timestamp().slice(0, 10);
  collection.status = "编纂中";
  recordActivity("编辑典籍章节", collection.title);
}
export function moveChapter(
  collection: CollectionItem,
  index: number,
  direction: -1 | 1,
) {
  const target = index + direction;
  if (target < 0 || target >= collection.chapters.length) return;
  const [chapter] = collection.chapters.splice(index, 1);
  if (chapter) collection.chapters.splice(target, 0, chapter);
  collection.updatedAt = timestamp().slice(0, 10);
  collection.status = "编纂中";
  recordActivity("调整章节顺序", collection.title);
}
export function collectVolume(collection: CollectionItem) {
  if (!collection.chapters.length)
    throw new Error("请至少添加一个章节后再模拟入藏");
  collection.status = "已入藏";
  collection.updatedAt = timestamp().slice(0, 10);
  recordActivity("模拟典籍入藏", collection.title);
}
export function addSampleChapter(collection: CollectionItem) {
  const title = "第三章 · 一封写给未来的家书";
  if (collection.chapters.some((chapter) => chapter.title === title))
    throw new Error("本卷已加入此入选作品样例，可继续编辑或调整顺序");
  saveChapter(collection, {
    title,
    author: "何知夏（示例署名）",
    body: "亲爱的孩子：\n\n愿你走得再远，也记得饭桌上那些温暖的叮嘱。待人以诚，遇事有耐心，珍惜每一份平凡的劳动。\n\n这是一篇原创入选作品样例，添加到目录用于演示入藏编排，不代表正式评审结果或版权授权。",
  });
}
export function validateActivity(
  draft: ActivityDraft,
  existing?: ActivityItem,
): string {
  const basic =
    required(draft.title, "活动名称", 2, 60) ||
    (!activityTypes.includes(draft.type) ? "请选择活动类型" : "") ||
    (!editorialRegions.includes(draft.region) ? "请选择地区" : "") ||
    required(draft.location, "活动地点", 2, 100) ||
    required(draft.summary, "活动介绍", 10, 500);
  if (basic) return basic;
  if (
    !draft.startAt ||
    !draft.endAt ||
    !Number.isFinite(Date.parse(draft.startAt)) ||
    !Number.isFinite(Date.parse(draft.endAt))
  )
    return "请选择完整的开始和结束时间";
  if (Date.parse(draft.endAt) <= Date.parse(draft.startAt))
    return "结束时间必须晚于开始时间";
  if (
    !Number.isInteger(draft.capacity) ||
    draft.capacity < 1 ||
    draft.capacity > 100000
  )
    return "名额须为 1–100000 的整数";
  if (existing && draft.capacity < existing.registrations.length)
    return "活动名额不能少于当前示例报名人数";
  return "";
}
export function saveActivity(draft: ActivityDraft, id?: string): ActivityItem {
  const existing = editorialState.activities.find((item) => item.id === id);
  const error = validateActivity(draft, existing);
  if (error) throw new Error(error);
  const value = {
    ...draft,
    title: draft.title.trim(),
    location: draft.location.trim(),
    summary: draft.summary.trim(),
  };
  if (existing) {
    Object.assign(existing, value);
    recordActivity("编辑活动", existing.title);
    return existing;
  }
  const item: ActivityItem = {
    ...value,
    id: createId("EVT"),
    status: "草稿",
    registrations: [],
  };
  editorialState.activities.unshift(item);
  recordActivity("创建活动草稿", item.title);
  return item;
}
export function setActivityStatus(item: ActivityItem, status: ActivityStatus) {
  const allowed: Record<ActivityStatus, ActivityStatus[]> = {
    草稿: ["报名中"],
    报名中: ["进行中", "已结束"],
    进行中: ["已结束"],
    已结束: [],
  };
  if (!allowed[item.status].includes(status))
    throw new Error("当前活动状态不支持此操作");
  const error = validateActivity(item, item);
  if (error) throw new Error(error);
  item.status = status;
  recordActivity(
    `模拟活动${status === "报名中" ? "发布" : status === "进行中" ? "开始" : "结束"}`,
    item.title,
  );
}
export function toggleAttendance(
  item: ActivityItem,
  registration: Registration,
) {
  if (item.status !== "进行中")
    throw new Error("请先将活动设为进行中，再操作示例签到");
  registration.checkedIn = !registration.checkedIn;
  recordActivity(
    registration.checkedIn ? "模拟活动签到" : "撤销模拟签到",
    `${item.title} · ${registration.name}`,
  );
}
