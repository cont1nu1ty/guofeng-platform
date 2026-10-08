import { api, ApiError, newRequestId } from "./http";
import { session } from "./session";
import type { EducationWorkspace } from "../domain/education";
const keys = new Map<string, string>();
export const fetchEducation = (query: {
  coursePage: number;
  groupPage: number;
  identityPage: number;
  q: string;
}) =>
  api<EducationWorkspace>(
    "/admin/education?" +
      new URLSearchParams(
        Object.entries(query).map(([key, value]) => [key, String(value)]),
      ),
  );
export const searchEducationMembers = (q: string) =>
  api<{ items: EducationWorkspace["members"] }>(
    "/admin/education/members?q=" + encodeURIComponent(q),
  );
export async function educationCommand(
  command: string,
  entityId: string,
  version: number | undefined,
  data: unknown = {},
) {
  const body = JSON.stringify({ command, entityId, version, data });
  const fingerprint = `${session.user?.id || ""}:${body}`;
  const key = keys.get(fingerprint) || newRequestId();
  keys.set(fingerprint, key);
  try {
    const result = await api<{ ok: boolean; id?: string }>(
      "/admin/education/commands",
      { method: "POST", body, headers: { "Idempotency-Key": key } },
    );
    keys.delete(fingerprint);
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status > 0 && error.status < 500)
      keys.delete(fingerprint);
    throw error;
  }
}
