import { buildAccessContext, type AccessContext, type AccountStatus, type Role } from "@foccus/core";
import { companyMembers, withTenant, type Database } from "@foccus/db";
import { and, eq } from "drizzle-orm";
import type { Auth } from "./auth";
import { resolveCompanyFromHost } from "./tenant";

/**
 * Monta o contexto de acesso no servidor a partir da sessão:
 * usuário autenticado + empresa + perfis vigentes (seção 95).
 */
export async function getAccessContext(auth: Auth, db: Database, headers: Headers): Promise<AccessContext | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const companyId =
    (session.session as { activeCompanyId?: string | null }).activeCompanyId ??
    (await resolveCompanyFromHost(db, headers.get("host")))?.id;
  if (!companyId) return null;

  const memberships = await withTenant(db, { companyId, userId: session.user.id }, (tx) =>
    tx
      .select({ role: companyMembers.role })
      .from(companyMembers)
      .where(and(eq(companyMembers.userId, session.user.id), eq(companyMembers.active, true))),
  );
  if (!memberships.length) return null;

  return buildAccessContext({
    userId: session.user.id,
    companyId,
    roles: memberships.map((m) => m.role as Role),
    accountStatus: (session.user as { status?: AccountStatus }).status ?? "PROFILE_INCOMPLETE",
  });
}
