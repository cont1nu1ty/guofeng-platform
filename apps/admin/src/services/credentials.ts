import { api, newRequestId } from "./http";
import type { AuthorizedResource, Certificate, CertificateSource, Paged } from "../domain/credentials";
export const listCertificates = (page: number, pageSize: number) => api<Paged<Certificate>>(`/admin/certificates?page=${page}&pageSize=${pageSize}`);
export const eligibleCertificates = (query: string) => api<{items: CertificateSource[]}>(`/admin/certificates/eligible?query=${encodeURIComponent(query)}`);
export const listResources = (page: number, pageSize: number, query: string) => api<Paged<AuthorizedResource>>(`/admin/resources?page=${page}&pageSize=${pageSize}&query=${encodeURIComponent(query)}`);
export function prepareCredentialWrite(path: string, input: unknown) {
  const body=JSON.stringify(input), key=newRequestId();
  return () => api<{ok:boolean;id?:string}>(path,{method:"POST",headers:{"Idempotency-Key":key},body});
}
export async function downloadCertificate(id: string) {
  const result=await api<{url:string}>(`/certificates/${encodeURIComponent(id)}/download`);
  const link=document.createElement("a");link.href=result.url;link.target="_blank";link.rel="noopener";link.click();
}
export const verifyCertificate = (token: string) => api<Pick<Certificate,"certificateNo"|"title"|"issuer"|"status"|"issuedAt"|"revokedAt"|"fileHash">>(`/certificates/verify/${encodeURIComponent(token.trim())}`);
