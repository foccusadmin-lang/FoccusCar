import type { AccountStatus } from "./enums";

/** Transições permitidas do ciclo de vida da conta (seção 21). */
const TRANSITIONS: Record<AccountStatus, readonly AccountStatus[]> = {
  REGISTERED: ["PROFILE_INCOMPLETE", "BLOCKED"],
  PROFILE_INCOMPLETE: ["PROFILE_COMPLETE", "SUSPENDED", "BLOCKED"],
  PROFILE_COMPLETE: ["UNDER_REVIEW", "PROFILE_INCOMPLETE", "SUSPENDED", "BLOCKED"],
  UNDER_REVIEW: ["ACTIVE", "PROFILE_INCOMPLETE", "SUSPENDED", "BLOCKED"],
  ACTIVE: ["PROFILE_INCOMPLETE", "SUSPENDED", "BLOCKED"],
  SUSPENDED: ["ACTIVE", "PROFILE_INCOMPLETE", "BLOCKED"],
  BLOCKED: ["ACTIVE", "SUSPENDED"],
};

export function canTransition(from: AccountStatus, to: AccountStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AccountStatus, to: AccountStatus): void {
  if (!canTransition(from, to)) throw new Error(`Transição de status inválida: ${from} → ${to}`);
}

/** Serviços privados bloqueados sem cadastro completo (seção 20). */
export const GATED_SERVICES = [
  "reservation", "rental", "contracting", "checkout", "payment", "signature", "vehicle_request", "private_services",
] as const;
export type GatedService = (typeof GATED_SERVICES)[number];

export type ServiceGate =
  | { allowed: true }
  | { allowed: false; code: "PROFILE_REQUIRED" | "UNDER_REVIEW" | "RESTRICTED"; message: string; action?: { label: string; href: string } };

/**
 * Decide se o usuário pode usar serviços privados.
 * Conta criada NÃO é conta liberada: só ACTIVE passa.
 */
export function checkServiceAccess(status: AccountStatus): ServiceGate {
  switch (status) {
    case "ACTIVE":
      return { allowed: true };
    case "REGISTERED":
    case "PROFILE_INCOMPLETE":
      return {
        allowed: false,
        code: "PROFILE_REQUIRED",
        message: "Complete seu cadastro para continuar.",
        action: { label: "COMPLETAR CADASTRO", href: "/cadastro" },
      };
    case "PROFILE_COMPLETE":
    case "UNDER_REVIEW":
      return {
        allowed: false,
        code: "UNDER_REVIEW",
        message: "Seu cadastro está em análise. Avisaremos assim que for aprovado.",
        action: { label: "VER MEU CADASTRO", href: "/cadastro" },
      };
    case "SUSPENDED":
    case "BLOCKED":
      return { allowed: false, code: "RESTRICTED", message: "Sua conta está com acesso restrito. Fale com a locadora." };
  }
}
