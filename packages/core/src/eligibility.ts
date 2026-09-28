import type { AccountStatus, DocumentStatus } from "./enums";

/**
 * Elegibilidade para uma locação específica (seção 24):
 * cadastro completo + CNH válida + categoria compatível + documentação aprovada + reserva válida + contrato
 * + autorização de rastreamento vigente.
 * Cada etapa é avaliada separadamente para a interface dizer exatamente o que falta.
 */
export interface EligibilityInput {
  accountStatus: AccountStatus;
  cnh: { expiresAt: Date; categories: readonly string[] } | null;
  requiredCnhCategory: string;
  documents: readonly { type: string; status: DocumentStatus }[];
  requiredDocuments: readonly string[];
  reservationConfirmed: boolean;
  contractSigned: boolean;
  /** Autorização LGPD de rastreamento (GPS do veículo + celular) vigente. */
  trackingConsent: boolean;
  /** Data da devolução prevista: a CNH precisa valer até lá. */
  until: Date;
}

export type EligibilityCheck =
  | "PROFILE_COMPLETE" | "CNH_VALID" | "CNH_CATEGORY" | "DOCUMENTS_APPROVED" | "RESERVATION" | "CONTRACT" | "TRACKING_CONSENT";

export interface EligibilityResult {
  eligible: boolean;
  failed: { check: EligibilityCheck; message: string }[];
}

/** Hierarquia simplificada: CNH categoria B cobre carros; AB cobre A e B, etc. */
function coversCategory(held: readonly string[], required: string): boolean {
  const letters = new Set(held.flatMap((c) => c.toUpperCase().split("")));
  const needed = required.toUpperCase();
  if (letters.has(needed)) return true;
  // Categorias superiores habilitam B (C, D, E incluem B pela legislação brasileira).
  if (needed === "B") return ["C", "D", "E"].some((c) => letters.has(c));
  return false;
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const failed: EligibilityResult["failed"] = [];
  if (input.accountStatus !== "ACTIVE")
    failed.push({ check: "PROFILE_COMPLETE", message: "Seu cadastro ainda não foi concluído e aprovado." });
  if (!input.cnh || input.cnh.expiresAt.getTime() < input.until.getTime())
    failed.push({ check: "CNH_VALID", message: "A CNH precisa estar válida até a data de devolução." });
  if (input.cnh && !coversCategory(input.cnh.categories, input.requiredCnhCategory))
    failed.push({ check: "CNH_CATEGORY", message: `Este veículo exige CNH categoria ${input.requiredCnhCategory}.` });
  const approved = new Set(input.documents.filter((d) => d.status === "APPROVED").map((d) => d.type));
  const missing = input.requiredDocuments.filter((d) => !approved.has(d));
  if (missing.length) failed.push({ check: "DOCUMENTS_APPROVED", message: `Documentos pendentes: ${missing.join(", ")}.` });
  if (!input.reservationConfirmed) failed.push({ check: "RESERVATION", message: "A reserva ainda não está confirmada." });
  if (!input.trackingConsent)
    failed.push({ check: "TRACKING_CONSENT", message: "Autorize a localização do celular no seu cadastro para poder alugar." });
  if (!input.contractSigned) failed.push({ check: "CONTRACT", message: "O contrato ainda não foi assinado." });
  return { eligible: failed.length === 0, failed };
}
