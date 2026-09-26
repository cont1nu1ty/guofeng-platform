/** Login/getInfo/logout lifecycle adapted from plus-ui store/modules/user.ts (MIT). */
import { reactive } from "vue";
import type { Directive } from "vue";
import { api } from "./http";
import { isHttpMode } from "./mode";
import { getToken, setToken, removeToken } from "../utils/auth";
export interface SessionUser {
  id: string;
  name: string;
  roles: string[];
  regionIds: string[];
  permissions?: string[];
}
export const session = reactive({
  user: null as SessionUser | null,
  permissions: [] as string[],
  ready: !isHttpMode,
});
export async function login(username: string, password: string) {
  const response = await api<{ token: string; user: SessionUser }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        username: username.trim(),
        password,
        client: "admin",
      }),
    },
  );
  if (!response.token || !response.user) throw new Error("登录响应不完整");
  setToken(response.token);
  session.user = response.user;
}
export async function restoreSession() {
  if (!getToken()) return;
  const result = await api<SessionUser | { user: SessionUser }>("/auth/me");
  session.user = "user" in result ? result.user : result;
}
export async function logout() {
  await api("/auth/logout", { method: "POST" });
  removeToken();
  session.user = null;
  session.permissions = [];
}
export function expireSession() {
  session.user = null;
  session.permissions = [];
}
// Permission matching adapted from plus-ui plugins/auth.ts and directive/permission/index.ts.
export function can(permission: string) {
  return (
    !isHttpMode ||
    session.permissions.some(
      (value) => value === "*:*:*" || value === "*" || value === permission,
    )
  );
}
export function canVisit(path: string) {
  return path === "/overview" || can(`${path.slice(1)}:read`);
}
export const hasPermi: Directive<HTMLElement, string | string[]> = {
  mounted: updateVisibility,
  updated: updateVisibility,
};
function updateVisibility(
  el: HTMLElement,
  binding: { value: string | string[] },
) {
  const values = Array.isArray(binding.value) ? binding.value : [binding.value];
  el.style.display = values.some(can) ? "" : "none";
}
