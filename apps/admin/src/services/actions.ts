import * as review from "../domain/review";
import * as editorial from "../domain/editorial";
import * as operations from "../domain/operations";
import { isHttpMode } from "./mode";
import { command, versionOf } from "./workspaceData";
const dispatch =
  <A extends unknown[], R>(
    name: string,
    local: (...args: A) => R,
    payload: (...args: A) => { id?: string; data: Record<string, unknown> },
  ) =>
  async (...args: A): Promise<R> => {
    if (!isHttpMode) return local(...args);
    const { id, data } = payload(...args);
    const result = await command<R>(name, data, id);
    if (
      [
        "saveProduct",
        "saveCourse",
        "saveDictionaryWord",
        "saveNotificationDraft",
      ].includes(name) &&
      result &&
      typeof result === "object" &&
      !("ok" in result)
    )
      return { ok: true, message: "操作已保存" } as R;
    return result;
  };
export const approveSubmission = dispatch(
  "approveSubmission",
  review.approveSubmission,
  (id) => ({ id, data: {} }),
);
export const batchApproveSubmissions = dispatch(
  "batchApproveSubmissions",
  review.batchApproveSubmissions,
  (ids) => ({
    data: {
      ids,
      versions: Object.fromEntries(
        ids.map((id) => [id, versionOf(id, "submissions")]),
      ),
    },
  }),
);
export const returnSubmission = dispatch(
  "returnSubmission",
  review.returnSubmission,
  (id, reason) => ({ id, data: { reason } }),
);
export const assignReview = dispatch(
  "assignReview",
  review.assignReview,
  (id, expertId, dueAt) => ({ id, data: { expertId, dueAt: /^\d{4}-\d{2}-\d{2}$/.test(dueAt) ? new Date(`${dueAt}T23:59:59+08:00`).toISOString() : dueAt } }),
);
export const submitReview = dispatch(
  "submitReview",
  review.submitReview,
  (id, scores, comment) => ({ id, data: { scores, comment } }),
);
export const updateExpert = dispatch(
  "updateExpert",
  review.updateExpert,
  (id, group, availability) => ({ id, data: { group, availability } }),
);
export const configureReviewFlow = async (
  input: Parameters<typeof review.configureReviewFlow>[0],
) =>
  isHttpMode
    ? command<review.ActionResult>(
        "configureReviewFlow",
        { ...input },
        undefined,
        (
          review.reviewFlow as typeof review.reviewFlow & {
            lockVersion?: number;
          }
        ).lockVersion,
      )
    : review.configureReviewFlow(input);
export const saveContent = dispatch(
  "saveContent",
  editorial.saveContent,
  (draft, id) => ({ id, data: { ...draft } }),
);
export const setContentStatus = dispatch(
  "setContentStatus",
  editorial.setContentStatus,
  (item, status) => ({ id: item.id, data: { status } }),
);
export const saveCollection = dispatch(
  "saveCollection",
  editorial.saveCollection,
  (draft, id) => ({ id, data: { ...draft } }),
);
export const saveChapter = dispatch(
  "saveChapter",
  editorial.saveChapter,
  (collection, draft, chapterId) => ({
    id: collection.id,
    data: { ...draft, chapterId },
  }),
);
export const moveChapter = dispatch(
  "moveChapter",
  editorial.moveChapter,
  (collection, index, direction) => ({
    id: collection.id,
    data: { index, direction },
  }),
);
export const collectVolume = dispatch(
  "collectVolume",
  editorial.collectVolume,
  (item) => ({ id: item.id, data: {} }),
);
export async function addSampleChapter(item: editorial.CollectionItem) {
  if (isHttpMode) throw new Error("真实模式请从已入选稿件添加章节");
  return editorial.addSampleChapter(item);
}
export const importChapter = (collectionId: string, submissionId: string) =>
  command("importChapter", { submissionId }, collectionId);
const activityTimestamp = (value: string) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value) ? new Date(`${value.replace(' ', 'T')}:00+08:00`).toISOString() : value;
export const saveActivity = dispatch(
  "saveActivity",
  editorial.saveActivity,
  (draft, id) => ({ id, data: { ...draft, startAt: activityTimestamp(draft.startAt), endAt: activityTimestamp(draft.endAt) } }),
);
export const setActivityStatus = dispatch(
  "setActivityStatus",
  editorial.setActivityStatus,
  (item, status) => ({ id: item.id, data: { status } }),
);
export const toggleAttendance = dispatch(
  "toggleAttendance",
  editorial.toggleAttendance,
  (item, registration) => ({
    id: item.id,
    data: {
      registrationId: registration.id,
      checkedIn: !registration.checkedIn,
    },
  }),
);
export const saveUserRoles = dispatch(
  "saveUserRoles",
  operations.saveUserRoles,
  (id, roles) => ({ id, data: { roles } }),
);
export const toggleUser = dispatch(
  "toggleUser",
  operations.toggleUser,
  (id) => ({
    id,
    data: {
      enabled: !operations.demoUsers.find((item) => item.id === id)?.enabled,
    },
  }),
);
export const approveUser = dispatch(
  "approveUser",
  operations.approveUser,
  (id) => ({ id, data: {} }),
);
export const saveProduct = dispatch(
  "saveProduct",
  operations.saveProduct,
  (id, stock, quota) => ({ id, data: { stock, quota } }),
);
export const toggleProduct = dispatch(
  "toggleProduct",
  operations.toggleProduct,
  (id) => ({
    id,
    data: {
      status: ["上架中", "已上架"].includes(
        operations.products.find((item) => item.id === id)?.status || "",
      )
        ? "已下架"
        : "已上架",
    },
  }),
);
export const processClaim = dispatch(
  "processClaim",
  operations.processClaim,
  (id, action, note = "") => ({ id, data: { action, note } }),
);
export const saveCourse = dispatch(
  "saveCourse",
  operations.saveCourse,
  (input) => ({ id: input.id, data: { ...input } }),
);
export const toggleCourse = dispatch(
  "toggleCourse",
  operations.toggleCourse,
  (id) => ({
    id,
    data: {
      status:
        operations.courses.find((item) => item.id === id)?.status === "已上架"
          ? "已下架"
          : "已上架",
    },
  }),
);
export const saveDictionaryWord = dispatch(
  "saveDictionaryWord",
  operations.saveDictionaryWord,
  (input) => ({ id: input.id, data: { ...input } }),
);
export const toggleDictionaryWord = dispatch(
  "toggleDictionaryWord",
  operations.toggleDictionaryWord,
  (id) => ({
    id,
    data: {
      enabled: !operations.dictionaryWords.find((item) => item.id === id)
        ?.enabled,
    },
  }),
);
export const savePlatformConfig = async (input: operations.PlatformConfig) =>
  isHttpMode
    ? command<review.ActionResult>(
        "savePlatformConfig",
        { ...input },
        undefined,
        (
          operations.platformConfig as operations.PlatformConfig & {
            lockVersion?: number;
          }
        ).lockVersion,
      )
    : operations.savePlatformConfig(input);
export const saveNotificationDraft = dispatch(
  "saveNotificationDraft",
  operations.saveNotificationDraft,
  (input) => ({ data: { ...input } }),
);
