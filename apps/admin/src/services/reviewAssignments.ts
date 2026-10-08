import { api } from "./http";
export interface AssignmentCandidate {
  id: string;
  name: string;
  region: string;
  group: string;
  availability: "可分配";
  openTasks: number;
}
export interface AssignmentInput {
  ids: string[];
  versions: Record<string, number | undefined>;
  group: string;
}
export interface AssignmentPlan {
  fingerprint: string;
  rule: string;
  rows: {
    submissionId: string;
    title: string;
    version: number;
    expertId: string;
    expertName: string;
    openTasks: number;
  }[];
  excluded: { submissionId: string; title: string; reason: string }[];
}
export const assignmentCandidates = (id: string) =>
  api<AssignmentCandidate[]>(
    `/admin/review-assignments/candidates?submissionId=${encodeURIComponent(id)}`,
  );
export const previewAssignments = (input: AssignmentInput) =>
  api<AssignmentPlan>("/admin/review-assignments/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const confirmAssignments = (
  input: AssignmentInput,
  fingerprint: string,
  key: string,
) =>
  api<{ ok: boolean; assigned: number }>("/admin/review-assignments/confirm", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({ ...input, fingerprint }),
  });
