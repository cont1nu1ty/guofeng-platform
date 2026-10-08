export interface Certificate {
  id: string; certificateNo: string; kind: "award" | "completion"; title: string; issuer: string;
  ownerId: string; holderName: string; sourceTitle: string; region: string; status: "issued" | "revoked";
  issuedAt: string; revokedAt: string | null; revokeReason: string | null; verifyToken: string; version: number; fileHash: string;
}
export interface CertificateSource {
  kind: "award" | "completion"; sourceId: string; ownerId: string; courseVersion: number;
  name: string; title: string; region: string;
}
export interface AuthorizedResource {
  id: string; title: string; description: string; regionId: string; region: string; fileId: string;
  fileName: string; mimeType: string; size: number; sha256: string; licenseText: string; attribution: string;
  audience: "all_members" | "authorized_regions"; status: "draft" | "published" | "withdrawn"; version: number; updatedAt: string;
}
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
export function readableBytes(bytes: number) { return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`; }
export function emptyResource() { return { id: "", title: "", description: "", regionId: "", fileId: "", fileName: "", licenseText: "", attribution: "",
  audience: "all_members" as AuthorizedResource["audience"], status: "draft" as AuthorizedResource["status"], version: 0, authorized: false }; }
export function resourceFieldErrors(value: ReturnType<typeof emptyResource>) {
  const errors: Record<string,string> = {};
  if(value.title.trim().length < 2) errors.title="标题至少2字";
  if(value.description.trim().length < 5) errors.description="资源说明至少5字";
  if(!value.regionId) errors.regionId="请选择管理地区";
  if(!value.fileId) errors.fileId="请先上传资源文件";
  if(value.licenseText.trim().length < 10) errors.licenseText="请填写至少10字的资源使用许可";
  if(value.attribution.trim().length < 2) errors.attribution="请填写权利人或来源署名";
  if(value.status === "published" && !value.authorized) errors.authorized="请先确认具有本资源的分发授权";
  return errors;
}
