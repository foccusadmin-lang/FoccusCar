/**
 * Storage de arquivos (seção 82): S3/R2/GCS compatível. O banco guarda só a chave.
 * Uploads vão direto do navegador ao storage via URL assinada de curta duração.
 */
export interface StorageProvider {
  createUploadUrl(input: { key: string; contentType: string; maxBytes: number; expiresInSeconds?: number }): Promise<{ url: string; fields?: Record<string, string> }>;
  createDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  head(key: string): Promise<{ sizeBytes: number; contentType: string } | null>;
  readFirstBytes(key: string, length: number): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

export const UPLOAD_RULES = {
  document: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
  photo: { maxBytes: 8 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  signature: { maxBytes: 512 * 1024, types: ["image/png"] },
} as const;
export type UploadKind = keyof typeof UPLOAD_RULES;

const EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
};

/** Assinaturas binárias (magic bytes) para conferir o conteúdo real do arquivo (seção 83). */
export function sniffMime(bytes: Uint8Array): string | null {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return "application/pdf";
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "image/webp";
  return null;
}

export function validateUploadRequest(kind: UploadKind, file: { name: string; contentType: string; sizeBytes: number }): string | null {
  const rule = UPLOAD_RULES[kind];
  if (!(rule.types as readonly string[]).includes(file.contentType)) return "Tipo de arquivo não permitido.";
  if (file.sizeBytes <= 0 || file.sizeBytes > rule.maxBytes) return `O arquivo deve ter até ${Math.round(rule.maxBytes / 1024 / 1024) || 0.5} MB.`;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONS[file.contentType]?.includes(ext)) return "A extensão não corresponde ao tipo do arquivo.";
  return null;
}

/** Chave no storage sempre prefixada pela empresa, nunca com o nome enviado pelo usuário. */
export function buildStorageKey(companyId: string, area: string, id: string, contentType: string): string {
  const ext = EXTENSIONS[contentType]?.[0] ?? "bin";
  return `companies/${companyId}/${area}/${id}.${ext}`;
}
