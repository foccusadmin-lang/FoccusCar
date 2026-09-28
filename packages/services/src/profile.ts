import { randomUUID } from "node:crypto";
import {
  DEFAULT_REQUIRED_DOCUMENTS, CUSTOMER_DOCUMENT_TYPES, DOCUMENT_LABELS, addressSchema, assertTransition, authorize,
  TRACKING_CONSENT_TEXT, TRACKING_CONSENT_TITLE, TRACKING_CONSENT_VERSION, cnhSchema, isIdentityLocked, personalSchema, profileProgress, type AccessContext, type AccountStatus, type CustomerDocumentType,
} from "@foccus/core";
import { companies, customerDocuments, customers, drivers, users, withTenant, type Tx } from "@foccus/db";
import { buildStorageKey, sniffMime, validateUploadRequest } from "@foccus/integrations";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { audit, notify } from "./audit";
import { ServiceError, type RequestMeta, type ServiceDeps } from "./deps";
import { activeTrackingConsent } from "./tracking";

const toDateString = (d: Date) => d.toISOString().slice(0, 10);

export const profileInputSchema = z.object({
  personal: personalSchema,
  address: addressSchema,
  cnh: cnhSchema,
});
export type ProfileInput = z.input<typeof profileInputSchema>;

async function requiredDocuments(tx: Tx | ServiceDeps["db"], companyId: string): Promise<string[]> {
  const [c] = await tx.select({ settings: companies.settings }).from(companies).where(eq(companies.id, companyId));
  const list = (c?.settings as { requiredDocuments?: string[] } | undefined)?.requiredDocuments;
  return list?.length ? list : [...DEFAULT_REQUIRED_DOCUMENTS];
}

async function currentStatus(tx: Tx, userId: string): Promise<AccountStatus> {
  const [u] = await tx.select({ status: users.status }).from(users).where(eq(users.id, userId));
  if (!u) throw new ServiceError("Conta não encontrada.", 404, "NOT_FOUND");
  return u.status;
}

async function setStatus(tx: Tx, userId: string, from: AccountStatus, to: AccountStatus) {
  assertTransition(from, to);
  await tx.update(users).set({ status: to }).where(eq(users.id, userId));
}

/** Documentos vigentes (o mais recente não excluído de cada tipo). */
async function currentDocuments(tx: Tx, customerId: string) {
  const rows = await tx
    .select()
    .from(customerDocuments)
    .where(and(eq(customerDocuments.customerId, customerId), isNull(customerDocuments.deletedAt)))
    .orderBy(desc(customerDocuments.submittedAt));
  const seen = new Set<string>();
  return rows.filter((d) => (seen.has(d.type) ? false : (seen.add(d.type), true)));
}

function maskedDocuments(docs: Awaited<ReturnType<typeof currentDocuments>>) {
  return docs.map((d) => ({
    id: d.id,
    type: d.type,
    label: DOCUMENT_LABELS[d.type] ?? d.type,
    status: d.status,
    mimeType: d.mimeType,
    submittedAt: d.submittedAt,
    reviewedAt: d.reviewedAt,
    rejectionReason: d.rejectionReason,
  }));
}

export async function getMyProfile(deps: ServiceDeps, ctx: AccessContext) {
  authorize(ctx, { permission: "self:profile.manage", companyId: ctx.companyId, ownerUserId: ctx.userId });
  return withTenant(deps.db, ctx, async (tx) => {
    const status = await currentStatus(tx, ctx.userId);
    const [user] = await tx.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, ctx.userId));
    const [customer] = await tx.select().from(customers).where(eq(customers.userId, ctx.userId));
    const [driver] = customer
      ? await tx.select().from(drivers).where(and(eq(drivers.customerId, customer.id), eq(drivers.isCustomerSelf, true)))
      : [];
    const docs = customer ? await currentDocuments(tx, customer.id) : [];
    const required = await requiredDocuments(tx, ctx.companyId);
    const consent = await activeTrackingConsent(tx, ctx.companyId, ctx.userId);
    const trackingConsent = consent?.version === TRACKING_CONSENT_VERSION;
    return {
      status,
      identityLocked: isIdentityLocked(status),
      account: user!,
      personal: customer
        ? { fullName: customer.fullName, cpf: customer.cpf, birthDate: customer.birthDate, phone: customer.phone, whatsapp: customer.whatsapp, email: customer.email }
        : null,
      address: customer?.zip
        ? { zip: customer.zip, street: customer.street, number: customer.number, complement: customer.complement, district: customer.district, city: customer.city, state: customer.state }
        : null,
      cnh: driver?.cnhNumber
        ? { number: driver.cnhNumber, categories: driver.cnhCategories, expiresAt: driver.cnhExpiresAt, issuedAt: driver.cnhIssuedAt }
        : null,
      documents: maskedDocuments(docs),
      requiredDocuments: required.map((type) => ({ type, label: DOCUMENT_LABELS[type] ?? type })),
      tracking: {
        terms: { version: TRACKING_CONSENT_VERSION, title: TRACKING_CONSENT_TITLE, text: TRACKING_CONSENT_TEXT },
        acceptedAt: trackingConsent ? consent!.acceptedAt : null,
      },
      progress: profileProgress({ profileSaved: Boolean(customer?.zip && driver?.cnhNumber), documents: docs, required, trackingConsent }),
    };
  });
}

/** Salva dados pessoais, endereço e CNH. Identidade e CNH travam depois do envio para análise. */
export async function saveMyProfile(deps: ServiceDeps, ctx: AccessContext, input: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "self:profile.manage", companyId: ctx.companyId, ownerUserId: ctx.userId });
  const data = profileInputSchema.parse(input);
  const { personal, address, cnh } = data;

  return withTenant(deps.db, ctx, async (tx) => {
    const status = await currentStatus(tx, ctx.userId);
    const [existing] = await tx.select().from(customers).where(eq(customers.userId, ctx.userId));
    const [existingDriver] = existing
      ? await tx.select().from(drivers).where(and(eq(drivers.customerId, existing.id), eq(drivers.isCustomerSelf, true)))
      : [];

    if (isIdentityLocked(status) && existing) {
      const changed =
        existing.cpf !== personal.cpf ||
        existing.fullName !== personal.fullName ||
        existing.birthDate !== toDateString(personal.birthDate) ||
        existingDriver?.cnhNumber !== cnh.number ||
        existingDriver?.cnhCategories !== cnh.categories ||
        existingDriver?.cnhExpiresAt !== toDateString(cnh.expiresAt);
      if (changed)
        throw new ServiceError(
          "Seu cadastro já foi enviado para análise. Para alterar nome, CPF, nascimento ou CNH, fale com a locadora.",
          409,
          "IDENTITY_LOCKED",
        );
    }

    const [cpfOwner] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.cpf, personal.cpf), existing ? ne(customers.id, existing.id) : undefined));
    if (cpfOwner) throw new ServiceError("Este CPF já está cadastrado em outra conta.", 409, "CPF_TAKEN", { cpf: "CPF já cadastrado." });

    const values = {
      companyId: ctx.companyId,
      userId: ctx.userId,
      fullName: personal.fullName,
      cpf: personal.cpf,
      birthDate: toDateString(personal.birthDate),
      phone: personal.phone,
      whatsapp: personal.whatsapp,
      email: personal.email.toLowerCase(),
      zip: address.zip,
      street: address.street,
      number: address.number,
      complement: address.complement || null,
      district: address.district,
      city: address.city,
      state: address.state,
      updatedBy: ctx.userId,
    };
    const [customer] = existing
      ? await tx.update(customers).set(values).where(eq(customers.id, existing.id)).returning()
      : await tx.insert(customers).values({ ...values, createdBy: ctx.userId }).returning();

    const driverValues = {
      companyId: ctx.companyId,
      customerId: customer!.id,
      fullName: personal.fullName,
      cpf: personal.cpf,
      isCustomerSelf: true,
      cnhNumber: cnh.number,
      cnhCategories: cnh.categories,
      cnhIssuedAt: toDateString(cnh.issuedAt),
      cnhExpiresAt: toDateString(cnh.expiresAt),
      updatedBy: ctx.userId,
    };
    if (existingDriver) await tx.update(drivers).set(driverValues).where(eq(drivers.id, existingDriver.id));
    else await tx.insert(drivers).values({ ...driverValues, createdBy: ctx.userId });

    await tx.update(users).set({ name: personal.fullName }).where(eq(users.id, ctx.userId));
    await audit(tx, {
      companyId: ctx.companyId, actorUserId: ctx.userId, action: existing ? "customer.profile.update" : "customer.profile.create",
      entity: "customers", entityId: customer!.id, oldValue: existing ? { ...existing, cpf: "***" } : null, newValue: { ...values, cpf: "***" }, meta,
    });
    return { customerId: customer!.id };
  });
}

export const uploadInputSchema = z.object({
  type: z.enum(CUSTOMER_DOCUMENT_TYPES),
  fileName: z.string().min(1).max(200),
  contentType: z.string(),
  bytes: z.instanceof(Uint8Array),
});

/** Envio de documento: valida tipo, tamanho, extensão e conteúdo real; guarda no storage da empresa. */
export async function uploadMyDocument(deps: ServiceDeps, ctx: AccessContext, input: z.infer<typeof uploadInputSchema>, meta?: RequestMeta) {
  authorize(ctx, { permission: "self:profile.manage", companyId: ctx.companyId, ownerUserId: ctx.userId });
  const file = uploadInputSchema.parse(input);
  const problem = validateUploadRequest("document", { name: file.fileName, contentType: file.contentType, sizeBytes: file.bytes.byteLength });
  if (problem) throw new ServiceError(problem, 422, "INVALID_FILE");
  if (sniffMime(file.bytes) !== file.contentType)
    throw new ServiceError("O conteúdo do arquivo não corresponde a uma imagem ou PDF válido.", 422, "INVALID_FILE");

  return withTenant(deps.db, ctx, async (tx) => {
    const [customer] = await tx.select().from(customers).where(eq(customers.userId, ctx.userId));
    if (!customer) throw new ServiceError("Preencha seus dados antes de enviar documentos.", 409, "PROFILE_REQUIRED");

    const docs = await currentDocuments(tx, customer.id);
    const previous = docs.find((d) => d.type === file.type);
    if (previous?.status === "APPROVED")
      throw new ServiceError("Este documento já foi aprovado. Para trocar, fale com a locadora.", 409, "ALREADY_APPROVED");
    if (previous?.status === "UNDER_REVIEW")
      throw new ServiceError("Este documento está em análise. Aguarde o resultado.", 409, "UNDER_REVIEW");

    const id = randomUUID();
    const key = buildStorageKey(ctx.companyId, `customers/${customer.id}/documents`, id, file.contentType);
    await deps.storage.put(key, file.bytes, file.contentType);

    if (previous) await tx.update(customerDocuments).set({ deletedAt: new Date() }).where(eq(customerDocuments.id, previous.id));
    const [driver] = await tx.select().from(drivers).where(and(eq(drivers.customerId, customer.id), eq(drivers.isCustomerSelf, true)));
    const [doc] = await tx
      .insert(customerDocuments)
      .values({
        id,
        companyId: ctx.companyId,
        customerId: customer.id,
        driverId: file.type.startsWith("CNH") ? driver?.id ?? null : null,
        type: file.type,
        status: "PENDING",
        storageKey: key,
        mimeType: file.contentType,
        sizeBytes: String(file.bytes.byteLength),
        expiresAt: file.type.startsWith("CNH") ? driver?.cnhExpiresAt ?? null : null,
        history: [{ status: "PENDING", at: new Date().toISOString(), by: ctx.userId, reason: previous ? `substitui ${previous.id}` : undefined }],
      })
      .returning();
    await audit(tx, {
      companyId: ctx.companyId, actorUserId: ctx.userId, action: "customer.document.upload", entity: "customer_documents",
      entityId: id, oldValue: previous ? { id: previous.id, status: previous.status } : null, newValue: { type: file.type, key }, meta,
    });
    return maskedDocuments([doc!])[0]!;
  });
}

/**
 * Envia o cadastro para análise: PROFILE_INCOMPLETE → PROFILE_COMPLETE → UNDER_REVIEW (seção 21).
 * Exige dados, documentos e a autorização de localização (rastreamento em duas camadas).
 */
export async function submitMyProfile(deps: ServiceDeps, ctx: AccessContext, meta?: RequestMeta) {
  authorize(ctx, { permission: "self:profile.manage", companyId: ctx.companyId, ownerUserId: ctx.userId });
  return withTenant(deps.db, ctx, async (tx) => {
    const status = await currentStatus(tx, ctx.userId);
    if (status === "UNDER_REVIEW") return { status };
    if (status === "ACTIVE") throw new ServiceError("Seu cadastro já está aprovado.", 409, "ALREADY_ACTIVE");
    if (status !== "PROFILE_INCOMPLETE" && status !== "REGISTERED" && status !== "PROFILE_COMPLETE")
      throw new ServiceError("Sua conta está com acesso restrito. Fale com a locadora.", 403, "RESTRICTED");

    const [customer] = await tx.select().from(customers).where(eq(customers.userId, ctx.userId));
    const [driver] = customer
      ? await tx.select().from(drivers).where(and(eq(drivers.customerId, customer.id), eq(drivers.isCustomerSelf, true)))
      : [];
    const docs = customer ? await currentDocuments(tx, customer.id) : [];
    const consent = await activeTrackingConsent(tx, ctx.companyId, ctx.userId);
    const progress = profileProgress({
      profileSaved: Boolean(customer?.zip && driver?.cnhNumber), documents: docs, required: await requiredDocuments(tx, ctx.companyId),
      trackingConsent: consent?.version === TRACKING_CONSENT_VERSION,
    });
    if (!progress.profileSaved) throw new ServiceError("Preencha dados pessoais, endereço e CNH.", 422, "PROFILE_INCOMPLETE");
    if (!progress.documentsReady) {
      const pending = [...progress.missingDocuments, ...progress.rejectedDocuments].map((t) => DOCUMENT_LABELS[t] ?? t);
      throw new ServiceError(`Envie os documentos pendentes: ${pending.join(", ")}.`, 422, "DOCUMENTS_MISSING");
    }
    if (!progress.trackingConsent)
      throw new ServiceError("Ative a localização do celular e aceite a autorização para concluir o cadastro.", 422, "TRACKING_CONSENT_REQUIRED");

    if (status === "REGISTERED") await setStatus(tx, ctx.userId, "REGISTERED", "PROFILE_INCOMPLETE");
    if (status !== "PROFILE_COMPLETE") await setStatus(tx, ctx.userId, "PROFILE_INCOMPLETE", "PROFILE_COMPLETE");
    await setStatus(tx, ctx.userId, "PROFILE_COMPLETE", "UNDER_REVIEW");
    await tx.update(customers).set({ profileCompletedAt: new Date() }).where(eq(customers.id, customer!.id));
    for (const d of docs.filter((d) => d.status === "PENDING"))
      await tx
        .update(customerDocuments)
        .set({ status: "UNDER_REVIEW", history: [...d.history, { status: "UNDER_REVIEW", at: new Date().toISOString(), by: ctx.userId }] })
        .where(eq(customerDocuments.id, d.id));

    await notify(tx, {
      companyId: ctx.companyId, userId: ctx.userId, topic: "document",
      title: "Cadastro enviado para análise", body: "Recebemos seus dados e documentos. Avisaremos assim que a análise terminar.", link: "/cadastro",
    });
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "customer.profile.submit", entity: "users", entityId: ctx.userId, oldValue: { status }, newValue: { status: "UNDER_REVIEW" }, meta });
    return { status: "UNDER_REVIEW" as const };
  });
}

/** Leitura de arquivo de documento: somente o dono ou quem pode analisar documentos. */
export async function readDocumentFile(deps: ServiceDeps, ctx: AccessContext, documentId: string) {
  if (!z.uuid().safeParse(documentId).success) throw new ServiceError("Documento não encontrado.", 404, "NOT_FOUND");
  const doc = await withTenant(deps.db, ctx, async (tx) => {
    const [row] = await tx
      .select({ key: customerDocuments.storageKey, mime: customerDocuments.mimeType, ownerUserId: customers.userId, type: customerDocuments.type })
      .from(customerDocuments)
      .innerJoin(customers, eq(customers.id, customerDocuments.customerId))
      .where(eq(customerDocuments.id, documentId));
    return row;
  });
  if (!doc) throw new ServiceError("Documento não encontrado.", 404, "NOT_FOUND");
  const isOwner = doc.ownerUserId === ctx.userId;
  if (!isOwner) authorize(ctx, { permission: "customers:documents.review", companyId: ctx.companyId });
  const file = await deps.storage.get(doc.key);
  if (!file) throw new ServiceError("Arquivo indisponível no momento.", 404, "FILE_MISSING");
  return { bytes: file.bytes, contentType: doc.mime, fileName: `${doc.type.toLowerCase()}.${doc.key.split(".").pop()}` };
}

export type MyProfile = Awaited<ReturnType<typeof getMyProfile>>;
export type { CustomerDocumentType };
