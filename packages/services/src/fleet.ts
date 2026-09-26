import { randomUUID } from "node:crypto";
import {
  ADMIN_BLOCK_NOTE, CRITICAL_VEHICLE_FIELDS, STATUS_NEEDS_REASON, VEHICLE_DOCUMENT_LABELS, VEHICLE_DOCUMENT_TYPES, VEHICLE_FIELD_LABELS,
  VEHICLE_STATUSES, VEHICLE_STATUS_LABELS, authorize, dateOnly, checkManualStatusChange, documentExpiry, formatPlate, normalizePlate,
  vehicleInputSchema, type AccessContext, type VehicleData, type VehicleEventType, type VehicleStatus,
} from "@foccus/core";
import {
  locations, rentals, reservations, users, vehicleCategories, vehicleDocuments, vehicleEvents, vehicleHistory, vehiclePhotos, vehicles, withTenant, type Tx,
} from "@foccus/db";
import { buildStorageKey, contentTypeFromKey, sniffMime, validateUploadRequest } from "@foccus/integrations";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { audit } from "./audit";
import { ServiceError, type RequestMeta, type ServiceDeps } from "./deps";

const uuid = z.uuid();
const PAGE = 20;
const ACTIVE_RESERVATION = ["PENDING_PAYMENT", "CONFIRMED"] as const;
const ACTIVE_RENTAL = ["SCHEDULED", "CHECKOUT_IN_PROGRESS", "ACTIVE", "RETURN_IN_PROGRESS", "PENDING_SETTLEMENT"] as const;

function notFound(): never {
  throw new ServiceError("Veículo não encontrado.", 404, "NOT_FOUND");
}

async function loadVehicle(tx: Tx, id: string) {
  if (!uuid.safeParse(id).success) notFound();
  const [v] = await tx.select().from(vehicles).where(and(eq(vehicles.id, id), isNull(vehicles.deletedAt)));
  return v ?? notFound();
}

/** Grava um fato na Vida do Veículo (seção 31). Tabela imutável: só inserção. */
export async function recordVehicleEvent(
  tx: Tx,
  e: { companyId: string; vehicleId: string; type: VehicleEventType; description: string; source: string; actorUserId?: string | null; km?: number | null; amountCents?: number | null; refTable?: string; refId?: string; data?: Record<string, unknown> },
) {
  await tx.insert(vehicleEvents).values({
    companyId: e.companyId, vehicleId: e.vehicleId, type: e.type, description: e.description, source: e.source,
    actorUserId: e.actorUserId ?? null, km: e.km ?? null, amountCents: e.amountCents ?? null,
    refTable: e.refTable ?? null, refId: e.refId ?? null, data: e.data ?? {},
  });
}

function plateConflict(err: unknown): never {
  const code = (err as { code?: string; cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
  if (code === "23505") throw new ServiceError("Já existe um veículo com esta placa.", 409, "PLATE_TAKEN", { plate: "Placa já cadastrada." });
  throw err;
}

// ─── Listagem ───────────────────────────────────────────────────────────────

export const vehicleListFiltersSchema = z.object({
  q: z.string().trim().max(60).optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  categoria: z.union([z.literal(""), z.uuid()]).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

/** Frota no painel: busca por placa/marca/modelo, filtros combináveis e paginação (seções 96, 107, 108). */
export async function listVehicles(deps: ServiceDeps, ctx: AccessContext, rawFilters: unknown) {
  authorize(ctx, { permission: "vehicles:view", companyId: ctx.companyId });
  const f = vehicleListFiltersSchema.parse(rawFilters ?? {});
  return withTenant(deps.db, ctx, async (tx) => {
    const where: SQL[] = [isNull(vehicles.deletedAt)];
    if (f.status) where.push(eq(vehicles.status, f.status));
    if (f.categoria) where.push(eq(vehicles.categoryId, f.categoria));
    if (f.q) {
      const term = `%${f.q.replace(/[%_\\]/g, "")}%`;
      const plate = normalizePlate(f.q);
      where.push(or(ilike(vehicles.brand, term), ilike(vehicles.model, term), ilike(vehicles.version, term), ...(plate ? [ilike(vehicles.plate, `%${plate}%`)] : []))!);
    }
    const rows = await tx
      .select({ v: vehicles, category: vehicleCategories.name, location: locations.name })
      .from(vehicles)
      .leftJoin(vehicleCategories, eq(vehicleCategories.id, vehicles.categoryId))
      .leftJoin(locations, eq(locations.id, vehicles.locationId))
      .where(and(...where))
      .orderBy(asc(vehicles.brand), asc(vehicles.model), asc(vehicles.plate))
      .limit(PAGE + 1)
      .offset((f.pagina - 1) * PAGE);
    const page = rows.slice(0, PAGE);
    const ids = page.map((r) => r.v.id);
    const now = new Date();
    const [covers, docs, statusCounts, categories] = await Promise.all([
      ids.length ? tx.select({ id: vehiclePhotos.id, vehicleId: vehiclePhotos.vehicleId }).from(vehiclePhotos).where(and(inArray(vehiclePhotos.vehicleId, ids), eq(vehiclePhotos.isCover, true), isNull(vehiclePhotos.deletedAt))) : [],
      ids.length ? tx.select({ vehicleId: vehicleDocuments.vehicleId, expiresAt: vehicleDocuments.expiresAt }).from(vehicleDocuments).where(and(inArray(vehicleDocuments.vehicleId, ids), isNull(vehicleDocuments.deletedAt), isNotNull(vehicleDocuments.expiresAt))) : [],
      tx.select({ status: vehicles.status, n: count() }).from(vehicles).where(isNull(vehicles.deletedAt)).groupBy(vehicles.status),
      tx.select({ id: vehicleCategories.id, name: vehicleCategories.name }).from(vehicleCategories).where(isNull(vehicleCategories.deletedAt)).orderBy(asc(vehicleCategories.name)),
    ]);
    return {
      items: page.map(({ v, category, location }) => {
        const states = docs.filter((d) => d.vehicleId === v.id).map((d) => documentExpiry(d.expiresAt, now).state);
        return {
          id: v.id, plate: formatPlate(v.plate), brand: v.brand, model: v.model, version: v.version, modelYear: v.modelYear, color: v.color,
          category, location, status: v.status, statusLabel: VEHICLE_STATUS_LABELS[v.status], currentKm: v.currentKm,
          dailyRateCents: v.dailyRateCents, showcaseVisible: v.showcaseVisible,
          coverPhotoId: covers.find((c) => c.vehicleId === v.id)?.id ?? null,
          documentAlert: states.includes("EXPIRED") ? "EXPIRED" : states.includes("EXPIRING") ? "EXPIRING" : null,
        };
      }),
      hasMore: rows.length > PAGE,
      page: f.pagina,
      counts: Object.fromEntries(statusCounts.map((s) => [s.status, Number(s.n)])) as Partial<Record<VehicleStatus, number>>,
      categories,
    };
  });
}

/** Opções dos formulários: categorias e localizações da empresa. */
export async function getFleetOptions(deps: ServiceDeps, ctx: AccessContext) {
  authorize(ctx, { permission: "vehicles:view", companyId: ctx.companyId });
  return withTenant(deps.db, ctx, async (tx) => ({
    categories: await tx.select({ id: vehicleCategories.id, name: vehicleCategories.name, requiredCnhCategory: vehicleCategories.requiredCnhCategory }).from(vehicleCategories).where(isNull(vehicleCategories.deletedAt)).orderBy(asc(vehicleCategories.name)),
    locations: await tx.select({ id: locations.id, name: locations.name, city: locations.city, state: locations.state }).from(locations).where(isNull(locations.deletedAt)).orderBy(asc(locations.name)),
  }));
}

// ─── Detalhe ────────────────────────────────────────────────────────────────

export async function getVehicle(deps: ServiceDeps, ctx: AccessContext, id: string) {
  authorize(ctx, { permission: "vehicles:view", companyId: ctx.companyId });
  return withTenant(deps.db, ctx, async (tx) => {
    const v = await loadVehicle(tx, id);
    const now = new Date();
    const [photos, docs, nextRes, activeRental, cat, loc] = await Promise.all([
      tx.select().from(vehiclePhotos).where(and(eq(vehiclePhotos.vehicleId, v.id), isNull(vehiclePhotos.deletedAt))).orderBy(desc(vehiclePhotos.isCover), asc(vehiclePhotos.position), asc(vehiclePhotos.createdAt)),
      tx.select().from(vehicleDocuments).where(and(eq(vehicleDocuments.vehicleId, v.id), isNull(vehicleDocuments.deletedAt))).orderBy(asc(vehicleDocuments.expiresAt)),
      tx.select({ id: reservations.id, pickupAt: reservations.pickupAt, returnAt: reservations.returnAt }).from(reservations)
        .where(and(eq(reservations.vehicleId, v.id), inArray(reservations.status, [...ACTIVE_RESERVATION]), gte(reservations.returnAt, now))).orderBy(asc(reservations.pickupAt)).limit(1),
      tx.select({ id: rentals.id, expectedReturnAt: rentals.expectedReturnAt }).from(rentals).where(and(eq(rentals.vehicleId, v.id), inArray(rentals.status, [...ACTIVE_RENTAL]))).limit(1),
      v.categoryId ? tx.select({ name: vehicleCategories.name }).from(vehicleCategories).where(eq(vehicleCategories.id, v.categoryId)) : [],
      v.locationId ? tx.select({ name: locations.name }).from(locations).where(eq(locations.id, v.locationId)) : [],
    ]);
    return {
      vehicle: {
        ...v, plateFormatted: formatPlate(v.plate), statusLabel: VEHICLE_STATUS_LABELS[v.status],
        category: cat[0]?.name ?? null, location: loc[0]?.name ?? null,
      },
      photos: photos.map((p) => ({ id: p.id, isCover: p.isCover, isPublic: p.isPublic, alt: p.alt, createdAt: p.createdAt })),
      documents: docs.map((d) => ({
        id: d.id, type: d.type, label: VEHICLE_DOCUMENT_LABELS[d.type as keyof typeof VEHICLE_DOCUMENT_LABELS] ?? d.type, number: d.number,
        issuedAt: d.issuedAt, expiresAt: d.expiresAt, costCents: d.costCents, hasFile: Boolean(d.storageKey),
        ...documentExpiry(d.expiresAt, now),
      })),
      nextReservation: nextRes[0] ?? null,
      activeRental: activeRental[0] ?? null,
      blockNote: v.status === "BLOCKED" ? ADMIN_BLOCK_NOTE : null,
    };
  });
}

// ─── Cadastro e edição ──────────────────────────────────────────────────────

async function assertRefs(tx: Tx, data: Pick<VehicleData, "categoryId" | "locationId">) {
  if (data.categoryId) {
    const [c] = await tx.select({ id: vehicleCategories.id }).from(vehicleCategories).where(and(eq(vehicleCategories.id, data.categoryId), isNull(vehicleCategories.deletedAt)));
    if (!c) throw new ServiceError("Categoria inválida.", 422, "VALIDATION", { categoryId: "Escolha uma categoria da lista." });
  }
  if (data.locationId) {
    const [l] = await tx.select({ id: locations.id }).from(locations).where(and(eq(locations.id, data.locationId), isNull(locations.deletedAt)));
    if (!l) throw new ServiceError("Localização inválida.", 422, "VALIDATION", { locationId: "Escolha uma localização da lista." });
  }
}

/**
 * Entrada na frota: o veículo começa INACTIVE (fora da vitrine e sem reservas)
 * até alguém conferir fotos e documentos e marcá-lo como disponível.
 */
export async function createVehicle(deps: ServiceDeps, ctx: AccessContext, input: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "vehicles:manage", companyId: ctx.companyId });
  const data = vehicleInputSchema.parse(input);
  return withTenant(deps.db, ctx, async (tx) => {
    await assertRefs(tx, data);
    const [v] = await tx
      .insert(vehicles)
      .values({ ...data, companyId: ctx.companyId, status: "INACTIVE", showcaseVisible: false, createdBy: ctx.userId, updatedBy: ctx.userId })
      .returning()
      .catch(plateConflict);
    await recordVehicleEvent(tx, {
      companyId: ctx.companyId, vehicleId: v!.id, type: "FLEET_ENTRY", source: "admin", actorUserId: ctx.userId, km: v!.currentKm,
      amountCents: v!.acquisitionCents, description: `Entrada na frota: ${v!.brand} ${v!.model} ${v!.modelYear}, placa ${formatPlate(v!.plate)}, ${v!.currentKm.toLocaleString("pt-BR")} km.`,
    });
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "vehicle.create", entity: "vehicles", entityId: v!.id, newValue: data, meta });
    return { id: v!.id };
  });
}

const updateSchema = z.object({ data: z.unknown(), reason: z.string().trim().max(300).optional() });

function same(a: unknown, b: unknown) {
  if (a instanceof Date || b instanceof Date) return (a ? new Date(a as Date).getTime() : null) === (b ? new Date(b as Date).getTime() : null);
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Edição com histórico campo a campo (vehicle_history) e evento na Vida do Veículo.
 * Dados críticos (placa, chassi, RENAVAM, KM, aquisição) exigem motivo.
 */
export async function updateVehicle(deps: ServiceDeps, ctx: AccessContext, id: string, input: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "vehicles:manage", companyId: ctx.companyId });
  const { data: raw, reason } = updateSchema.parse(input);
  const data = vehicleInputSchema.parse(raw);
  return withTenant(deps.db, ctx, async (tx) => {
    const v = await loadVehicle(tx, id);
    await assertRefs(tx, data);
    const changed = (Object.keys(data) as (keyof VehicleData)[]).filter((k) => !same(v[k as keyof typeof v], data[k]));
    if (!changed.length) return { id: v.id, changed: [] as string[] };
    const critical = changed.filter((k) => (CRITICAL_VEHICLE_FIELDS as readonly string[]).includes(k));
    if (critical.length && (!reason || reason.length < 5))
      throw new ServiceError(`Informe o motivo da alteração de ${critical.map((k) => VEHICLE_FIELD_LABELS[k]).join(", ")}.`, 422, "REASON_REQUIRED");
    if (data.showcaseVisible && !v.showcaseVisible && (v.status === "INACTIVE" || v.status === "BLOCKED"))
      throw new ServiceError("Deixe o veículo disponível antes de mostrá-lo na vitrine.", 422, "NOT_AVAILABLE", { showcaseVisible: "Veículo inativo ou bloqueado." });

    await tx.update(vehicles).set({ ...data, updatedBy: ctx.userId }).where(eq(vehicles.id, v.id)).catch(plateConflict);
    await tx.insert(vehicleHistory).values(changed.map((k) => ({
      companyId: ctx.companyId, vehicleId: v.id, field: k, oldValue: (v[k as keyof typeof v] ?? null) as never, newValue: (data[k] ?? null) as never, changedBy: ctx.userId, reason: reason || null,
    })));
    const labels = changed.map((k) => VEHICLE_FIELD_LABELS[k] ?? k);
    await recordVehicleEvent(tx, {
      companyId: ctx.companyId, vehicleId: v.id, type: changed.includes("currentKm") && changed.length === 1 ? "MILEAGE" : "ADMIN_CHANGE",
      source: "admin", actorUserId: ctx.userId, km: data.currentKm,
      description: `Cadastro alterado: ${labels.join(", ")}.${reason ? ` Motivo: ${reason}` : ""}`,
      data: { fields: changed },
    });
    const pick = (o: Record<string, unknown>) => Object.fromEntries(changed.map((k) => [k, o[k] ?? null]));
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "vehicle.update", entity: "vehicles", entityId: v.id, oldValue: pick(v), newValue: { ...pick(data), reason }, meta });
    return { id: v.id, changed };
  });
}

export const statusChangeSchema = z.object({
  status: z.enum(VEHICLE_STATUSES),
  reason: z.string().trim().max(300).optional(),
});

/** Mudança manual de status com regra, motivo e confirmação (seções 30 e 104). */
export async function changeVehicleStatus(deps: ServiceDeps, ctx: AccessContext, id: string, input: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "vehicles:manage", companyId: ctx.companyId });
  const { status, reason } = statusChangeSchema.parse(input);
  return withTenant(deps.db, ctx, async (tx) => {
    const v = await loadVehicle(tx, id);
    const check = checkManualStatusChange(v.status, status);
    if (!check.ok) throw new ServiceError(check.reason, 409, "INVALID_STATUS");
    if (STATUS_NEEDS_REASON.includes(status) && (!reason || reason.length < 5))
      throw new ServiceError("Explique o motivo (mínimo 5 caracteres).", 422, "REASON_REQUIRED", { reason: "Informe o motivo." });
    if (status === "INACTIVE" || status === "BLOCKED") {
      const [pending] = await tx.select({ n: count() }).from(reservations)
        .where(and(eq(reservations.vehicleId, v.id), inArray(reservations.status, [...ACTIVE_RESERVATION]), gte(reservations.returnAt, new Date())));
      if (Number(pending?.n ?? 0) > 0)
        throw new ServiceError("Há reservas confirmadas para este veículo. Remaneje as reservas antes de retirá-lo de operação.", 409, "HAS_RESERVATIONS");
    }
    const hideShowcase = status === "INACTIVE" || status === "BLOCKED";
    const updated = await tx
      .update(vehicles)
      .set({ status, updatedBy: ctx.userId, ...(hideShowcase ? { showcaseVisible: false } : {}) })
      .where(and(eq(vehicles.id, v.id), eq(vehicles.status, v.status)))
      .returning({ id: vehicles.id });
    if (!updated.length) throw new ServiceError("O status mudou enquanto você editava. Atualize a página.", 409, "CONFLICT");
    await tx.insert(vehicleHistory).values({ companyId: ctx.companyId, vehicleId: v.id, field: "status", oldValue: v.status, newValue: status, changedBy: ctx.userId, reason: reason || null });
    const type: VehicleEventType = status === "BLOCKED" ? "BLOCK" : v.status === "BLOCKED" ? "UNBLOCK" : "STATUS_CHANGE";
    await recordVehicleEvent(tx, {
      companyId: ctx.companyId, vehicleId: v.id, type, source: "admin", actorUserId: ctx.userId, km: v.currentKm,
      description: `${VEHICLE_STATUS_LABELS[v.status]} → ${VEHICLE_STATUS_LABELS[status]}.${reason ? ` Motivo: ${reason}` : ""}${type === "BLOCK" ? " (bloqueio administrativo, sem comando ao rastreador)" : ""}`,
      data: { from: v.status, to: status },
    });
    await audit(tx, {
      companyId: ctx.companyId, actorUserId: ctx.userId, action: type === "BLOCK" ? "vehicle.block" : type === "UNBLOCK" ? "vehicle.unblock" : "vehicle.status",
      entity: "vehicles", entityId: v.id, oldValue: { status: v.status }, newValue: { status, reason }, meta,
    });
    return { status, statusLabel: VEHICLE_STATUS_LABELS[status] };
  });
}

// ─── Fotos ──────────────────────────────────────────────────────────────────

const photoUploadSchema = z.object({ fileName: z.string().min(1).max(200), contentType: z.string(), bytes: z.instanceof(Uint8Array) });
const MAX_PHOTOS = 20;

/** Foto do veículo (seção 29/99): valida tipo e conteúdo real, guarda no storage e registra na Vida do Veículo. */
export async function uploadVehiclePhoto(deps: ServiceDeps, ctx: AccessContext, vehicleId: string, input: z.infer<typeof photoUploadSchema>, meta?: RequestMeta) {
  authorize(ctx, { permission: "vehicles:manage", companyId: ctx.companyId });
  const file = photoUploadSchema.parse(input);
  const problem = validateUploadRequest("photo", { name: file.fileName, contentType: file.contentType, sizeBytes: file.bytes.byteLength });
  if (problem) throw new ServiceError(problem, 422, "INVALID_FILE");
  if (sniffMime(file.bytes) !== file.contentType) throw new ServiceError("O arquivo não é uma imagem válida.", 422, "INVALID_FILE");
  return withTenant(deps.db, ctx, async (tx) => {
    const v = await loadVehicle(tx, vehicleId);
    const [n] = await tx.select({ n: count() }).from(vehiclePhotos).where(and(eq(vehiclePhotos.vehicleId, v.id), isNull(vehiclePhotos.deletedAt)));
    const total = Number(n?.n ?? 0);
    if (total >= MAX_PHOTOS) throw new ServiceError(`Limite de ${MAX_PHOTOS} fotos por veículo. Remova uma antes de enviar outra.`, 409, "TOO_MANY");
    const id = randomUUID();
    const key = buildStorageKey(ctx.companyId, `vehicles/${v.id}/photos`, id, file.contentType);
    await deps.storage.put(key, file.bytes, file.contentType);
    await tx.insert(vehiclePhotos).values({ id, companyId: ctx.companyId, vehicleId: v.id, storageKey: key, position: total, isCover: total === 0, alt: `${v.brand} ${v.model}` });
    await recordVehicleEvent(tx, { companyId: ctx.companyId, vehicleId: v.id, type: "PHOTO", source: "admin", actorUserId: ctx.userId, description: "Foto adicionada ao cadastro.", refTable: "vehicle_photos", refId: id });
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "vehicle.photo.add", entity: "vehicle_photos", entityId: id, newValue: { vehicleId: v.id, key }, meta });
    return { id, isCover: total === 0 };
  });
}

export const photoUpdateSchema = z.object({ isCover: z.literal(true).optional(), isPublic: z.boolean().optional() });

export async function updateVehiclePhoto(deps: ServiceDeps, ctx: AccessContext, photoId: string, input: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "vehicles:manage", companyId: ctx.companyId });
  if (!uuid.safeParse(photoId).success) throw new ServiceError("Foto não encontrada.", 404, "NOT_FOUND");
  const body = photoUpdateSchema.parse(input);
  return withTenant(deps.db, ctx, async (tx) => {
    const [p] = await tx.select().from(vehiclePhotos).where(and(eq(vehiclePhotos.id, photoId), isNull(vehiclePhotos.deletedAt)));
    if (!p) throw new ServiceError("Foto não encontrada.", 404, "NOT_FOUND");
    if (body.isCover) {
      await tx.update(vehiclePhotos).set({ isCover: false }).where(eq(vehiclePhotos.vehicleId, p.vehicleId));
      await tx.update(vehiclePhotos).set({ isCover: true, isPublic: true }).where(eq(vehiclePhotos.id, p.id));
    }
    if (body.isPublic !== undefined) {
      if (!body.isPublic && (p.isCover || body.isCover)) throw new ServiceError("A foto de capa aparece na vitrine. Escolha outra capa antes de ocultá-la.", 409, "COVER_PUBLIC");
      await tx.update(vehiclePhotos).set({ isPublic: body.isPublic }).where(eq(vehiclePhotos.id, p.id));
    }
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "vehicle.photo.update", entity: "vehicle_photos", entityId: p.id, oldValue: { isCover: p.isCover, isPublic: p.isPublic }, newValue: body, meta });
    return { ok: true };
  });
}

/** Remoção lógica: a foto sai do cadastro, mas o registro permanece (seção 105). */
export async function removeVehiclePhoto(deps: ServiceDeps, ctx: AccessContext, photoId: string, meta?: RequestMeta) {
  authorize(ctx, { permission: "vehicles:manage", companyId: ctx.companyId });
  if (!uuid.safeParse(photoId).success) throw new ServiceError("Foto não encontrada.", 404, "NOT_FOUND");
  return withTenant(deps.db, ctx, async (tx) => {
    const [p] = await tx.select().from(vehiclePhotos).where(and(eq(vehiclePhotos.id, photoId), isNull(vehiclePhotos.deletedAt)));
    if (!p) throw new ServiceError("Foto não encontrada.", 404, "NOT_FOUND");
    await tx.update(vehiclePhotos).set({ deletedAt: new Date(), isCover: false }).where(eq(vehiclePhotos.id, p.id));
    if (p.isCover) {
      const [next] = await tx.select({ id: vehiclePhotos.id }).from(vehiclePhotos).where(and(eq(vehiclePhotos.vehicleId, p.vehicleId), isNull(vehiclePhotos.deletedAt))).orderBy(asc(vehiclePhotos.position)).limit(1);
      if (next) await tx.update(vehiclePhotos).set({ isCover: true, isPublic: true }).where(eq(vehiclePhotos.id, next.id));
    }
    await recordVehicleEvent(tx, { companyId: ctx.companyId, vehicleId: p.vehicleId, type: "PHOTO", source: "admin", actorUserId: ctx.userId, description: "Foto removida do cadastro.", refTable: "vehicle_photos", refId: p.id });
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "vehicle.photo.remove", entity: "vehicle_photos", entityId: p.id, oldValue: { vehicleId: p.vehicleId }, meta });
    return { ok: true };
  });
}

/**
 * Leitura de foto. Pública só se a foto for pública e o veículo estiver na vitrine;
 * as demais exigem permissão de ver a frota.
 */
export async function readVehiclePhoto(deps: ServiceDeps, companyId: string, ctx: AccessContext | null, photoId: string) {
  if (!uuid.safeParse(photoId).success) throw new ServiceError("Foto não encontrada.", 404, "NOT_FOUND");
  const row = await withTenant(deps.db, { companyId }, async (tx) => {
    const [r] = await tx
      .select({ key: vehiclePhotos.storageKey, isPublic: vehiclePhotos.isPublic, visible: vehicles.showcaseVisible })
      .from(vehiclePhotos).innerJoin(vehicles, eq(vehicles.id, vehiclePhotos.vehicleId))
      .where(and(eq(vehiclePhotos.id, photoId), isNull(vehiclePhotos.deletedAt), isNull(vehicles.deletedAt)));
    return r;
  });
  if (!row) throw new ServiceError("Foto não encontrada.", 404, "NOT_FOUND");
  const isPublic = row.isPublic && row.visible;
  if (!isPublic) {
    if (!ctx) throw new ServiceError("Foto não encontrada.", 404, "NOT_FOUND");
    authorize(ctx, { permission: "vehicles:view", companyId });
  }
  const file = await deps.storage.get(row.key);
  if (!file) throw new ServiceError("Arquivo indisponível no momento.", 404, "FILE_MISSING");
  return { bytes: file.bytes, contentType: contentTypeFromKey(row.key), isPublic };
}

// ─── Documentos da frota ────────────────────────────────────────────────────


export const vehicleDocumentSchema = z.object({
  type: z.enum(VEHICLE_DOCUMENT_TYPES, { error: "Escolha o tipo de documento." }),
  number: z.string().trim().max(60).optional().transform((v) => v || null),
  issuedAt: dateOnly,
  expiresAt: dateOnly,
  costCents: z.union([z.literal(""), z.null(), z.coerce.number().int().min(0)]).optional().transform((v) => (v === "" || v == null ? null : v)),
}).refine((d) => !d.issuedAt || !d.expiresAt || d.expiresAt > d.issuedAt, { message: "O vencimento deve ser depois da emissão.", path: ["expiresAt"] });

/** Documento da frota (seção 74): CRLV, licenciamento, seguro, IPVA, notas, contratos. Arquivo opcional. */
export async function addVehicleDocument(
  deps: ServiceDeps, ctx: AccessContext, vehicleId: string, input: unknown,
  file?: { fileName: string; contentType: string; bytes: Uint8Array } | null, meta?: RequestMeta,
) {
  authorize(ctx, { permission: "vehicles:manage", companyId: ctx.companyId });
  const data = vehicleDocumentSchema.parse(input);
  if (file) {
    const problem = validateUploadRequest("document", { name: file.fileName, contentType: file.contentType, sizeBytes: file.bytes.byteLength });
    if (problem) throw new ServiceError(problem, 422, "INVALID_FILE");
    if (sniffMime(file.bytes) !== file.contentType) throw new ServiceError("O conteúdo do arquivo não corresponde a uma imagem ou PDF válido.", 422, "INVALID_FILE");
  }
  return withTenant(deps.db, ctx, async (tx) => {
    const v = await loadVehicle(tx, vehicleId);
    const id = randomUUID();
    let storageKey: string | null = null;
    if (file) {
      storageKey = buildStorageKey(ctx.companyId, `vehicles/${v.id}/documents`, id, file.contentType);
      await deps.storage.put(storageKey, file.bytes, file.contentType);
    }
    await tx.insert(vehicleDocuments).values({ id, companyId: ctx.companyId, vehicleId: v.id, ...data, storageKey, status: "APPROVED", createdBy: ctx.userId, updatedBy: ctx.userId });
    const label = VEHICLE_DOCUMENT_LABELS[data.type];
    await recordVehicleEvent(tx, {
      companyId: ctx.companyId, vehicleId: v.id, type: "DOCUMENT", source: "admin", actorUserId: ctx.userId, amountCents: data.costCents,
      description: `${label} registrado${data.expiresAt ? `, vence em ${data.expiresAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : ""}.`,
      refTable: "vehicle_documents", refId: id,
    });
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "vehicle.document.add", entity: "vehicle_documents", entityId: id, newValue: { ...data, vehicleId: v.id, hasFile: Boolean(file) }, meta });
    return { id };
  });
}

/** Arquiva um documento (substituído ou lançado errado). Continua no histórico. */
export async function archiveVehicleDocument(deps: ServiceDeps, ctx: AccessContext, documentId: string, reason: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "vehicles:manage", companyId: ctx.companyId });
  if (!uuid.safeParse(documentId).success) throw new ServiceError("Documento não encontrado.", 404, "NOT_FOUND");
  const why = z.string().trim().min(5, "Informe o motivo (mínimo 5 caracteres).").max(300).parse(reason);
  return withTenant(deps.db, ctx, async (tx) => {
    const [d] = await tx.select().from(vehicleDocuments).where(and(eq(vehicleDocuments.id, documentId), isNull(vehicleDocuments.deletedAt)));
    if (!d) throw new ServiceError("Documento não encontrado.", 404, "NOT_FOUND");
    await tx.update(vehicleDocuments).set({ deletedAt: new Date(), updatedBy: ctx.userId }).where(eq(vehicleDocuments.id, d.id));
    const label = VEHICLE_DOCUMENT_LABELS[d.type as keyof typeof VEHICLE_DOCUMENT_LABELS] ?? d.type;
    await recordVehicleEvent(tx, { companyId: ctx.companyId, vehicleId: d.vehicleId, type: "DOCUMENT", source: "admin", actorUserId: ctx.userId, description: `${label} arquivado. Motivo: ${why}`, refTable: "vehicle_documents", refId: d.id });
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "vehicle.document.archive", entity: "vehicle_documents", entityId: d.id, oldValue: { type: d.type, expiresAt: d.expiresAt }, newValue: { reason: why }, meta });
    return { ok: true };
  });
}

export async function readVehicleDocumentFile(deps: ServiceDeps, ctx: AccessContext, documentId: string) {
  authorize(ctx, { permission: "vehicles:view", companyId: ctx.companyId });
  if (!uuid.safeParse(documentId).success) throw new ServiceError("Documento não encontrado.", 404, "NOT_FOUND");
  const d = await withTenant(deps.db, ctx, async (tx) => (await tx.select().from(vehicleDocuments).where(eq(vehicleDocuments.id, documentId)))[0]);
  if (!d?.storageKey) throw new ServiceError("Documento sem arquivo anexado.", 404, "NOT_FOUND");
  const file = await deps.storage.get(d.storageKey);
  if (!file) throw new ServiceError("Arquivo indisponível no momento.", 404, "FILE_MISSING");
  return { bytes: file.bytes, contentType: contentTypeFromKey(d.storageKey), fileName: `${d.type.toLowerCase()}.${d.storageKey.split(".").pop()}` };
}

/** Painel de documentos da frota: vencidos e a vencer em até `days` dias (seção 74). */
export async function listFleetDocumentAlerts(deps: ServiceDeps, ctx: AccessContext, days = 30) {
  authorize(ctx, { permission: "vehicles:view", companyId: ctx.companyId });
  return withTenant(deps.db, ctx, async (tx) => {
    const now = new Date();
    const limit = new Date(now.getTime() + days * 86_400_000);
    const rows = await tx
      .select({ d: vehicleDocuments, plate: vehicles.plate, brand: vehicles.brand, model: vehicles.model })
      .from(vehicleDocuments).innerJoin(vehicles, eq(vehicles.id, vehicleDocuments.vehicleId))
      .where(and(isNull(vehicleDocuments.deletedAt), isNull(vehicles.deletedAt), isNotNull(vehicleDocuments.expiresAt), lte(vehicleDocuments.expiresAt, limit)))
      .orderBy(asc(vehicleDocuments.expiresAt))
      .limit(200);
    return rows.map(({ d, plate, brand, model }) => ({
      id: d.id, vehicleId: d.vehicleId, vehicle: `${brand} ${model}`, plate: formatPlate(plate), type: d.type,
      label: VEHICLE_DOCUMENT_LABELS[d.type as keyof typeof VEHICLE_DOCUMENT_LABELS] ?? d.type, expiresAt: d.expiresAt!,
      ...documentExpiry(d.expiresAt, now, days),
    }));
  });
}

// ─── Vida do Veículo ────────────────────────────────────────────────────────

export const timelineFiltersSchema = z.object({
  tipo: z.string().max(30).optional(),
  /** Cursor "ISO|id" do último evento da página anterior. */
  antes: z.string().regex(/^[^|]+\|[0-9a-f-]{36}$/).optional(),
});

/** Linha do tempo completa do veículo (seções 31 e 112), mais recente primeiro, paginada por cursor. */
export async function getVehicleTimeline(deps: ServiceDeps, ctx: AccessContext, vehicleId: string, rawFilters?: unknown) {
  authorize(ctx, { permission: "vehicles:history.view", companyId: ctx.companyId });
  const f = timelineFiltersSchema.parse(rawFilters ?? {});
  return withTenant(deps.db, ctx, async (tx) => {
    const v = await loadVehicle(tx, vehicleId);
    const where: SQL[] = [eq(vehicleEvents.vehicleId, v.id)];
    if (f.tipo) where.push(sql`${vehicleEvents.type}::text = ${f.tipo}`);
    if (f.antes) {
      const [at, lastId] = f.antes.split("|") as [string, string];
      const t = new Date(at);
      if (!Number.isNaN(t.getTime())) where.push(sql`(date_trunc('milliseconds', ${vehicleEvents.occurredAt}), ${vehicleEvents.id}) < (${t.toISOString()}::timestamptz, ${lastId}::uuid)`);
    }
    const rows = await tx
      .select({ e: vehicleEvents, actor: users.name })
      .from(vehicleEvents).leftJoin(users, eq(users.id, vehicleEvents.actorUserId))
      .where(and(...where))
      .orderBy(desc(sql`date_trunc('milliseconds', ${vehicleEvents.occurredAt})`), desc(vehicleEvents.id))
      .limit(PAGE + 1);
    const page = rows.slice(0, PAGE);
    return {
      events: page.map(({ e, actor }) => ({
        id: e.id, type: e.type, occurredAt: e.occurredAt, description: e.description, source: e.source,
        actor: actor ?? "Sistema", km: e.km, amountCents: e.amountCents,
      })),
      nextCursor: rows.length > PAGE ? `${page[page.length - 1]!.e.occurredAt.toISOString()}|${page[page.length - 1]!.e.id}` : null,
    };
  });
}

// ─── Categorias e localizações ─────────────────────────────────────────────

const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  requiredCnhCategory: z.string().trim().toUpperCase().regex(/^(A|B|C|D|E|AB|AC|AD|AE)$/, "Categoria de CNH inválida.").default("B"),
  description: z.string().trim().max(200).optional().transform((v) => v || null),
});

export async function createCategory(deps: ServiceDeps, ctx: AccessContext, input: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "vehicles:manage", companyId: ctx.companyId });
  const data = categorySchema.parse(input);
  return withTenant(deps.db, ctx, async (tx) => {
    const [c] = await tx.insert(vehicleCategories).values({ ...data, slug: slugify(data.name), companyId: ctx.companyId }).returning()
      .catch((err) => {
        if ((err as { cause?: { code?: string } })?.cause?.code === "23505") throw new ServiceError("Já existe uma categoria com este nome.", 409, "DUPLICATE", { name: "Nome já usado." });
        throw err;
      });
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "vehicle_category.create", entity: "vehicle_categories", entityId: c!.id, newValue: data, meta });
    return { id: c!.id };
  });
}

export const locationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  address: z.string().trim().max(200).optional().transform((v) => v || null),
  city: z.string().trim().max(80).optional().transform((v) => v || null),
  state: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "UF inválida.")]).optional().transform((v) => v || null),
});

export async function createLocation(deps: ServiceDeps, ctx: AccessContext, input: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "vehicles:manage", companyId: ctx.companyId });
  const data = locationSchema.parse(input);
  return withTenant(deps.db, ctx, async (tx) => {
    const [l] = await tx.insert(locations).values({ ...data, companyId: ctx.companyId }).returning();
    await audit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "location.create", entity: "locations", entityId: l!.id, newValue: data, meta });
    return { id: l!.id };
  });
}
