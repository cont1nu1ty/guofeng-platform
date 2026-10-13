import { reactive } from "vue";
import { recordActivity, regions as workspaceRegions } from "./workspace";
import { isHttpMode } from "../services/mode";
import { demoRegionNames } from "./regions";

export const regions = isHttpMode ? workspaceRegions : demoRegionNames;
export const staffRoles = [
  "内容运营",
  "评审管理",
  "区域运营",
  "数据运营",
  "专家",
  "投稿用户",
];
export interface DemoUser {
  id: string;
  name: string;
  organization: string;
  region: string;
  roles: string[];
  enabled: boolean;
  joined: string;
  avatar: string;
  status: string;
}
export const demoUsers = reactive<DemoUser[]>([
  {
    id: "U202601",
    name: "林知秋",
    organization: "杭州西湖家风文化中心",
    region: "浙江省",
    roles: ["区域运营", "内容运营"],
    enabled: true,
    joined: "2026-09-18",
    avatar: "林",
    status: "已入驻",
  },
  {
    id: "U202602",
    name: "陈明远",
    organization: "北京市家庭文化研究会",
    region: "北京市",
    roles: ["专家"],
    enabled: true,
    joined: "2026-09-16",
    avatar: "陈",
    status: "已入驻",
  },
  {
    id: "U202603",
    name: "徐青禾",
    organization: "南京青禾社区",
    region: "江苏省",
    roles: ["投稿用户"],
    enabled: true,
    joined: "2026-09-20",
    avatar: "徐",
    status: "已入驻",
  },
  {
    id: "U202604",
    name: "周文清",
    organization: "成都市文化志愿者协会",
    region: "四川省",
    roles: ["区域运营"],
    enabled: true,
    joined: "2026-09-17",
    avatar: "周",
    status: "已入驻",
  },
  {
    id: "U202605",
    name: "叶书宁",
    organization: "广州市传习教育中心",
    region: "广东省",
    roles: ["内容运营"],
    enabled: false,
    joined: "2026-09-15",
    avatar: "叶",
    status: "已入驻",
  },
  {
    id: "U202606",
    name: "沈若兰",
    organization: "浙江家风研习小组",
    region: "浙江省",
    roles: ["专家"],
    enabled: true,
    joined: "2026-09-21",
    avatar: "沈",
    status: "待审核",
  },
  {
    id: "U202607",
    name: "陆知行",
    organization: "全国项目运营组",
    region: "北京市",
    roles: ["评审管理", "数据运营"],
    enabled: true,
    joined: "2026-09-12",
    avatar: "陆",
    status: "已入驻",
  },
]);
export function saveUserRoles(id: string, roles: string[]) {
  const user = demoUsers.find((item) => item.id === id);
  if (
    !user ||
    !roles.length ||
    roles.some((role) => !staffRoles.includes(role))
  )
    return { ok: false, message: "请至少选择一个有效岗位" };
  user.roles = [...roles];
  recordActivity("调整示例岗位", user.name);
  return { ok: true, message: "示例岗位已更新，仅在本次会话有效" };
}
export function toggleUser(id: string) {
  const user = demoUsers.find((item) => item.id === id);
  if (!user) return;
  user.enabled = !user.enabled;
  recordActivity(user.enabled ? "启用示例账号" : "停用示例账号", user.name);
}
export function approveUser(id: string) {
  const user = demoUsers.find((item) => item.id === id);
  if (!user || user.status !== "待审核") return;
  user.status = "已入驻";
  recordActivity("通过示例入驻审核", user.name);
}

export interface Product {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  stock: number;
  status: string;
  color: string;
  glyph: string;
  quota: number;
}
export const products = reactive<Product[]>([
  {
    id: "P001",
    title: "家风传习手册",
    subtitle: "以家为课堂，让美德成为日常",
    category: "公益文创",
    stock: 860,
    status: "上架中",
    color: "#a44136",
    glyph: "家",
    quota: 100,
  },
  {
    id: "P002",
    title: "清廉家书笔记本",
    subtitle: "一纸家书，写下清风正气",
    category: "公益文创",
    stock: 420,
    status: "上架中",
    color: "#5c766b",
    glyph: "廉",
    quota: 80,
  },
  {
    id: "P003",
    title: "四时家训书签礼盒",
    subtitle: "把家训收藏在每一次阅读里",
    category: "定制文创",
    stock: 180,
    status: "上架中",
    color: "#ae8c52",
    glyph: "礼",
    quota: 50,
  },
  {
    id: "P004",
    title: "百家风华典藏套装",
    subtitle: "经典家训与当代家风的相遇",
    category: "定制文创",
    stock: 35,
    status: "已下架",
    color: "#526779",
    glyph: "典",
    quota: 20,
  },
]);
export interface WelfareClaim {
  id: string;
  organization: string;
  region: string;
  productId: string;
  quantity: number;
  purpose: string;
  date: string;
  status: string;
  note: string;
}
export const welfareClaims = reactive<WelfareClaim[]>([
  {
    id: "GY2026092101",
    organization: "杭州市晴川小学",
    region: "浙江省",
    productId: "P001",
    quantity: 60,
    purpose: "用于六年级家风主题阅读活动，每个班级设置共读角。",
    date: "2026-09-21",
    status: "待审核",
    note: "",
  },
  {
    id: "GY2026092002",
    organization: "南京青禾社区",
    region: "江苏省",
    productId: "P002",
    quantity: 40,
    purpose: "社区清廉家书亲子共写活动。",
    date: "2026-09-20",
    status: "待审核",
    note: "",
  },
  {
    id: "GY2026091903",
    organization: "成都青羊传习中心",
    region: "四川省",
    productId: "P001",
    quantity: 80,
    purpose: "基层文化志愿者家风宣讲。",
    date: "2026-09-19",
    status: "待发放",
    note: "示例审核通过，等待发放。",
  },
  {
    id: "GY2026091804",
    organization: "北京春和社区",
    region: "北京市",
    productId: "P002",
    quantity: 30,
    purpose: "社区清廉课堂常态化阅读。",
    date: "2026-09-18",
    status: "已发放",
    note: "预置发放台账样例，不代表实际物流。",
  },
  {
    id: "GY2026091805",
    organization: "广州文华书院",
    region: "广东省",
    productId: "P001",
    quantity: 50,
    purpose: "家风教育公开课活动。",
    date: "2026-09-18",
    status: "已退回",
    note: "请补充活动安排与实际参与人数。",
  },
]);
export function productTitle(id: string) {
  return products.find((item) => item.id === id)?.title ?? id;
}
export function saveProduct(id: string, stock: number, quota: number) {
  const item = products.find((product) => product.id === id);
  if (
    !item ||
    !Number.isInteger(stock) ||
    stock < 0 ||
    !Number.isInteger(quota) ||
    quota < 1
  )
    return { ok: false, message: "库存须为非负整数，单次额度须为正整数" };
  item.stock = stock;
  item.quota = quota;
  recordActivity("调整示例库存与额度", item.title);
  return { ok: true, message: "库存与额度已在本次会话更新" };
}
export function toggleProduct(id: string) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  product.status = product.status === "上架中" ? "已下架" : "上架中";
  recordActivity("调整示例商品状态", product.title);
}
export function processClaim(
  id: string,
  action: "approve" | "return" | "deliver",
  note = "",
) {
  const item = welfareClaims.find((claim) => claim.id === id);
  if (!item) return { ok: false, message: "未找到该申领记录" };
  const product = products.find((product) => product.id === item.productId);
  if (!product) return { ok: false, message: "未找到对应商品" };
  if (action === "deliver") {
    if (item.status !== "待发放")
      return { ok: false, message: "只能处理待发放申领" };
    if (product.stock < item.quantity)
      return { ok: false, message: "示例库存不足，请先调整库存" };
    product.stock -= item.quantity;
    item.status = "已发放";
    item.note = "本次会话模拟发放，已同步扣减示例库存，无实际配送。";
  } else {
    if (item.status !== "待审核") return { ok: false, message: "该申领已处理" };
    if (action === "return" && note.trim().length < 5)
      return { ok: false, message: "请填写至少 5 个字的退回说明" };
    if (action === "approve" && item.quantity > product.quota)
      return {
        ok: false,
        message: "申领数量超过当前单次额度，请核对额度后处理",
      };
    item.status = action === "approve" ? "待发放" : "已退回";
    item.note = action === "approve" ? "示例审核通过，等待发放。" : note.trim();
  }
  recordActivity(
    action === "deliver"
      ? "模拟公益发放"
      : action === "approve"
        ? "通过示例公益申领"
        : "退回示例公益申领",
    item.organization,
  );
  return {
    ok: true,
    message:
      action === "deliver"
        ? "示例发放完成，库存与台账已同步"
        : "示例申领状态已更新",
  };
}

export interface Course {
  id: string;
  title: string;
  category: string;
  duration: number;
  chapters: number;
  status: string;
  description: string;
  teacher: string;
}
export const courses = reactive<Course[]>([
  {
    id: "KC001",
    title: "一封家书里的清廉底色",
    category: "清廉家风",
    duration: 35,
    chapters: 4,
    status: "已上架",
    description: "从家书中认识清廉家风，讨论家庭生活中的自律与责任。",
    teacher: "家风教研组",
  },
  {
    id: "KC002",
    title: "新时代家风与基层治理",
    category: "主题教育",
    duration: 50,
    chapters: 6,
    status: "已上架",
    description: "以原创社区案例，探讨家庭美德如何融入日常基层工作。",
    teacher: "基层文化教研组",
  },
  {
    id: "KC003",
    title: "红色家风的代际传承",
    category: "红色家风",
    duration: 45,
    chapters: 5,
    status: "已上架",
    description: "课程结构样例，正式史料与授课素材上线前需审校。",
    teacher: "家风教研组",
  },
  {
    id: "KC004",
    title: "廉洁从家出发",
    category: "清廉家风",
    duration: 25,
    chapters: 3,
    status: "草稿",
    description: "围绕家庭生活情境，设计讨论和反思练习。",
    teacher: "家风教研组",
  },
]);
export interface LearningGroup {
  id: string;
  name: string;
  region: string;
  members: number;
  courseId: string;
  completed: number;
  declarations: number;
  date: string;
}
export const learningGroups = reactive<LearningGroup[]>([
  {
    id: "XZ001",
    name: "西湖区文化工作学习组",
    region: "浙江省",
    members: 42,
    courseId: "KC001",
    completed: 32,
    declarations: 28,
    date: "2026-09-20",
  },
  {
    id: "XZ002",
    name: "春和街道青年学习组",
    region: "北京市",
    members: 36,
    courseId: "KC002",
    completed: 25,
    declarations: 22,
    date: "2026-09-19",
  },
  {
    id: "XZ003",
    name: "青羊区家风研习班",
    region: "四川省",
    members: 56,
    courseId: "KC003",
    completed: 41,
    declarations: 35,
    date: "2026-09-20",
  },
  {
    id: "XZ004",
    name: "南京清风学堂",
    region: "江苏省",
    members: 48,
    courseId: "KC001",
    completed: 40,
    declarations: 38,
    date: "2026-09-18",
  },
  {
    id: "XZ005",
    name: "越秀街道传习小组",
    region: "广东省",
    members: 30,
    courseId: "KC002",
    completed: 18,
    declarations: 15,
    date: "2026-09-20",
  },
]);
export function saveCourse(
  input: Omit<Course, "id" | "status"> & { id?: string },
) {
  if (
    input.title.trim().length < 4 ||
    !input.category ||
    !input.teacher.trim() ||
    input.description.trim().length < 10
  )
    return {
      ok: false,
      message: "请补全课程信息：标题至少 4 字，简介至少 10 字",
    };
  if (
    !Number.isInteger(input.duration) ||
    input.duration < 1 ||
    input.duration > 300 ||
    !Number.isInteger(input.chapters) ||
    input.chapters < 1 ||
    input.chapters > 50
  )
    return {
      ok: false,
      message: "课程时长须为 1–300 分钟，章节须为 1–50 的整数",
    };
  const existing = courses.find((item) => item.id === input.id);
  const values = {
    ...input,
    title: input.title.trim(),
    teacher: input.teacher.trim(),
    description: input.description.trim(),
  };
  if (existing) Object.assign(existing, values);
  else courses.unshift({ ...values, id: `KC${Date.now()}`, status: "草稿" });
  recordActivity(existing ? "编辑示例课程" : "新建示例课程草稿", input.title);
  return { ok: true, message: "课程信息已保存至本次会话" };
}
export function toggleCourse(id: string) {
  const course = courses.find((item) => item.id === id);
  if (!course) return;
  course.status = course.status === "已上架" ? "已下架" : "已上架";
  recordActivity("调整示例课程状态", course.title);
}

export interface KnowledgeBase {
  id: string;
  title: string;
  category: string;
  documents: number;
  version: string;
  updated: string;
  status: string;
  description: string;
  lockVersion?: number;
  fileId?: string;
  audience?: "public" | "staff";
  language?: "zh" | "en";
  indexStatus?: string;
}
export const knowledgeBases = reactive<KnowledgeBase[]>([
  {
    id: "KB01",
    title: "家风典籍资料集",
    category: "典籍文献",
    documents: 128,
    version: "v0.3",
    updated: "2026-09-19",
    status: "结构样例",
    description:
      "古今家训、家书与经典篇章。展示资料分类、版本与授权字段，尚未接入真实文档或检索索引。",
  },
  {
    id: "KB02",
    title: "红色家风史料集",
    category: "红色史料",
    documents: 64,
    version: "v0.2",
    updated: "2026-09-18",
    status: "待审校样例",
    description:
      "史料元数据与引文审校结构样例。正式来源、使用范围与授权记录需逐项确认。",
  },
  {
    id: "KB03",
    title: "平台政策与服务问答",
    category: "平台知识",
    documents: 36,
    version: "v0.5",
    updated: "2026-09-21",
    status: "结构样例",
    description:
      "投稿须知、活动规则与常见问题。此处的数量和版本为预置演示数据。",
  },
]);
export interface AiRecord {
  id: string;
  user: string;
  region: string;
  mode: string;
  time: string;
  status: string;
  input: string;
  output: string;
  source: string;
}
export const aiRecords = reactive<AiRecord[]>([
  {
    id: "AI20260921001",
    user: "演示用户 01",
    region: "浙江省",
    mode: "家书创作",
    time: "2026-09-21 10:24",
    status: "预置样例",
    input: "想给孩子写一封家书，谈谈诚实与担当。",
    output:
      "孩子，成长不仅是学会更多知识，也是认真对待每一次承诺。愿你诚实面对自己，也温柔对待身边的人。",
    source: "原创固定文案 · 无模型版本",
  },
  {
    id: "AI20260921002",
    user: "演示用户 02",
    region: "北京市",
    mode: "知识问答",
    time: "2026-09-21 10:16",
    status: "预置样例",
    input: "如何在日常生活中传承家风？",
    output:
      "可以从家庭共读、记录长辈故事、共同约定家务和邻里互助等小事开始。此内容为预置回答样例。",
    source: "原创知识卡 JF-003 · 无检索调用",
  },
  {
    id: "AI20260921003",
    user: "演示用户 03",
    region: "四川省",
    mode: "文稿审核",
    time: "2026-09-21 09:52",
    status: "待人工复核样例",
    input: "这篇文章包含家庭成员的完整联系方式，是否可以公开？",
    output:
      "请人工核对是否包含个人信息、是否获得当事人同意，以及公开展示的必要性。这不是实际审核结果。",
    source: "原创审核卡 SH-002 · 无模型调用",
  },
  {
    id: "AI20260921004",
    user: "演示用户 04",
    region: "江苏省",
    mode: "家训拟写",
    time: "2026-09-21 09:38",
    status: "预置样例",
    input: "围绕勤俭与友爱，拟一段家训。",
    output: "惜一粥一饭，守一诺一言；爱家中长幼，睦四邻乡亲。",
    source: "原创固定文案 · 无模型版本",
  },
  {
    id: "AI20260921005",
    user: "演示用户 05",
    region: "广东省",
    mode: "手稿校对",
    time: "2026-09-20 16:42",
    status: "预置样例",
    input: "查看手稿校对示例。",
    output: "原文样卡与手工校对文本并排呈现，未进行图像识别或 OCR。",
    source: "原创手稿文字样卡 · 无 OCR 调用",
  },
]);
export interface DictionaryWord {
  id: string;
  word: string;
  type: string;
  action: string;
  note: string;
  enabled: boolean;
}
export const dictionaryWords = reactive<DictionaryWord[]>([
  {
    id: "W01",
    word: "个人联系方式",
    type: "合规提醒",
    action: "人工复核",
    note: "提醒编辑核对个人信息展示范围",
    enabled: true,
  },
  {
    id: "W02",
    word: "未经授权转载",
    type: "合规提醒",
    action: "人工复核",
    note: "提示检查作品来源及使用许可",
    enabled: true,
  },
  {
    id: "W03",
    word: "测试屏蔽词",
    type: "屏蔽词",
    action: "拦截提示",
    note: "仅用于讨论屏蔽规则，不会执行实际拦截",
    enabled: true,
  },
]);
export function saveDictionaryWord(
  input: Omit<DictionaryWord, "id" | "enabled"> & { id?: string },
) {
  if (input.word.trim().length < 2 || !input.type || !input.action)
    return { ok: false, message: "词条至少 2 字，并选择分类与处理方式" };
  if (
    dictionaryWords.some(
      (item) => item.word === input.word.trim() && item.id !== input.id,
    )
  )
    return { ok: false, message: "此词条已存在，请直接编辑原词条" };
  const existing = dictionaryWords.find((item) => item.id === input.id);
  const values = { ...input, word: input.word.trim(), note: input.note.trim() };
  if (existing) Object.assign(existing, values);
  else
    dictionaryWords.unshift({ ...values, id: `W${Date.now()}`, enabled: true });
  recordActivity(existing ? "编辑示例词条" : "新增示例词条", input.word);
  return { ok: true, message: "词条配置已保存在本次会话，未执行实际审核" };
}
export function toggleDictionaryWord(id: string) {
  const word = dictionaryWords.find((item) => item.id === id);
  if (!word) return;
  word.enabled = !word.enabled;
  recordActivity("调整示例词条状态", word.word);
}
export interface PlatformConfig {
  name: string;
  subtitle: string;
  contact: string;
  language: string;
  regionLabel: string;
  reviewReminder: boolean;
  draftNotice: boolean;
  notice: string;
}
export const platformConfig = reactive<PlatformConfig>({
  name: "家风中华行",
  subtitle: "全国家风文化共建共享平台",
  contact: "平台运营服务台",
  language: "简体中文",
  regionLabel: "全国运营中心",
  reviewReminder: true,
  draftNotice: true,
  notice: "让好家风，成为时代的风景。",
});
export function savePlatformConfig(input: PlatformConfig) {
  if (
    input.name.trim().length < 2 ||
    !input.subtitle.trim() ||
    !input.contact.trim()
  )
    return { ok: false, message: "请填写平台名称、副标题和运营联系人" };
  Object.assign(platformConfig, input);
  recordActivity("保存平台配置样例", input.name);
  return { ok: true, message: "平台配置已保存至本次会话，刷新后恢复预置值" };
}
export interface NotificationDraft {
  status?: string;
  lockVersion?: number;
  id: string;
  title: string;
  audience: string;
  content: string;
  date: string;
}
export const notificationDrafts = reactive<NotificationDraft[]>([
  {
    id: "TZ001",
    title: "秋季家风征集活动提醒",
    audience: "区域运营",
    content: "请各区域运营同事核对征集页面和活动排期，完善本地参与指引。",
    date: "2026-09-21",
  },
  {
    id: "TZ002",
    title: "本周评审任务安排",
    audience: "评审专家",
    content: "请在任务窗口内查看分配稿件并确认可参与的评审时间。",
    date: "2026-09-20",
  },
]);
export function saveNotificationDraft(
  input: Omit<NotificationDraft, "id" | "date">,
) {
  if (
    input.title.trim().length < 4 ||
    input.content.trim().length < 10 ||
    !input.audience
  )
    return {
      ok: false,
      message: "请填写标题（至少 4 字）、接收人群和正文（至少 10 字）",
    };
  notificationDrafts.unshift({
    ...input,
    title: input.title.trim(),
    content: input.content.trim(),
    id: `TZ${Date.now()}`,
    date: new Date().toLocaleDateString("sv-SE"),
  });
  recordActivity("保存通知草稿", input.title);
  return { ok: true, message: "通知草稿已保存，仅供预览，未发送消息" };
}
