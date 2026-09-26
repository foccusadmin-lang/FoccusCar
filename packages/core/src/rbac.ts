import type { Role } from "./enums";

/**
 * Catálogo de permissões (formato "modulo:acao").
 * Os papéis abaixo são o padrão; cada empresa pode ajustar via tabelas
 * roles / role_permissions (permissões configuráveis, seção 16).
 */
export const PERMISSIONS = [
  // Vitrine e conta própria
  "showcase:view",
  "self:profile.manage",
  "self:reservations.manage",
  "self:rentals.view",
  "self:payments.manage",
  // Clientes
  "customers:view", "customers:manage", "customers:documents.review",
  // Frota
  "vehicles:view", "vehicles:manage", "vehicles:history.view",
  // Operação
  "reservations:view", "reservations:manage",
  "rentals:view", "rentals:manage",
  "contracts:view", "contracts:manage",
  "checklists:execute",
  "maintenance:view", "maintenance:manage",
  "fines:manage", "occurrences:manage",
  // Financeiro
  "finance:view", "finance:manage", "payments:refund", "bank_accounts:manage", "reconciliation:manage",
  // Monitoramento e segurança
  "gps:view", "security:alerts.manage", "security:commands.execute", "geofences:manage",
  // Representantes
  "representative:listings.manage", "representative:wallet.view", "representative:withdraw",
  "representatives:manage", "withdrawals:review",
  // Relatórios, usuários e auditoria
  "reports:view", "users:view", "users:manage", "users:roles.assign", "audit:view",
  "settings:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const CLIENT: Permission[] = [
  "showcase:view", "self:profile.manage", "self:reservations.manage", "self:rentals.view", "self:payments.manage",
];

const OPERATOR: Permission[] = [
  "showcase:view", "customers:view", "customers:documents.review", "vehicles:view", "vehicles:history.view",
  "reservations:view", "reservations:manage", "rentals:view", "rentals:manage", "contracts:view",
  "contracts:manage", "checklists:execute", "maintenance:view", "maintenance:manage", "fines:manage",
  "occurrences:manage", "gps:view", "security:alerts.manage",
];

const FINANCE: Permission[] = [
  "showcase:view", "customers:view", "vehicles:view", "reservations:view", "rentals:view", "contracts:view",
  "finance:view", "finance:manage", "payments:refund", "bank_accounts:manage", "reconciliation:manage",
  "withdrawals:review", "reports:view",
];

const MANAGER: Permission[] = Array.from(
  new Set<Permission>([
    ...OPERATOR,
    "customers:manage", "vehicles:manage", "finance:view", "geofences:manage", "security:commands.execute",
    "representatives:manage", "reports:view", "users:view", "audit:view",
  ]),
);

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  CLIENTE: CLIENT,
  REPRESENTANTE: [
    ...CLIENT, "vehicles:view", "representative:listings.manage", "representative:wallet.view", "representative:withdraw",
  ],
  OPERADOR: OPERATOR,
  FINANCEIRO: FINANCE,
  GERENTE: MANAGER,
  ADMIN: PERMISSIONS,
};

/** Papéis que só podem ser atribuídos por mecanismo administrativo (seção 17). */
export const PRIVILEGED_ROLES: readonly Role[] = ["ADMIN", "GERENTE", "OPERADOR", "FINANCEIRO"];

/** Papel de toda conta criada publicamente. Nunca derivar de entrada do usuário. */
export const PUBLIC_SIGNUP_ROLE: Role = "CLIENTE";

export function permissionsFor(roles: readonly Role[], overrides?: ReadonlyMap<Role, readonly Permission[]>): Set<Permission> {
  const out = new Set<Permission>();
  for (const role of roles) {
    for (const p of overrides?.get(role) ?? DEFAULT_ROLE_PERMISSIONS[role]) out.add(p);
  }
  return out;
}

export function hasPermission(granted: ReadonlySet<Permission>, needed: Permission): boolean {
  return granted.has(needed);
}

/**
 * Regra de atribuição de papéis:
 * - só quem tem "users:roles.assign" atribui papéis;
 * - apenas ADMIN pode conceder ADMIN;
 * - ninguém altera os próprios papéis (evita autoescalonamento).
 */
export function canAssignRole(params: {
  actorId: string;
  actorRoles: readonly Role[];
  actorPermissions: ReadonlySet<Permission>;
  targetUserId: string;
  role: Role;
}): { allowed: true } | { allowed: false; reason: string } {
  const { actorId, actorRoles, actorPermissions, targetUserId, role } = params;
  if (actorId === targetUserId) return { allowed: false, reason: "Você não pode alterar os seus próprios perfis." };
  if (!actorPermissions.has("users:roles.assign"))
    return { allowed: false, reason: "Seu perfil não permite atribuir perfis a outros usuários." };
  if (role === "ADMIN" && !actorRoles.includes("ADMIN"))
    return { allowed: false, reason: "Somente administradores podem conceder o perfil de administrador." };
  return { allowed: true };
}

export const ROLE_LABELS: Record<Role, string> = {
  CLIENTE: "Cliente",
  REPRESENTANTE: "Representante",
  OPERADOR: "Operador",
  FINANCEIRO: "Financeiro",
  GERENTE: "Gerente",
  ADMIN: "Administrador",
};

/** Permissões que dão acesso ao painel administrativo (qualquer uma basta). */
const ADMIN_AREA: Permission[] = ["vehicles:view", "customers:view", "finance:view", "users:view", "audit:view"];

export function canAccessAdmin(granted: ReadonlySet<Permission>): boolean {
  return ADMIN_AREA.some((p) => granted.has(p));
}

/**
 * Retirada de perfil: mesmas regras da atribuição, mais duas travas —
 * o perfil CLIENTE é a base de toda conta e a empresa nunca fica sem administrador.
 */
export function canRevokeRole(params: Parameters<typeof canAssignRole>[0] & { remainingAdmins: number }):
  { allowed: true } | { allowed: false; reason: string } {
  const base = canAssignRole(params);
  if (!base.allowed) return base;
  if (params.role === "CLIENTE") return { allowed: false, reason: "O perfil Cliente é a base de toda conta e não pode ser retirado." };
  if (params.role === "ADMIN" && params.remainingAdmins <= 1)
    return { allowed: false, reason: "A empresa precisa de pelo menos um administrador." };
  return { allowed: true };
}
