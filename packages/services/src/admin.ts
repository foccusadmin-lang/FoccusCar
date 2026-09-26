import { VEHICLE_STATUS_LABELS, authorize, documentExpiry, fleetOccupancy, formatPlate, type AccessContext, type VehicleStatus } from "@foccus/core";
import { auditLogs, customers, financialTransactions, maintenance, payments, rentals, reservations, users, vehicleDocuments, vehicles, withTenant } from "@foccus/db";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql, sum, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { ServiceDeps } from "./deps";

export interface DashboardAlert {
  tone: "danger" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
}

/**
 * Dashboard administrativo (seção 69). Cada bloco só aparece para quem tem permissão:
 * o operador vê frota e operação; o financeiro vê valores.
 */
export async function getAdminDashboard(deps: ServiceDeps, ctx: AccessContext) {
  const can = (p: Parameters<typeof ctx.permissions.has>[0]) => ctx.permissions.has(p);
  if (!can("vehicles:view") && !can("finance:view") && !can("customers:view") && !can("users:view"))
    authorize(ctx, { permission: "vehicles:view", companyId: ctx.companyId });

  return withTenant(deps.db, ctx, async (tx) => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const alerts: DashboardAlert[] = [];

    let fleet: null | { counts: Partial<Record<VehicleStatus, number>>; total: number; occupancy: number; labels: typeof VEHICLE_STATUS_LABELS } = null;
    if (can("vehicles:view")) {
      const rows = await tx.select({ status: vehicles.status, n: count() }).from(vehicles).where(isNull(vehicles.deletedAt)).groupBy(vehicles.status);
      const counts = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Partial<Record<VehicleStatus, number>>;
      fleet = { counts, total: rows.reduce((a, r) => a + Number(r.n), 0), occupancy: fleetOccupancy(counts), labels: VEHICLE_STATUS_LABELS };

      const docs = await tx
        .select({ id: vehicleDocuments.id, vehicleId: vehicleDocuments.vehicleId, type: vehicleDocuments.type, expiresAt: vehicleDocuments.expiresAt, plate: vehicles.plate })
        .from(vehicleDocuments).innerJoin(vehicles, eq(vehicles.id, vehicleDocuments.vehicleId))
        .where(and(isNull(vehicleDocuments.deletedAt), isNull(vehicles.deletedAt), isNotNull(vehicleDocuments.expiresAt), lte(vehicleDocuments.expiresAt, in30)));
      const expired = docs.filter((d) => documentExpiry(d.expiresAt, now).state === "EXPIRED");
      if (expired.length) alerts.push({ tone: "danger", title: `${expired.length} documento(s) da frota vencido(s)`, detail: expired.slice(0, 3).map((d) => formatPlate(d.plate)).join(", "), href: "/admin/documentos" });
      const soon = docs.length - expired.length;
      if (soon) alerts.push({ tone: "warning", title: `${soon} documento(s) vencem em até 30 dias`, detail: "Renove antes do vencimento para não parar o carro.", href: "/admin/documentos" });
      if (counts.BLOCKED) alerts.push({ tone: "warning", title: `${counts.BLOCKED} veículo(s) bloqueado(s)`, detail: "Bloqueio administrativo: não aceitam reservas.", href: "/admin/veiculos?status=BLOCKED" });
      if (counts.MAINTENANCE) alerts.push({ tone: "info", title: `${counts.MAINTENANCE} veículo(s) em manutenção`, detail: "Acompanhe na frota.", href: "/admin/veiculos?status=MAINTENANCE" });

      const [late] = await tx.select({ n: count() }).from(maintenance)
        .where(and(isNull(maintenance.deletedAt), inArray(maintenance.status, ["SCHEDULED", "IN_PROGRESS"]), isNotNull(maintenance.nextDate), lt(maintenance.nextDate, now.toISOString().slice(0, 10))));
      if (Number(late?.n ?? 0)) alerts.push({ tone: "danger", title: `${late!.n} manutenção(ões) atrasada(s)`, detail: "Veja o módulo de manutenção.", href: "/admin/veiculos" });
    }

    let operations: null | { reservationsUpcoming: number; rentalsActive: number; rentalsLate: number } = null;
    if (can("reservations:view") || can("rentals:view")) {
      const [[r], [a], [l]] = await Promise.all([
        tx.select({ n: count() }).from(reservations).where(and(inArray(reservations.status, ["PENDING_PAYMENT", "CONFIRMED"]), gte(reservations.pickupAt, now), isNull(reservations.deletedAt))),
        tx.select({ n: count() }).from(rentals).where(and(inArray(rentals.status, ["ACTIVE", "CHECKOUT_IN_PROGRESS", "RETURN_IN_PROGRESS"]), isNull(rentals.deletedAt))),
        tx.select({ n: count() }).from(rentals).where(and(eq(rentals.status, "ACTIVE"), lt(rentals.expectedReturnAt, now), isNull(rentals.deletedAt))),
      ]);
      operations = { reservationsUpcoming: Number(r?.n ?? 0), rentalsActive: Number(a?.n ?? 0), rentalsLate: Number(l?.n ?? 0) };
      if (operations.rentalsLate) alerts.push({ tone: "danger", title: `${operations.rentalsLate} devolução(ões) atrasada(s)`, detail: "Contate os clientes.", href: "/admin" });
    }

    let customersBlock: null | { underReview: number } = null;
    if (can("customers:documents.review")) {
      const [q] = await tx.select({ n: count() }).from(customers).innerJoin(users, eq(users.id, customers.userId)).where(and(eq(users.status, "UNDER_REVIEW"), isNull(customers.deletedAt)));
      customersBlock = { underReview: Number(q?.n ?? 0) };
      if (customersBlock.underReview) alerts.push({ tone: "info", title: `${customersBlock.underReview} cadastro(s) aguardando análise`, detail: "Clientes esperando liberação para reservar.", href: "/admin/cadastros" });
    }

    let finance: null | { incomeCents: number; expenseCents: number; resultCents: number; pendingPayments: number; overduePayments: number } = null;
    if (can("finance:view")) {
      const monthDate = monthStart.toISOString().slice(0, 10);
      const sums = await tx
        .select({ direction: financialTransactions.direction, total: sum(financialTransactions.amountCents) })
        .from(financialTransactions)
        .where(and(eq(financialTransactions.status, "CONFIRMED"), gte(financialTransactions.competenceDate, monthDate)))
        .groupBy(financialTransactions.direction);
      const income = Number(sums.find((s) => s.direction === "INCOME")?.total ?? 0);
      const expense = Number(sums.find((s) => s.direction === "EXPENSE")?.total ?? 0);
      const [[p], [o]] = await Promise.all([
        tx.select({ n: count() }).from(payments).where(inArray(payments.status, ["PENDING", "PROCESSING"])),
        tx.select({ n: count() }).from(payments).where(and(inArray(payments.status, ["PENDING"]), isNotNull(payments.expiresAt), lt(payments.expiresAt, now))),
      ]);
      finance = { incomeCents: income, expenseCents: expense, resultCents: income - expense, pendingPayments: Number(p?.n ?? 0), overduePayments: Number(o?.n ?? 0) };
      if (finance.overduePayments) alerts.push({ tone: "warning", title: `${finance.overduePayments} pagamento(s) vencido(s)`, detail: "Inadimplência a acompanhar.", href: "/admin" });
    }

    const order = { danger: 0, warning: 1, info: 2 } as const;
    alerts.sort((a, b) => order[a.tone] - order[b.tone]);
    return { fleet, operations, customers: customersBlock, finance, alerts, generatedAt: now };
  });
}

// ─── Auditoria ──────────────────────────────────────────────────────────────

export const auditFiltersSchema = z.object({
  entidade: z.string().trim().max(60).optional(),
  acao: z.string().trim().max(60).optional(),
  registro: z.string().trim().max(80).optional(),
  de: z.union([z.literal(""), z.coerce.date()]).optional(),
  ate: z.union([z.literal(""), z.coerce.date()]).optional(),
  antes: z.coerce.number().int().positive().optional(),
});

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "vehicle.create": "Veículo cadastrado",
  "vehicle.update": "Veículo alterado",
  "vehicle.status": "Status do veículo alterado",
  "vehicle.block": "Veículo bloqueado",
  "vehicle.unblock": "Veículo desbloqueado",
  "vehicle.photo.add": "Foto adicionada",
  "vehicle.photo.update": "Foto alterada",
  "vehicle.photo.remove": "Foto removida",
  "vehicle.document.add": "Documento da frota registrado",
  "vehicle.document.archive": "Documento da frota arquivado",
  "vehicle_category.create": "Categoria criada",
  "location.create": "Localização criada",
  "user.role.grant": "Perfil concedido",
  "user.role.revoke": "Perfil retirado",
  "customer.profile.create": "Cadastro do cliente criado",
  "customer.profile.update": "Cadastro do cliente alterado",
  "customer.profile.submit": "Cadastro enviado para análise",
  "customer.document.upload": "Documento do cliente enviado",
  "customer.document.approved": "Documento do cliente aprovado",
  "customer.document.rejected": "Documento do cliente recusado",
  "customer.account.approve": "Conta do cliente liberada",
};

/** Trilha de auditoria (seção 80), somente leitura, paginada por cursor. */
export async function listAuditLogs(deps: ServiceDeps, ctx: AccessContext, rawFilters: unknown) {
  authorize(ctx, { permission: "audit:view", companyId: ctx.companyId });
  const f = auditFiltersSchema.parse(rawFilters ?? {});
  const PAGE = 50;
  return withTenant(deps.db, ctx, async (tx) => {
    const where: SQL[] = [];
    if (f.entidade) where.push(eq(auditLogs.entity, f.entidade));
    if (f.acao) where.push(sql`${auditLogs.action} like ${`${f.acao.replace(/[%_\\]/g, "")}%`}`);
    if (f.registro) where.push(eq(auditLogs.entityId, f.registro));
    if (f.de) where.push(gte(auditLogs.createdAt, f.de));
    if (f.ate) where.push(lt(auditLogs.createdAt, new Date(f.ate.getTime() + 86_400_000)));
    if (f.antes) where.push(lt(auditLogs.id, f.antes));
    const rows = await tx
      .select({ a: auditLogs, actor: users.name, actorEmail: users.email })
      .from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(auditLogs.id))
      .limit(PAGE + 1);
    const page = rows.slice(0, PAGE);
    const entities = await tx.selectDistinct({ entity: auditLogs.entity }).from(auditLogs).orderBy(auditLogs.entity).limit(50);
    return {
      items: page.map(({ a, actor, actorEmail }) => ({
        id: a.id, at: a.createdAt, action: a.action, actionLabel: AUDIT_ACTION_LABELS[a.action] ?? a.action, entity: a.entity, entityId: a.entityId,
        actor: actor ?? "Sistema", actorEmail, oldValue: a.oldValue, newValue: a.newValue, origin: a.origin, ip: a.ip,
      })),
      nextCursor: rows.length > PAGE ? page[page.length - 1]!.a.id : null,
      entities: entities.map((e) => e.entity),
    };
  });
}
