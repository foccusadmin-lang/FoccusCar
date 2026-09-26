import type { PaymentStatus } from "@foccus/core";

/** Status do Mercado Pago → status Foccus Car. */
export function mapMercadoPagoStatus(s: string): PaymentStatus {
  const m: Record<string, PaymentStatus> = {
    pending: "PENDING", in_process: "PROCESSING", authorized: "PROCESSING", approved: "APPROVED",
    rejected: "REJECTED", cancelled: "CANCELLED", refunded: "REFUNDED", charged_back: "CHARGEBACK", in_mediation: "PROCESSING",
  };
  return m[s] ?? "FAILED";
}

/** Status do Asaas → status Foccus Car. */
export function mapAsaasStatus(s: string): PaymentStatus {
  const m: Record<string, PaymentStatus> = {
    PENDING: "PENDING", AWAITING_RISK_ANALYSIS: "PROCESSING", CONFIRMED: "APPROVED", RECEIVED: "APPROVED",
    RECEIVED_IN_CASH: "APPROVED", OVERDUE: "EXPIRED", REFUNDED: "REFUNDED", REFUND_REQUESTED: "PROCESSING",
    CHARGEBACK_REQUESTED: "CHARGEBACK", CHARGEBACK_DISPUTE: "CHARGEBACK", DELETED: "CANCELLED",
  };
  return m[s] ?? "FAILED";
}

/** Transições válidas de pagamento: webhooks fora de ordem não podem "voltar" um status final. */
const FINAL: readonly PaymentStatus[] = ["REJECTED", "CANCELLED", "EXPIRED", "REFUNDED", "FAILED", "CHARGEBACK"];
export function canMovePayment(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to || FINAL.includes(from)) return false;
  if (from === "APPROVED" || from === "PARTIALLY_REFUNDED") return ["REFUNDED", "PARTIALLY_REFUNDED", "CHARGEBACK"].includes(to);
  return true;
}
