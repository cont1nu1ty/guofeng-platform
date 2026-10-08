export interface Agreement { version: string; text: string; hash: string; signature: false }
export interface CertificateRecord {
  id: string; certificateNo: string; title: string; issuer: string; holderName: string; sourceTitle: string;
  status: 'issued' | 'revoked'; issuedAt: string; revokeReason?: string; verifyToken: string;
}
export interface CopyrightConfirmation { id: string; submissionId: string; revisionId: string; agreementVersion: string; agreementText: string; acceptedAt: string }
export interface ResourceRecord {
  id: string; title: string; description: string; fileName: string; mimeType: string; size: number;
  licenseText: string; attribution: string; audience: string; version: number;
}
export interface CredentialPage<T> { items: T[]; total: number; page: number; pageSize: number }
export function validVerificationCode(value: string) { return /^[a-f0-9]{32}$/.test(value.trim()) }
