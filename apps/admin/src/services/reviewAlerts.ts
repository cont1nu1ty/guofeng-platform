import { reactive } from "vue";
import { api } from "./http";
import { command } from "./workspaceData";
import { isHttpMode } from "./mode";
import type { ReviewTask } from "../domain/review";
export interface ReviewNotice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  read: boolean;
  targetId: string;
  sourceType: "review-task";
  phase?: string;
  windowVersion?: number;
}
export interface ReviewAlert
  extends Pick<
    ReviewTask,
    | "id"
    | "submissionId"
    | "stage"
    | "startsAt"
    | "dueAt"
    | "windowVersion"
    | "windowStatus"
    | "canScore"
    | "status"
    | "lockVersion"
    | "serverNow"
  > {
  taskId: string;
  title: string;
  expertName: string;
  regionId: string;
  notificationIds: string[];
  unread: boolean;
}
export interface ReviewAlertsResponse {
  items: ReviewAlert[];
  total: number;
  page: number;
  pageSize: number;
  unreadCount: number;
  serverNow: string;
  notifications: ReviewNotice[];
}
export const reviewNotices = reactive({
  items: [] as ReviewNotice[],
  unreadCount: 0,
  error: "",
});
let noticeEpoch = 0;
export function clearReviewNotices() {
  noticeEpoch++;
  reviewNotices.items = [];
  reviewNotices.unreadCount = 0;
  reviewNotices.error = "";
}
export async function fetchReviewAlerts(
  query: {
    page?: number;
    pageSize?: number;
    phase?: string;
    scope?: string;
    unreadOnly?: boolean;
  } = {},
) {
  const params = new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  );
  const epoch = noticeEpoch;
  const result = await api<ReviewAlertsResponse>(
    `/admin/review-alerts?${params}`,
  );
  if (epoch === noticeEpoch) {
    reviewNotices.items = result.notifications;
    reviewNotices.unreadCount = result.unreadCount;
    reviewNotices.error = "";
  }
  return result;
}
export async function refreshReviewNotices() {
  if (!isHttpMode) return;
  try {
    await fetchReviewAlerts({ scope: "mine", pageSize: 1 });
  } catch (error) {
    reviewNotices.error =
      error instanceof Error ? error.message : "提醒读取失败，请重试";
  }
}
export async function markReviewAlertRead(id: string) {
  await command("markReviewAlertRead", {}, id);
  await refreshReviewNotices();
}
