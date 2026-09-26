import { api } from "./http";
export interface UploadedFile {
  fileId: string;
  name: string;
  size?: number;
  contentType?: string;
}
export async function uploadFile(file: File, purpose?: "media"): Promise<UploadedFile> {
  const body = new FormData();
  body.append("file", file, file.name);
  return api<UploadedFile>(purpose ? `/files?purpose=${purpose}` : "/files", {
    method: "POST",
    body,
  });
}
export async function downloadFile(fileId: string) {
  const { url } = await api<{ url: string }>(
    `/files/${encodeURIComponent(fileId)}/download`,
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener";
  anchor.click();
}
