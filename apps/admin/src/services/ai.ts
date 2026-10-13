import { api, ApiError, newRequestId } from "./http";
import { can, session } from "./session";

export interface AiStatus {
  enabled: boolean;
  provider: string;
  model: string;
  ocrEnabled: boolean;
  external: boolean;
  knowledgeCount: number;
}
export type AiMode = "review" | "summary" | "family" | "letter" | "polish" | "knowledge" | "support" | "ocr" | "index";
export interface AiTask {
  id: string;
  mode: AiMode;
  status: "queued" | "running" | "succeeded" | "failed";
  result?: string;
  citations?: { id: string; title: string; excerpt: string; url?: string }[];
  issues?: { severity: string; quote: string; reason: string }[];
  similarities?: { id: string; title: string; excerpt: string; score: number }[];
  model?: string;
  error?: { code: string; message: string };
  createdAt: string;
  completedAt?: string;
  submissionId?: string;
  sourceVersion?: number;
}
export const aiModeLabels: Record<AiMode, string> = {
  review: "审核辅助", summary: "稿件摘要", family: "家训拟写", letter: "家书创作",
  polish: "文稿润色", knowledge: "知识问答", support: "平台客服", ocr: "文字识别", index: "资料索引",
};
export const aiStatusLabels = { queued: "等待处理", running: "处理中", succeeded: "已完成", failed: "处理失败" };
export const readAiStatus = () => api<AiStatus>("/ai/status");
export const readAiTask = (id: string) => api<AiTask>(`/ai/tasks/${encodeURIComponent(id)}`);
export async function readAiTasks(): Promise<{ items: AiTask[] }> {
  const response = await api<{ items: AiTask[] }>("/admin/ai/tasks");
  // This list is operational metadata, even if a server accidentally sends detail fields.
  return { items: (response.items || []).map((task) => ({
    id: task.id, mode: task.mode, status: task.status, model: task.model,
    createdAt: task.createdAt, completedAt: task.completedAt,
    submissionId: task.submissionId, sourceVersion: task.sourceVersion,
    error: task.error ? { code: task.error.code, message: "" } : undefined,
  })) };
}
export async function readLatestSubmissionTask(submissionId: string): Promise<AiTask | undefined> {
  // Manuscript operators can restore their own tasks without AI operations access.
  const { items } = can("ai:read")
    ? await readAiTasks()
    : await api<{ items: AiTask[] }>("/ai/tasks");
  const latest = items.find((task) => task.submissionId === submissionId);
  return latest ? readAiTask(latest.id) : undefined;
}

// Retain a logical request key after an unknown transport outcome, including retries.
const retryKeys = new Map<string, string>();
async function createTask(path: string, data: Record<string, unknown>): Promise<AiTask> {
  const body = JSON.stringify(data);
  const fingerprint = `${session.user?.id || ""}:${path}:${body}`;
  const key = retryKeys.get(fingerprint) || newRequestId();
  retryKeys.set(fingerprint, key);
  try {
    const task = await api<AiTask>(path, { method: "POST", headers: { "Idempotency-Key": key }, body });
    retryKeys.delete(fingerprint);
    return task;
  } catch (error) {
    if (error instanceof ApiError && error.status > 0 && error.status < 500) retryKeys.delete(fingerprint);
    throw error;
  }
}
export function analyseSubmission(submissionId: string, version: number, mode: "review" | "summary") {
  // The server reads the authorized immutable manuscript. Never send the browser's copy.
  return createTask("/ai/tasks", { mode, submissionId, version, language: "zh", prompt: mode === "review" ? "请提供摘要、主题、需要人工核对的问题和相似内容证据。" : "请概括稿件内容和主题，保留原文事实。" });
}
export function indexKnowledge(id: string, version: number, audience: "public" | "staff", language: "zh" | "en") {
  return createTask(`/admin/ai/knowledge/${encodeURIComponent(id)}/index`, { version, audience, language });
}
export function withdrawKnowledge(id: string, version: number) {
  return api(`/admin/ai/knowledge/${encodeURIComponent(id)}/withdraw`, { method: "POST", body: JSON.stringify({ version }) });
}

function aborted() { return new DOMException("任务页面已关闭", "AbortError"); }
function pause(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(aborted()); return; }
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); reject(aborted()); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", cancel); resolve(); }, ms);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}
export async function waitForAiTask(task: AiTask, options: { signal?: AbortSignal; onUpdate?: (task: AiTask) => void; interval?: number; attempts?: number } = {}) {
  let current = task;
  for (let attempt = 0; attempt < (options.attempts ?? 180); attempt++) {
    if (options.signal?.aborted) throw aborted();
    options.onUpdate?.(current);
    if (current.status === "succeeded" || current.status === "failed") return current;
    await pause(options.interval ?? 1500, options.signal);
    current = await readAiTask(current.id);
  }
  throw new ApiError("任务仍在处理中，请稍后刷新任务状态，无需重复提交。", "AI_POLL_TIMEOUT");
}
export function isTaskStale(task: AiTask, submissionId: string, version?: number) {
  return task.submissionId !== submissionId || task.sourceVersion !== version;
}
