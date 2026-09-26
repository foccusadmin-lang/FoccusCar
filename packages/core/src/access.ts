import type { AccountStatus, Role } from "./enums";
import { permissionsFor, type Permission } from "./rbac";

/** Contexto resolvido no servidor a cada requisição (nunca vindo do cliente). */
export interface AccessContext {
  userId: string;
  companyId: string;
  roles: readonly Role[];
  permissions: ReadonlySet<Permission>;
  accountStatus: AccountStatus;
}

export function buildAccessContext(input: Omit<AccessContext, "permissions">): AccessContext {
  return { ...input, permissions: permissionsFor(input.roles) };
}

export class AccessDeniedError extends Error {
  readonly status: 401 | 403;
  constructor(message: string, status: 401 | 403 = 403) {
    super(message);
    this.name = "AccessDeniedError";
    this.status = status;
  }
}

/**
 * Verificação da seção 95: authenticated + tenant + role/permission + ownership.
 * Toda rota de API chama esta função antes de tocar em dados.
 */
export function authorize(
  ctx: AccessContext | null,
  req: {
    permission: Permission;
    companyId: string;
    /** Dono do recurso, quando o acesso é de "self:*" (ex.: cliente vendo a própria reserva). */
    ownerUserId?: string;
  },
): AccessContext {
  if (!ctx) throw new AccessDeniedError("Entre na sua conta para continuar.", 401);
  if (ctx.accountStatus === "BLOCKED" || ctx.accountStatus === "SUSPENDED")
    throw new AccessDeniedError("Sua conta está com acesso restrito. Fale com a locadora.");
  if (ctx.companyId !== req.companyId) throw new AccessDeniedError("Você não tem acesso a esta empresa.");
  if (!ctx.permissions.has(req.permission)) throw new AccessDeniedError("Seu perfil não permite esta ação.");
  if (req.permission.startsWith("self:") && req.ownerUserId !== undefined && req.ownerUserId !== ctx.userId)
    throw new AccessDeniedError("Este registro pertence a outra pessoa.");
  return ctx;
}
