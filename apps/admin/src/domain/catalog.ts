import { reactive } from "vue";

export type CatalogKind = "banners" | "mediaItems" | "venues" | "hallPeople";
export type CatalogSection = CatalogKind | "homepage" | "supportTickets";
export interface CatalogItem {
  id: string;
  title: string;
  region: string;
  language: "zh" | "en";
  status: string;
  sortOrder: number;
  sample: boolean;
  lockVersion: number;
  [key: string]: any;
}
export interface SupportTicket {
  id: string;
  subject: string;
  body: string;
  category: string;
  authorName: string;
  region: string;
  status: string;
  reply?: string;
  createdAt: string;
  lockVersion: number;
  [key: string]: any;
}
export const catalogState = reactive({
  banners: [] as CatalogItem[],
  mediaItems: [] as CatalogItem[],
  venues: [] as CatalogItem[],
  hallPeople: [] as CatalogItem[],
  supportTickets: [] as SupportTicket[],
});
export const sectionLabels: Record<string, string> = {
  entries: "服务入口",
  topics: "家风专区",
  news: "资讯动态",
  works: "公开作品",
  venues: "传习阵地",
  stats: "参与统计",
};
export const homepageConfig = reactive({
  sections: [] as { id: string; enabled: boolean; order: number }[],
  lockVersion: undefined as number | undefined,
});
export interface CatalogField {
  name: string;
  label: string;
  type?: "textarea" | "number" | "select" | "date" | "asset" | "target";
  required?: boolean;
  options?: Record<string, string>;
  hint?: string;
  max?: number;
  media?: boolean;
}
export const catalogDefinitions: Record<
  CatalogKind,
  {
    title: string;
    singular: string;
    save: string;
    publish: string;
    defaults: Record<string, unknown>;
    fields: CatalogField[];
  }
> = {
  banners: {
    title: "首页轮播",
    singular: "轮播",
    save: "saveBanner",
    publish: "setBannerStatus",
    defaults: {
      category: "contribution",
      targetScreen: "submit",
      targetId: "",
      coverFileId: "",
      startsAt: "",
      endsAt: "",
    },
    fields: [
      {
        name: "category",
        label: "轮播分类",
        type: "select",
        required: true,
        options: {
          policy: "全国政策通知",
          contribution: "征稿公告",
          celebration: "年度盛典",
          collection: "典籍首发",
          study: "研学活动",
          integrity: "廉政课堂",
        },
      },
      { name: "subtitle", label: "副标题", max: 200 },
      { name: "description", label: "展示说明", type: "textarea", max: 2000 },
      { name: "actionLabel", label: "按钮文字", max: 50 },
      { name: "footnote", label: "补充说明", max: 200 },
      { name: "coverFileId", label: "封面图片", type: "asset" },
      {
        name: "targetScreen",
        label: "打开页面",
        type: "select",
        required: true,
        options: {
          news: "资讯",
          submit: "投稿",
          library: "典籍",
          learning: "传习活动",
          classroom: "课程",
          media: "媒体展播",
          hall: "名人馆",
          venues: "传习阵地",
          review: "评审公示",
        },
      },
      {
        name: "targetId",
        label: "关联内容",
        type: "target",
        hint: "可不关联具体内容，直接打开所选页面。发布时会检查关联内容的公开状态和地区范围。",
      },
      {
        name: "startsAt",
        label: "展示开始时间",
        type: "date",
        hint: "不填写表示不限制开始时间；保存草稿不会自动发布。",
      },
      { name: "endsAt", label: "展示结束时间", type: "date" },
    ],
  },
  mediaItems: {
    title: "媒体与素材",
    singular: "媒体",
    save: "saveMedia",
    publish: "setMediaStatus",
    defaults: {
      category: "letter",
      type: "short",
      sourceFileId: "",
      posterFileId: "",
      duration: "",
      transcript: "",
    },
    fields: [
      {
        name: "category",
        label: "内容分类",
        type: "select",
        required: true,
        options: {
          letter: "家书故事",
          documentary: "家风纪实",
          lecture: "家风讲堂",
          recitation: "诵读",
        },
      },
      {
        name: "type",
        label: "媒体形式",
        type: "select",
        required: true,
        options: { short: "短视频", replay: "回放", audio: "音频" },
      },
      { name: "collection", label: "所属合集", max: 100 },
      { name: "excerpt", label: "内容简介", type: "textarea", max: 1000 },
      {
        name: "duration",
        label: "时长说明",
        max: 30,
        hint: "例如 03:25，填写实际文件时长。",
      },
      {
        name: "sourceFileId",
        label: "媒体文件",
        type: "asset",
        media: true,
        hint: "发布前需上传 MP4 视频或 MP3/WAV 音频；最大50MiB。",
      },
      { name: "posterFileId", label: "封面图片", type: "asset" },
      { name: "transcript", label: "字幕 / 文字稿", type: "textarea", max: 50000 },
    ],
  },
  venues: {
    title: "传习阵地",
    singular: "阵地",
    save: "saveVenue",
    publish: "setVenueStatus",
    defaults: {
      category: "practice",
      activityId: "",
      latitude: "",
      longitude: "",
      highlights: "",
      stops: "",
    },
    fields: [
      {
        name: "category",
        label: "阵地类型",
        type: "select",
        required: true,
        options: {
          hall: "宗祠 / 名人馆",
          practice: "文明实践中心",
          integrity: "廉政教育基地",
        },
      },
      { name: "city", label: "所在城市", required: true, max: 100 },
      { name: "address", label: "地址", required: true, max: 300 },
      { name: "hours", label: "开放时间", max: 200 },
      {
        name: "description",
        label: "阵地介绍",
        type: "textarea",
        required: true,
        max: 5000,
      },
      {
        name: "highlights",
        label: "参观亮点",
        type: "textarea",
        hint: "每行一项。",
        max: 5000,
      },
      {
        name: "stops",
        label: "参观路线",
        type: "textarea",
        hint: "每行一个参观点。",
        max: 5000,
      },
      {
        name: "activityId",
        label: "预约关联活动",
        type: "target",
        hint: "选择已发布活动，用户可进入该活动报名。",
      },
      {
        name: "latitude",
        label: "纬度",
        hint: "选填，范围 -90 至 90。经纬度需同时填写。",
      },
      {
        name: "longitude",
        label: "经度",
        hint: "选填，范围 -180 至 180。虚构场景不会打开真实导航。",
      },
      { name: "contact", label: "公开联系说明", max: 300 },
      { name: "visitorNotice", label: "参观须知", type: "textarea", max: 5000 },
    ],
  },
  hallPeople: {
    title: "名人馆档案",
    singular: "人物档案",
    save: "saveHallPerson",
    publish: "setHallPersonStatus",
    defaults: { notes: "", sourceUrl: "", panoramaUrl: "" },
    fields: [
      { name: "era", label: "时代 / 年代", max: 100 },
      { name: "theme", label: "家风主题", required: true, max: 100 },
      { name: "book", label: "相关著作", max: 200 },
      { name: "quote", label: "引文 / 摘录", type: "textarea", max: 2000 },
      {
        name: "introduction",
        label: "人物介绍",
        type: "textarea",
        required: true,
        max: 20000,
      },
      {
        name: "notes",
        label: "阅读札记",
        type: "textarea",
        hint: "每行一项。",
        max: 10000,
      },
      { name: "sourceTitle", label: "资料来源说明", required: true, max: 500 },
      { name: "sourceUrl", label: "来源链接", hint: "选填，仅支持 HTTPS。" },
      {
        name: "panoramaUrl",
        label: "已取得使用许可的全景链接",
        hint: "选填，仅支持 HTTPS；留空时只展示普通档案，不表示已有全景。",
      },
    ],
  },
};

export function newCatalogDraft(
  kind: CatalogKind,
  region: string,
): Record<string, any> {
  const fields = Object.fromEntries(
    catalogDefinitions[kind].fields.map((field) => [field.name, ""]),
  );
  return {
    ...fields,
    title: "",
    language: "zh",
    region,
    sortOrder: 0,
    sample: false,
    ...catalogDefinitions[kind].defaults,
  };
}
export function catalogPayload(kind: CatalogKind, form: Record<string, any>) {
  const names = [
    "title",
    "language",
    "region",
    "sortOrder",
    "sample",
    ...catalogDefinitions[kind].fields.map((field) => field.name),
  ];
  const data: Record<string, unknown> = Object.fromEntries(
    names.map((key) => [key, form[key] ?? ""]),
  );
  data.sortOrder = Number(data.sortOrder);
  for (const name of ["startsAt", "endsAt"])
    if (data[name]) data[name] = new Date(String(data[name])).toISOString();
  for (const name of ["latitude", "longitude"])
    if (names.includes(name))
      data[name] = form[name] === "" || form[name] == null ? null : Number(form[name]);
  return data;
}
export function validateCatalog(kind: CatalogKind, form: Record<string, any>) {
  if (String(form.title || "").trim().length < 2) return "标题至少填写2个字。";
  if (!["zh", "en"].includes(form.language)) return "请选择内容语言。";
  if (
    !Number.isInteger(Number(form.sortOrder)) ||
    Number(form.sortOrder) < 0 ||
    Number(form.sortOrder) > 9999
  )
    return "排序请输入0至9999的整数。";
  for (const field of catalogDefinitions[kind].fields) {
    if (field.required && !String(form[field.name] || "").trim())
      return `请填写${field.label}。`;
  }
  for (const name of ["sourceUrl", "panoramaUrl"]) {
    if (!form[name]) continue;
    try {
      if (new URL(form[name]).protocol !== "https:")
        return "来源和全景链接仅支持HTTPS。";
    } catch {
      return "请填写有效的HTTPS链接。";
    }
  }
  const hasLat = form.latitude !== "" && form.latitude != null;
  const hasLng = form.longitude !== "" && form.longitude != null;
  if (
    kind === "venues" &&
    (hasLat !== hasLng ||
      (hasLat &&
        (!Number.isFinite(Number(form.latitude)) ||
          Math.abs(Number(form.latitude)) > 90 ||
          !Number.isFinite(Number(form.longitude)) ||
          Math.abs(Number(form.longitude)) > 180)))
  )
    return "请同时填写有效的经纬度，或将两项都留空。";
  if (
    form.startsAt &&
    form.endsAt &&
    Date.parse(form.endsAt) <= Date.parse(form.startsAt)
  )
    return "展示结束时间须晚于开始时间。";
  return "";
}
