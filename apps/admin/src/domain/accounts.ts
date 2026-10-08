export type ReviewStatus = "pending" | "approved" | "rejected" | "returned";
export interface AccountReview {
  id: string;
  subject: "account" | "expert";
  action: "submitted" | "approved" | "rejected" | "returned";
  actorName: string;
  summary: string;
  materialReference: string;
  createdAt: string;
}
export interface ManagedAccount {
  id: string;
  username: string;
  name: string;
  organization: string;
  roles: string[];
  roleLabels: string[];
  regionIds: string[];
  regionLabels: string[];
  enabled: boolean;
  accountReviewStatus: ReviewStatus;
  expertReviewStatus: ReviewStatus;
  legacyStatus: string;
  version: number;
  createdAt: string;
  reviews?: AccountReview[];
}
export interface AccountPage {
  items: ManagedAccount[];
  total: number;
  page: number;
  pageSize: number;
  roles: { key: string; label: string }[];
  permissions: string[];
}
export interface AccountFilters {
  query: string;
  role: string;
  region: string;
  status: string;
  page: number;
  pageSize: number;
}
export const accountReviewLabels: Record<ReviewStatus | "submitted", string> = {
  pending: "待人工审核",
  approved: "人工通过",
  rejected: "未通过",
  returned: "需补充",
  submitted: "资料已登记",
};
export type AccountAction = "create" | "roles" | "status" | "resetPassword" | "materials" | "review";
export type AccountFields = {
  username: string;
  name: string;
  organization: string;
  password: string;
  roles: string[];
  regionIds: string[];
  subject: "account" | "expert";
  result: "approved" | "rejected" | "returned";
  summary: string;
  materialReference: string;
};
export function emptyAccountFields(): AccountFields {
  return { username: "", name: "", organization: "", password: "", roles: ["member"], regionIds: [],
    subject: "account", result: "approved", summary: "", materialReference: "" };
}
export function accountFieldErrors(action: AccountAction, fields: AccountFields): Record<string, string> {
  const errors: Record<string, string> = {};
  if (action === "create") {
    if (!/^[a-z0-9][a-z0-9_.-]{2,29}$/i.test(fields.username.trim())) errors.username = "输入3至30位字母、数字、点、横线或下划线";
    if (!fields.name.trim() || fields.name.trim().length > 30) errors.name = "姓名须为1至30字";
    if (!fields.organization.trim() || fields.organization.trim().length > 120) errors.organization = "填写所属机构，最多120字";
    if (fields.roles.includes("expert")) errors.roles = "新账号请先登记和审核专家资料，再授予专家岗位";
  }
  if (action === "create" || action === "roles") {
    if (!fields.roles.length) errors.roles = "至少选择一个岗位";
    if (!fields.roles.includes("national_admin") && !fields.regionIds.length) errors.regionIds = "至少选择一个授权地区";
  }
  if (action === "create" || action === "resetPassword") {
    if (fields.password.length < 12 || new TextEncoder().encode(fields.password).length > 72 ||
      !/\p{L}/u.test(fields.password) || !/\p{N}/u.test(fields.password))
      errors.password = "至少12位，包含字母和数字，UTF-8编码不超过72字节";
  }
  if (action === "materials" || action === "review") {
    if (fields.summary.trim().length < 5 || fields.summary.trim().length > 2000) errors.summary = "说明须为5至2000字";
    if (action === "materials" && !fields.materialReference.trim()) errors.materialReference = "填写资料来源或归档编号";
    if (fields.materialReference.length > 1000) errors.materialReference = "最多1000字";
  }
  return errors;
}
