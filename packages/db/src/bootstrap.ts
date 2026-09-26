import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLES, type Role } from "@foccus/core";
import { eq, and } from "drizzle-orm";
import { withTenant, type Database } from "./client";
import { companies, companyMembers, permissions, rolePermissions, roles, users } from "./schema";

const ROLE_NAMES: Record<Role, string> = {
  CLIENTE: "Cliente",
  REPRESENTANTE: "Representante",
  OPERADOR: "Operador",
  FINANCEIRO: "Financeiro",
  GERENTE: "Gerente",
  ADMIN: "Administrador",
};

/** Cria (ou atualiza) uma empresa com os perfis e permissões padrão. Idempotente. */
export async function ensureCompany(db: Database, input: { name: string; slug: string; domain?: string | null }) {
  await db.insert(permissions).values(PERMISSIONS.map((key) => ({ key }))).onConflictDoNothing();
  const [company] = await db
    .insert(companies)
    .values({ name: input.name, slug: input.slug, domain: input.domain ?? null })
    .onConflictDoUpdate({ target: companies.slug, set: { name: input.name } })
    .returning();
  await withTenant(db, { companyId: company!.id }, async (tx) => {
    for (const key of ROLES) {
      const [role] = await tx
        .insert(roles)
        .values({ companyId: company!.id, key, name: ROLE_NAMES[key] })
        .onConflictDoUpdate({ target: [roles.companyId, roles.key], set: { name: ROLE_NAMES[key] } })
        .returning();
      await tx
        .insert(rolePermissions)
        .values(DEFAULT_ROLE_PERMISSIONS[key].map((permissionKey) => ({ companyId: company!.id, roleId: role!.id, permissionKey })))
        .onConflictDoNothing();
    }
  });
  return company!;
}

/**
 * Mecanismo administrativo de atribuição de perfis privilegiados (seção 17).
 * Usado pela CLI de bootstrap do primeiro administrador; depois disso, pela API de usuários
 * (que exige users:roles.assign e registra auditoria).
 */
export async function grantRole(db: Database, params: { companyId: string; email: string; role: Role; grantedBy?: string }) {
  const [user] = await db.select().from(users).where(eq(users.email, params.email.toLowerCase()));
  if (!user) throw new Error(`Usuário ${params.email} não encontrado. Ele precisa criar a conta primeiro.`);
  await withTenant(db, { companyId: params.companyId, userId: params.grantedBy }, async (tx) => {
    const existing = await tx
      .select()
      .from(companyMembers)
      .where(and(eq(companyMembers.userId, user.id), eq(companyMembers.role, params.role)));
    if (!existing.length)
      await tx.insert(companyMembers).values({ companyId: params.companyId, userId: user.id, role: params.role, createdBy: params.grantedBy ?? null });
  });
  return user;
}
