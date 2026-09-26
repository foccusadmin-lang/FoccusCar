import { ROLES, ROLE_LABELS, authorize, canAssignRole, canRevokeRole, type AccessContext, type Role } from "@foccus/core";
import { companyMembers, customers, users, withTenant } from "@foccus/db";
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { audit, notify } from "./audit";
import { ServiceError, type RequestMeta, type ServiceDeps } from "./deps";

const PAGE = 25;
const uuid = z.uuid();

export const memberFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  perfil: z.enum(ROLES).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

/**
 * Usuários da empresa com seus perfis (seção 16). Mostra apenas quem tem vínculo
 * com esta empresa; nenhum dado de outra locadora aparece (RLS em company_members).
 */
export async function listMembers(deps: ServiceDeps, ctx: AccessContext, rawFilters: unknown) {
  authorize(ctx, { permission: "users:view", companyId: ctx.companyId });
  const f = memberFiltersSchema.parse(rawFilters ?? {});
  return withTenant(deps.db, ctx, async (tx) => {
    const where: SQL[] = [eq(companyMembers.companyId, ctx.companyId), eq(companyMembers.active, true), isNull(users.deletedAt)];
    if (f.q) {
      const term = `%${f.q.replace(/[%_\\]/g, "")}%`;
      where.push(or(ilike(users.name, term), ilike(users.email, term))!);
    }
    if (f.perfil) where.push(sql`exists (select 1 from company_members m2 where m2.user_id = ${users.id} and m2.company_id = ${ctx.companyId} and m2.active and m2.role = ${f.perfil})`);
    const rows = await tx
      .select({ id: users.id, name: users.name, email: users.email, status: users.status, roles: sql<Role[]>`array_agg(${companyMembers.role} order by ${companyMembers.role})` })
      .from(companyMembers)
      .innerJoin(users, eq(users.id, companyMembers.userId))
      .where(and(...where))
      .groupBy(users.id)
      .orderBy(asc(users.name))
      .limit(PAGE + 1)
      .offset((f.pagina - 1) * PAGE);
    return {
      items: rows.slice(0, PAGE).map((r) => ({ ...r, roleLabels: r.roles.map((x) => ROLE_LABELS[x]) })),
      hasMore: rows.length > PAGE,
      page: f.pagina,
    };
  });
}

export async function getMember(deps: ServiceDeps, ctx: AccessContext, userId: string) {
  authorize(ctx, { permission: "users:view", companyId: ctx.companyId });
  if (!uuid.safeParse(userId).success) throw new ServiceError("Usuário não encontrado.", 404, "NOT_FOUND");
  return withTenant(deps.db, ctx, async (tx) => {
    const memberships = await tx.select().from(companyMembers).where(and(eq(companyMembers.companyId, ctx.companyId), eq(companyMembers.userId, userId)));
    if (!memberships.length) throw new ServiceError("Usuário não encontrado.", 404, "NOT_FOUND");
    const [u] = await tx.select({ id: users.id, name: users.name, email: users.email, status: users.status, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt }).from(users).where(eq(users.id, userId));
    const [c] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.userId, userId));
    const active = memberships.filter((m) => m.active).map((m) => m.role as Role);
    const canManage = ctx.permissions.has("users:roles.assign") && ctx.userId !== userId;
    return {
      user: u!,
      customerId: c?.id ?? null,
      roles: ROLES.map((role) => ({
        role, label: ROLE_LABELS[role], active: active.includes(role),
        editable: canManage && role !== "CLIENTE" && (role !== "ADMIN" || ctx.roles.includes("ADMIN")),
      })),
      isSelf: ctx.userId === userId,
    };
  });
}

const roleChangeSchema = z.object({
  role: z.enum(ROLES),
  action: z.enum(["GRANT", "REVOKE"]),
  reason: z.string().trim().min(5, "Informe o motivo (mínimo 5 caracteres).").max(300),
});

/**
 * Atribui ou retira um perfil (seções 17 e 80). Só por quem tem users:roles.assign;
 * ninguém altera os próprios perfis; ADMIN só por ADMIN; sempre com motivo e auditoria.
 */
export async function changeMemberRole(deps: ServiceDeps, ctx: AccessContext, userId: string, input: unknown, meta?: RequestMeta) {
  authorize(ctx, { permission: "users:roles.assign", companyId: ctx.companyId });
  if (!uuid.safeParse(userId).success) throw new ServiceError("Usuário não encontrado.", 404, "NOT_FOUND");
  const { role, action, reason } = roleChangeSchema.parse(input);
  return withTenant(deps.db, ctx, async (tx) => {
    const memberships = await tx.select().from(companyMembers).where(and(eq(companyMembers.companyId, ctx.companyId), eq(companyMembers.userId, userId)));
    if (!memberships.length) throw new ServiceError("Usuário não encontrado.", 404, "NOT_FOUND");
    const current = memberships.find((m) => m.role === role);
    const base = { actorId: ctx.userId, actorRoles: ctx.roles, actorPermissions: ctx.permissions, targetUserId: userId, role };

    if (action === "GRANT") {
      const check = canAssignRole(base);
      if (!check.allowed) throw new ServiceError(check.reason, 403, "FORBIDDEN");
      if (current?.active) throw new ServiceError("O usuário já tem este perfil.", 409, "ALREADY");
      const [u] = await tx.select({ emailVerified: users.emailVerified }).from(users).where(eq(users.id, userId));
      if (role !== "REPRESENTANTE" && !u?.emailVerified)
        throw new ServiceError("O usuário precisa confirmar o e-mail antes de receber um perfil interno.", 422, "EMAIL_NOT_VERIFIED");
      if (current) await tx.update(companyMembers).set({ active: true, updatedBy: ctx.userId }).where(eq(companyMembers.id, current.id));
      else await tx.insert(companyMembers).values({ companyId: ctx.companyId, userId, role, active: true, createdBy: ctx.userId, updatedBy: ctx.userId });
    } else {
      const [admins] = await tx.select({ n: sql<number>`count(*)::int` }).from(companyMembers).where(and(eq(companyMembers.companyId, ctx.companyId), eq(companyMembers.role, "ADMIN"), eq(companyMembers.active, true)));
      const check = canRevokeRole({ ...base, remainingAdmins: admins?.n ?? 0 });
      if (!check.allowed) throw new ServiceError(check.reason, 403, "FORBIDDEN");
      if (!current?.active) throw new ServiceError("O usuário não tem este perfil.", 409, "ALREADY");
      await tx.update(companyMembers).set({ active: false, updatedBy: ctx.userId }).where(eq(companyMembers.id, current.id));
    }

    await notify(tx, {
      companyId: ctx.companyId, userId, topic: "account",
      title: action === "GRANT" ? `Perfil ${ROLE_LABELS[role]} concedido` : `Perfil ${ROLE_LABELS[role]} retirado`,
      body: action === "GRANT" ? "Seu acesso foi atualizado. Entre novamente para ver as novas áreas." : "Seu acesso foi atualizado pela administração.",
    });
    await audit(tx, {
      companyId: ctx.companyId, actorUserId: ctx.userId, action: action === "GRANT" ? "user.role.grant" : "user.role.revoke",
      entity: "users", entityId: userId, oldValue: { role, active: Boolean(current?.active) }, newValue: { role, active: action === "GRANT", reason }, meta,
    });
    const roles = (await tx.select({ role: companyMembers.role }).from(companyMembers).where(and(eq(companyMembers.companyId, ctx.companyId), eq(companyMembers.userId, userId), eq(companyMembers.active, true)))).map((r) => r.role);
    return { roles };
  });
}

/** Localiza uma conta já criada (pelo e-mail) para dar acesso interno. Só contas desta empresa. */
export async function findMemberByEmail(deps: ServiceDeps, ctx: AccessContext, email: unknown) {
  authorize(ctx, { permission: "users:roles.assign", companyId: ctx.companyId });
  const value = z.email("E-mail inválido.").transform((v) => v.trim().toLowerCase()).parse(email);
  return withTenant(deps.db, ctx, async (tx) => {
    const [row] = await tx
      .select({ id: users.id })
      .from(users).innerJoin(companyMembers, eq(companyMembers.userId, users.id))
      .where(and(eq(users.email, value), eq(companyMembers.companyId, ctx.companyId)))
      .limit(1);
    if (!row) throw new ServiceError("Nenhuma conta com este e-mail nesta empresa. Peça para a pessoa criar a conta em Entrar e tente de novo.", 404, "NOT_FOUND");
    return { id: row.id };
  });
}
