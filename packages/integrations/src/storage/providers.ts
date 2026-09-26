import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { contentTypeFromKey, type StorageProvider, type StoredObject } from "./storage";

function assertSafeKey(key: string) {
  if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) throw new Error("Chave de arquivo inválida.");
}

/** Desenvolvimento: arquivos numa pasta local fora de /public. */
export class LocalDiskStorage implements StorageProvider {
  readonly kind = "local";
  private readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }
  private path(key: string) {
    assertSafeKey(key);
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root + sep)) throw new Error("Chave de arquivo inválida.");
    return p;
  }
  async put(key: string, bytes: Uint8Array) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, bytes);
  }
  async get(key: string): Promise<StoredObject | null> {
    try {
      return { bytes: new Uint8Array(await readFile(this.path(key))), contentType: contentTypeFromKey(key) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
  async remove(key: string) {
    await rm(this.path(key), { force: true });
  }
}

/** Produção: S3, Cloudflare R2 ou MinIO (bucket privado, criptografia no servidor). */
export class S3Storage implements StorageProvider {
  readonly kind = "s3";
  private readonly client: S3Client;
  constructor(private readonly cfg: { bucket: string; endpoint?: string; region?: string; accessKeyId: string; secretAccessKey: string }) {
    this.client = new S3Client({
      region: cfg.region ?? "auto",
      endpoint: cfg.endpoint || undefined,
      forcePathStyle: Boolean(cfg.endpoint),
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  async put(key: string, bytes: Uint8Array, contentType: string) {
    assertSafeKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: bytes, ContentType: contentType, ServerSideEncryption: this.cfg.endpoint ? undefined : "AES256" }));
  }
  async get(key: string): Promise<StoredObject | null> {
    assertSafeKey(key);
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return { bytes: await res.Body!.transformToByteArray(), contentType: res.ContentType ?? contentTypeFromKey(key) };
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }
  async remove(key: string) {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }
}

/** Testes. */
export class MemoryStorage implements StorageProvider {
  readonly kind = "memory";
  readonly objects = new Map<string, StoredObject>();
  async put(key: string, bytes: Uint8Array, contentType: string) {
    assertSafeKey(key);
    this.objects.set(key, { bytes, contentType });
  }
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
  async remove(key: string) {
    this.objects.delete(key);
  }
}

export function createStorage(env: Record<string, string | undefined> = process.env): StorageProvider {
  if (env.STORAGE_BUCKET && env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY)
    return new S3Storage({
      bucket: env.STORAGE_BUCKET,
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      accessKeyId: env.STORAGE_ACCESS_KEY,
      secretAccessKey: env.STORAGE_SECRET_KEY,
    });
  if (env.NODE_ENV === "production" && env.STORAGE_ALLOW_LOCAL !== "true")
    throw new Error("Storage não configurado: defina STORAGE_BUCKET, STORAGE_ACCESS_KEY e STORAGE_SECRET_KEY.");
  return new LocalDiskStorage(env.STORAGE_LOCAL_DIR ?? ".storage");
}
