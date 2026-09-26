import type { ReviewTask } from "./review";

type AssignmentTask = Pick<
  ReviewTask,
  "submissionId" | "expertId" | "status" | "dueAt"
>;

export function hasBlockingReviewTask(
  tasks: readonly AssignmentTask[],
  submissionId: string,
  expertId: string,
  httpMode: boolean,
  now = Date.now(),
) {
  return tasks.some(
    (task) =>
      task.submissionId === submissionId &&
      (httpMode
        ? task.status === "待评分" && Date.parse(task.dueAt) > now
        : task.expertId === expertId),
  );
}
