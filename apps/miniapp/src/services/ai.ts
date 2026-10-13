import { watch } from 'vue'
import { request, currentSessionEpoch, remoteUser, ApiError } from './api'
import {
  AiTaskError,
  waitForAiTask,
  type AiTask,
  type AiStatus,
  type AiTaskInput,
} from '../domain/aiTasks'

const pending = new Map<string, { key: string; task?: AiTask }>()
watch(
  () => remoteUser.value?.id,
  () => pending.clear(),
  { flush: 'sync' },
)
export function createAiOperation() {
  const epoch = currentSessionEpoch()
  let cancelled = false
  return {
    cancel: () => {
      cancelled = true
    },
    active: () => !cancelled && epoch === currentSessionEpoch(),
  }
}
export type AiOperation = ReturnType<typeof createAiOperation>
function guard(operation: AiOperation) {
  if (!operation.active()) throw new AiTaskError('CANCELLED', '账户或页面已改变，本次响应未应用。')
}
export async function getAiStatus() {
  return (await request<AiStatus>('/ai/status')).data
}
export async function listAiTasks(operation = createAiOperation()): Promise<AiTask[]> {
  const response = await request<{ items: AiTask[] }>('/ai/tasks')
  guard(operation)
  return response.data.items
}
export async function readAiTask(id: string, operation = createAiOperation()) {
  const response = await request<AiTask>(`/ai/tasks/${encodeURIComponent(id)}`)
  guard(operation)
  return response.data
}
export async function resumeAiTask(
  task: AiTask,
  operation: AiOperation,
  onTask?: (task: AiTask) => void,
) {
  guard(operation)
  return waitForAiTask(task, {
    active: operation.active,
    read: (id) => readAiTask(id, operation),
    onTask,
  })
}
export async function runAiTask(
  input: AiTaskInput,
  operation: AiOperation,
  onTask?: (task: AiTask) => void,
) {
  guard(operation)
  const fingerprint = currentSessionEpoch() + ':' + JSON.stringify(input)
  let entry = pending.get(fingerprint)
  if (!entry) {
    entry = { key: `ai-${Date.now()}-${Math.random().toString(36).slice(2)}` }
    pending.set(fingerprint, entry)
  }
  try {
    if (!entry.task) {
      entry.task = (
        await request<AiTask>('/ai/tasks', 'POST', input, { 'Idempotency-Key': entry.key })
      ).data
      guard(operation)
    }
    const task = await resumeAiTask(entry.task, operation, onTask)
    pending.delete(fingerprint)
    return task
  } catch (error) {
    // Network/timeout/cancel retries resume the same task. Terminal failures can create a fresh attempt.
    if (
      (error instanceof AiTaskError && !['CANCELLED', 'AI_TIMEOUT'].includes(error.code)) ||
      (error instanceof ApiError && error.status >= 400 && error.status < 500)
    )
      pending.delete(fingerprint)
    throw error
  }
}
