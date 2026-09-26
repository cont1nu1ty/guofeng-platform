import { reviewState, reviewFlow, scoringDimensions } from "../domain/review";
import { editorialState } from "../domain/editorial";
import * as operations from "../domain/operations";
import { activityLog, workspace } from "../domain/workspace";
import { defaultWorkspaceRegion } from "../domain/regions";
import { api, ApiError, connection, reportError, newRequestId } from "./http";
import { session } from "./session";
import { isHttpMode } from "./mode";
import { catalogState, homepageConfig } from "../domain/catalog";
export const arrayTargets = {
  ...catalogState,
  ...reviewState,
  ...editorialState,
  users: operations.demoUsers,
  products: operations.products,
  welfareClaims: operations.welfareClaims,
  courses: operations.courses,
  learningGroups: operations.learningGroups,
  knowledgeBases: operations.knowledgeBases,
  aiRecords: operations.aiRecords,
  dictionaryWords: operations.dictionaryWords,
  notificationDrafts: operations.notificationDrafts,
  activityLog,
};
export type WorkspaceData = {
  [K in keyof typeof arrayTargets]: (typeof arrayTargets)[K];
} & {
  reviewFlow: typeof reviewFlow;
  scoringDimensions: typeof scoringDimensions;
  platformConfig: typeof operations.platformConfig;
  homepageConfig?: typeof homepageConfig;
  permissions: string[];
  roles: string[];
};
// Reconcile existing identities so open drawers observe the authoritative saved values.
function reconcile(target: any[], source: any[]) {
  const previous = new Map(target.map((item) => [item.id, item]));
  const next = source.map((item) => {
    const existing = previous.get(item.id);
    if (existing) {
      Object.assign(existing, item);
      return existing;
    }
    return item;
  });
  target.splice(0, target.length, ...next);
}
export function applyWorkspace(data: WorkspaceData) {
  for (const key of Object.keys(arrayTargets) as (keyof typeof arrayTargets)[])
    reconcile(arrayTargets[key], Array.isArray(data[key]) ? data[key] : []);
  for (const item of editorialState.activities) {
    for (const key of ["startAt", "endAt"] as const) {
      if (item[key]?.includes("T") && Number.isFinite(Date.parse(item[key])))
        item[key] = new Date(item[key]).toLocaleString("sv-SE", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        });
    }
  }
  if (data.reviewFlow) {
    Object.assign(reviewFlow, data.reviewFlow);
    const config = data.reviewFlow as typeof reviewFlow & {
      enabled?: boolean[];
      flowVersion?: number;
    };
    if (config.enabled)
      reviewFlow.stages.forEach((stage, index) => {
        stage.enabled = !!config.enabled?.[index];
      });
    if (config.flowVersion) reviewFlow.name = `家风作品评审 · v${config.flowVersion}`;
  }
  if (data.scoringDimensions)
    scoringDimensions.splice(0, scoringDimensions.length, ...data.scoringDimensions);
  if (data.platformConfig)
    Object.assign(operations.platformConfig, data.platformConfig);
  homepageConfig.sections.splice(
    0,
    homepageConfig.sections.length,
    ...(data.homepageConfig?.sections || []),
  );
  homepageConfig.lockVersion = data.homepageConfig?.lockVersion;
  session.permissions = data.permissions || [];
  if (session.user && data.roles) session.user.roles = data.roles;
}
export function clearWorkspace() {
  for (const values of Object.values(arrayTargets)) values.splice(0);
  homepageConfig.sections.splice(0);
  homepageConfig.lockVersion = undefined;
}
export async function loadWorkspace() {
  if (!isHttpMode) return;
  connection.loading = true;
  connection.error = "";
  connection.requestId = "";
  try {
    applyWorkspace(await api<WorkspaceData>("/admin/workspace"));
    workspace.region = defaultWorkspaceRegion(session.user);
  } catch (error) {
    reportError(error);
    throw error;
  } finally {
    connection.loading = false;
  }
}
export function versionOf(
  id?: string,
  key?: keyof typeof arrayTargets,
): number | undefined {
  if (!id) return;
  const pools = key ? [arrayTargets[key]] : Object.values(arrayTargets);
  for (const values of pools) {
    const entity = values.find((value: any) => value.id === id) as
      | { lockVersion?: number }
      | undefined;
    if (entity) return entity.lockVersion;
  }
}
const commandCollections: Record<string, keyof typeof arrayTargets> = {
  approveSubmission: "submissions",
  returnSubmission: "submissions",
  assignReview: "submissions",
  prepareBlindMaterial: "submissions",
  decideSubmission: "submissions",
  publishSubmission: "submissions",
  submitReview: "tasks",
  updateExpert: "experts",
  saveUserRoles: "users",
  toggleUser: "users",
  approveUser: "users",
  saveContent: "contents",
  setContentStatus: "contents",
  saveCollection: "collections",
  saveChapter: "collections",
  moveChapter: "collections",
  importChapter: "collections",
  collectVolume: "collections",
  saveActivity: "activities",
  setActivityStatus: "activities",
  toggleAttendance: "activities",
  saveProduct: "products",
  toggleProduct: "products",
  processClaim: "welfareClaims",
  saveCourse: "courses",
  toggleCourse: "courses",
  saveDictionaryWord: "dictionaryWords",
  toggleDictionaryWord: "dictionaryWords",
  publishNotification: "notificationDrafts",
  saveKnowledgeDocument: "knowledgeBases",
  saveBanner: "banners",
  setBannerStatus: "banners",
  saveMedia: "mediaItems",
  setMediaStatus: "mediaItems",
  saveVenue: "venues",
  setVenueStatus: "venues",
  saveHallPerson: "hallPeople",
  setHallPersonStatus: "hallPeople",
  replySupportTicket: "supportTickets",
};
const retryKeys = new Map<string, string>();
export async function command<T>(
  name: string,
  data: Record<string, unknown> = {},
  entityId?: string,
  version = versionOf(entityId, commandCollections[name]),
): Promise<T> {
  if (connection.pending)
    throw new ApiError("上一项操作尚未完成，请稍候。", "OPERATION_IN_PROGRESS");
  const body = JSON.stringify({
    command: name,
    entityId: entityId || undefined,
    version,
    data,
  });
  const fingerprint = `${session.user?.id || ""}:${body}`;
  const idempotencyKey = retryKeys.get(fingerprint) || newRequestId();
  retryKeys.set(fingerprint, idempotencyKey);
  connection.pending++;
  connection.error = "";
  connection.requestId = "";
  try {
    const response = await api<{ result: T; workspace: WorkspaceData }>(
      "/admin/commands",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body,
      },
    );
    applyWorkspace(response.workspace);
    retryKeys.delete(fingerprint);
    return response.result;
  } catch (error) {
    // Unknown transport/server outcomes retain the logical operation key for a safe retry.
    if (error instanceof ApiError && error.status > 0 && error.status < 500)
      retryKeys.delete(fingerprint);
    reportError(error);
    throw error;
  } finally {
    connection.pending--;
  }
}
if (isHttpMode) clearWorkspace();
