import { reactive } from "vue";
import { currentSessionEpoch, getToken, removeToken } from "../utils/auth";
import { apiBase } from "./mode";
export const connection = reactive({
  loading: false,
  pending: 0,
  error: "",
  requestId: "",
});
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public requestId = "",
    public status = 0,
  ) {
    super(message);
  }
}
/** Adapted request boundary: upstream plus-ui request.ts supplies Bearer token and expiry handling;
 * project API returns direct DTOs, so no RuoYi response envelope leaks into pages. */
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const headers = new Headers(options.headers);
  const token = getToken();
  const epoch = currentSessionEpoch();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("json") ? await response.json() : null;
    // Check after consuming the body as it can arrive after a new login too.
    // Never return another account's payload or expire the current token.
    if (epoch !== currentSessionEpoch() || token !== getToken())
      throw new ApiError("账户已改变，本次响应未应用，请重新操作。", "SESSION_CHANGED");
    if (!response.ok) {
      if (response.status === 401) {
        removeToken();
        window.dispatchEvent(new Event("jiafeng:session-expired"));
      }
      throw new ApiError(
        body?.message || `服务请求失败（${response.status}）`,
        body?.code || "HTTP_ERROR",
        body?.requestId || "",
        response.status,
      );
    }
    if (response.status !== 204 && body === null)
      throw new ApiError(
        "服务返回格式不正确，请检查 API 地址",
        "INVALID_RESPONSE",
      );
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error && error.name === "AbortError"
        ? "请求超时，请核对网络后重试"
        : "暂时无法连接服务，请核对网络后重试",
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }
}
export function reportError(error: unknown) {
  connection.error =
    error instanceof Error ? error.message : "操作失败，请重试";
  connection.requestId = error instanceof ApiError ? error.requestId : "";
}

/** getRandomValues remains available on an explicitly enabled LAN HTTP deployment. */
export function newRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
