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

/** Documentos exigidos por padrão; cada empresa pode ajustar em companies.settings.requiredDocuments. */
export const DEFAULT_REQUIRED_DOCUMENTS = ["CNH_FRONT", "CNH_BACK", "SELFIE", "PROOF_OF_ADDRESS"] as const;

export const DOCUMENT_LABELS: Record<string, string> = {
  CNH_FRONT: "CNH (frente)",
  CNH_BACK: "CNH (verso)",
  RG: "RG",
  PROOF_OF_ADDRESS: "Comprovante de residência",
  SELFIE: "Selfie",
  OTHER: "Outro documento",
};

export interface ProfileProgressInput {
  profileSaved: boolean;
  documents: readonly { type: string; status: string }[];
  required: readonly string[];
}

/** O que falta para o cadastro ficar completo e ser aprovado (seções 18, 21 e 23). */
export function profileProgress({ profileSaved, documents, required }: ProfileProgressInput) {
  const current = new Map(documents.map((d) => [d.type, d.status]));
  const missingDocuments = required.filter((t) => !current.has(t) || current.get(t) === "EXPIRED");
  const rejectedDocuments = required.filter((t) => current.get(t) === "REJECTED");
  const approvedAll = required.every((t) => current.get(t) === "APPROVED");
  return {
    profileSaved,
    missingDocuments,
    rejectedDocuments,
    readyToSubmit: profileSaved && missingDocuments.length === 0 && rejectedDocuments.length === 0,
    allRequiredApproved: approvedAll,
  };
}

/** Após enviar para análise, dados de identidade e CNH ficam travados (alteração só pela locadora). */
export function isIdentityLocked(status: AccountStatus): boolean {
  return status === "UNDER_REVIEW" || status === "ACTIVE" || status === "PROFILE_COMPLETE";
}
