import type { AccountAction, AccountFilters, AccountPage, ManagedAccount } from "../domain/accounts";
import { api, newRequestId } from "./http";

export function listAccounts(filters: AccountFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "") params.set(key, String(value));
  });
  return api<AccountPage>(`/admin/accounts?${params}`);
}
export function accountDetail(id: string) {
  return api<ManagedAccount>(`/admin/accounts/${encodeURIComponent(id)}`);
}
/** A retry of this request retains the original payload and idempotency key. */
export function prepareAccountChange(action: AccountAction, id: string, data: Record<string, unknown>) {
  const body = JSON.stringify(data);
  const key = newRequestId();
  return () => api<{ ok: boolean; id: string; message: string }>(
    action === "create" ? "/admin/accounts" : `/admin/accounts/${encodeURIComponent(id)}/${action}`,
    { method: "POST", headers: { "Idempotency-Key": key }, body },
  );
}
