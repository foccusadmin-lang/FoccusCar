import { DOCUMENT_LABELS, assertTransition, authorize, maskCpf, profileProgress, DEFAULT_REQUIRED_DOCUMENTS, type AccessContext } from "@foccus/core";
import { companies, customerDocuments, customers, drivers, users, withTenant } from "@foccus/db";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { audit, notify } from "./audit";
import { ServiceError, type RequestMeta, type ServiceDeps } from "./deps";

const uuid = z.uuid();

async function required(deps: ServiceDeps, companyId: string) {
  const [c] = await deps.db.select({ settings: companies.settings }).from(companies).where(eq(companies.id, companyId));
  const list = (c?.settings as { requiredDocuments?: string[] } | undefined)?.requiredDocuments;
  return list?.length ? list : [...DEFAULT_REQUIRED_DOCUMENTS];
}

/** Fila de cadastros aguardando análise (operador/gerente/admin). */
export async function listReviewQueue(deps: ServiceDeps, ctx: AccessContext) {
  authorize(ctx, { permission: "customers:documents.review", companyId: ctx.companyId });
  return withTenant(deps.db, ctx, async (tx) => {
    const rows = await tx
      .select({ id: customers.id, fullName: customers.fullName, cpf: customers.cpf, city: customers.city, state: customers.state, submittedAt: customers.profileCompletedAt, status: users.status })
      .from(customers)
      .innerJoin(users, eq(users.id, customers.userId))
      .where(and(eq(users.status, "UNDER_REVIEW"), isNull(customers.deletedAt)))
      .orderBy(asc(customers.profileCompletedAt))
      .limit(100);
    return rows.map((r) => ({ ...r, cpf: r.cpf ? maskCpf(r.cpf) : null }));
  });
}

export async function getReviewDetail(deps: ServiceDeps, ctx: AccessContext, customerId: string) {
  authorize(ctx, { permission: "customers:documents.review", companyId: ctx.companyId });
  if (!uuid.safeParse(customerId).success) throw new ServiceError("Cliente não encontrado.", 404, "NOT_FOUND");
  const req = await required(deps, ctx.companyId);
  return withTenant(deps.db, ctx, async (tx) => {
    const [c] = await tx.select().from(customers).where(eq(customers.id, customerId));
    if (!c?.userId) throw new ServiceError("Cliente não encontrado.", 404, "NOT_FOUND");
    const [u] = await tx.select({ status: users.status, email: users.email, emailVerified: users.emailVerified }).from(users).where(eq(users.id, c.userId));
    const [d] = await tx.select().from(drivers).where(and(eq(drivers.customerId, c.id), eq(drivers.isCustomerSelf, true)));
    const docsAll = await tx.select().from(customerDocuments).where(and(eq(customerDocuments.customerId, c.id), isNull(customerDocuments.deletedAt))).orderBy(desc(customerDocuments.submittedAt));
    const seen = new Set<string>();
    const docs = docsAll.filter((x) => (seen.has(x.type) ? false : (seen.add(x.type), true)));
    return {
      customer: {
        id: c.id, fullName: c.fullName, cpf: c.cpf, birthDate: c.birthDate, phone: c.phone, whatsapp: c.whatsapp, email: c.email,
        address: [c.street, c.number, c.complement, c.district, `${c.city}/${c.state}`, c.zip].filter(Boolean).join(", "),
        submittedAt: c.profileCompletedAt,
      },
      account: u!,
      cnh: d ? { number: d.cnhNumber, categories: d.cnhCategories, issuedAt: d.cnhIssuedAt, expiresAt: d.cnhExpiresAt } : null,
      documents: docs.map((x) => ({ id: x.id, type: x.type, label: DOCUMENT_LABELS[x.type] ?? x.type, status: x.status, mimeType: x.mimeType, submittedAt: x.submittedAt, rejectionReason: x.rejectionReason, required: req.includes(x.type) })),
      progress: profileProgress({ profileSaved: true, documents: docs, required: req }),
    };
  });
}

export const reviewDocumentSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE") }),
  z.object({ decision: z.literal("REJECT"), reason: z.string().trim().min(5, "Explique o motivo para o cliente (mínimo 5 caracteres).").max(300) }),
]);

/**
 * Aprova ou recusa um documento (seção 23). Recusa devolve a conta para PROFILE_INCOMPLETE,
 * com o motivo visível ao cliente, para que ele envie de novo.
 */
export async function reviewDocument(deps: ServiceDeps, ctx: AccessContext, documentId: string, input: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "customers:documents.review", companyId: ctx.companyId });
  if (!uuid.safeParse(documentId).success) throw new ServiceError("Documento não encontrado.", 404, "NOT_FOUND");
  const body = reviewDocumentSchema.parse(input);
  const result = await withTenant(deps.db, ctx, async (tx) => {
    const [doc] = await tx.select().from(customerDocuments).where(and(eq(customerDocuments.id, documentId), isNull(customerDocuments.deletedAt)));
    if (!doc) throw new ServiceError("Documento não encontrado.", 404, "NOT_FOUND");
    if (doc.status === "APPROVED" || doc.status === "REJECTED") throw new ServiceError("Este documento já foi analisado.", 409, "ALREADY_REVIEWED");
    const [c] = await tx.select().from(customers).where(eq(customers.id, doc.customerId));
    if (c?.userId === ctx.userId) throw new ServiceError("Você não pode analisar os seus próprios documentos.", 403, "SELF_REVIEW");

    const now = new Date();
    const status = body.decision === "APPROVE" ? ("APPROVED" as const) : ("REJECTED" as const);
    const reason = body.decision === "REJECT" ? body.reason : null;
    await tx
      .update(customerDocuments)
      .set({ status, reviewedAt: now, reviewedBy: ctx.userId, rejectionReason: reason, history: [...doc.history, { status, at: now.toISOString(), by: ctx.userId, reason: reason ?? undefined }] })
      .where(eq(customerDocuments.id, doc.id));

    if (status === "REJECTED" && c?.userId) {
      const [u] = await tx.select({ status: users.status }).from(users).where(eq(users.id, c.userId));
      if (u?.status === "UNDER_REVIEW" || u?.status === "PROFILE_COMPLETE") {
        assertTransition(u.status, "PROFILE_INCOMPLETE");
        await tx.update(users).set({ status: "PROFILE_INCOMPLETE" }).where(eq(users.id, c.userId));
      }
      await notify(tx, {
        companyId: ctx.companyId, userId: c.userId, topic: "document",
        title: `${DOCUMENT_LABELS[doc.type] ?? "Documento"} precisa ser reenviado`, body: reason!, link: "/cadastro",
      });
    }
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: `customer.document.${status.toLowerCase()}`, entity: "customer_documents", entityId: doc.id, oldValue: { status: doc.status }, newValue: { status, reason }, meta });
    return { status, email: c?.email, label: DOCUMENT_LABELS[doc.type] ?? doc.type, reason };
  });
  if (result.status === "REJECTED" && result.email)
    await deps.mailer.send({ to: result.email, subject: "Foccus Car: documento precisa ser reenviado", text: `${result.label}: ${result.reason}\n\nEnvie novamente pelo app em Meu cadastro.` }).catch(() => {});
  return { status: result.status };
}

/** Libera a conta (UNDER_REVIEW → ACTIVE) quando todos os documentos exigidos estão aprovados e a CNH é válida. */
export async function approveAccount(deps: ServiceDeps, ctx: AccessContext, customerId: string, meta?: RequestMeta) {
  const detail = await getReviewDetail(deps, ctx, customerId);
  if (detail.account.status !== "UNDER_REVIEW") throw new ServiceError("Este cadastro não está aguardando análise.", 409, "NOT_UNDER_REVIEW");
  if (!detail.progress.allRequiredApproved) throw new ServiceError("Aprove todos os documentos obrigatórios antes de liberar a conta.", 422, "DOCUMENTS_PENDING");
  if (!detail.cnh?.expiresAt || new Date(detail.cnh.expiresAt) < new Date()) throw new ServiceError("A CNH do cliente está vencida.", 422, "CNH_EXPIRED");

  await withTenant(deps.db, ctx, async (tx) => {
    const [c] = await tx.select({ userId: customers.userId }).from(customers).where(eq(customers.id, customerId));
    if (c!.userId === ctx.userId) throw new ServiceError("Você não pode aprovar o seu próprio cadastro.", 403, "SELF_REVIEW");
    assertTransition("UNDER_REVIEW", "ACTIVE");
    const updated = await tx.update(users).set({ status: "ACTIVE" }).where(and(eq(users.id, c!.userId!), eq(users.status, "UNDER_REVIEW"))).returning({ id: users.id });
    if (!updated.length) throw new ServiceError("O cadastro mudou enquanto você analisava. Atualize a página.", 409, "CONFLICT");
    await notify(tx, { companyId: ctx.companyId, userId: c!.userId!, topic: "document", title: "Cadastro aprovado", body: "Tudo certo! Você já pode reservar e alugar veículos.", link: "/" });
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "customer.account.approve", entity: "users", entityId: c!.userId!, oldValue: { status: "UNDER_REVIEW" }, newValue: { status: "ACTIVE" }, meta });
  });
  if (detail.customer.email)
    await deps.mailer.send({ to: detail.customer.email, subject: "Foccus Car: cadastro aprovado", text: "Seu cadastro foi aprovado. Você já pode reservar e alugar veículos." }).catch(() => {});
  return { status: "ACTIVE" as const };
}

