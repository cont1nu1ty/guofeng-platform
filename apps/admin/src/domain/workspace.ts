import { reactive } from "vue";
import { isHttpMode } from "../services/mode";
import { allRegionNames, demoRegionNames } from "./regions";

export const regions = [
  "全国",
  ...(isHttpMode ? allRegionNames : demoRegionNames),
];
export const workspace = reactive({ region: "全国", sidebarOpen: false });
export const matchesRegion = (region: string) =>
  workspace.region === "全国" ||
  region === workspace.region ||
  region === "全国";
export interface ActivityEvent {
  id: string;
  action: string;
  target: string;
  time: string;
}
export const activityLog = reactive<ActivityEvent[]>([
  {
    id: "seed-1",
    action: "更新活动草稿",
    target: "秋日家书 · 亲子共读会",
    time: "09:42",
  },
  {
    id: "seed-2",
    action: "完成稿件初审",
    target: "一封写给未来的家书",
    time: "09:26",
  },
  {
    id: "seed-3",
    action: "调整专题排序",
    target: "清廉家风 · 一脉相承",
    time: "09:10",
  },
]);
let sequence = 0;
export function recordActivity(action: string, target: string) {
  activityLog.unshift({
    id: `session-${++sequence}`,
    action,
    target,
    time: new Date().toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
  if (activityLog.length > 100) activityLog.pop();
}

export const navGroups = [
  {
    label: "总览",
    items: [{ path: "/overview", title: "运营工作台", icon: "Odometer" }],
  },
  {
    label: "征集与评审",
    items: [
      { path: "/submissions", title: "投稿作品", icon: "Document" },
      { path: "/reviews", title: "评审中心", icon: "Checked" },
      { path: "/experts", title: "专家库", icon: "UserFilled" },
      { path: "/certificates", title: "证书签发", icon: "Document" },
    ],
  },
  {
    label: "内容与传习",
    items: [
      { path: "/content", title: "内容资讯", icon: "Reading" },
      { path: "/collections", title: "典籍编纂", icon: "Collection" },
      { path: "/resources", title: "授权资源", icon: "Reading" },
      { path: "/activities", title: "全国活动", icon: "Calendar" },
      { path: "/education", title: "廉政教育", icon: "School" },
      { path: "/welfare", title: "文创公益", icon: "Present" },
    ],
  },
  {
    label: "平台管理",
    items: [
      { path: "/users", title: "用户与权限", icon: "User" },
      { path: "/ai", title: "AI 运维", icon: "MagicStick" },
      { path: "/analytics", title: "数据智库", icon: "DataAnalysis" },
      { path: "/jobs", title: "导出与报告", icon: "Document" },
      { path: "/settings", title: "系统设置", icon: "Setting" },
    ],
  },
];
export const navigation = navGroups.flatMap((group) => group.items);
