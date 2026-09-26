import { randomUUID } from "node:crypto";
import type { PaymentStatus } from "@foccus/core";
import type { CardPaymentRequest, GatewayPayment, PaymentGateway, PaymentRequest, WebhookEvent } from "./gateway";

/**
 * Gateway de desenvolvimento/testes: nunca usado em produção (bloqueado pela fábrica).
 * Permite simular aprovação, recusa e webhooks para testar o fluxo completo.
 */
export class FakeGateway implements PaymentGateway {
  readonly provider = "fake";
  readonly payments = new Map<string, GatewayPayment>();
  private readonly byKey = new Map<string, string>();

  private create(req: PaymentRequest, extra: Partial<GatewayPayment> = {}): GatewayPayment {
    const existing = this.byKey.get(req.idempotencyKey);
    if (existing) return this.payments.get(existing)!;
    const p: GatewayPayment = { providerPaymentId: `fake_${randomUUID()}`, status: "PENDING", amountCents: req.amountCents, raw: {}, ...extra };
    this.payments.set(p.providerPaymentId, p);
    this.byKey.set(req.idempotencyKey, p.providerPaymentId);
    return p;
  }

  async createCustomer() {
    return { gatewayCustomerId: `fake_cus_${randomUUID()}` };
  }
  async createPixPayment(req: PaymentRequest) {
    return this.create(req, { pix: { qrCode: "00020126FAKEPIX", expiresAt: new Date(Date.now() + 30 * 60_000) } });
  }
  async createCreditCardPayment(req: CardPaymentRequest) {
    return this.create(req, { status: req.cardToken === "tok_declined" ? "REJECTED" : "APPROVED" });
  }
  async createDebitCardPayment(req: CardPaymentRequest) {
    return this.createCreditCardPayment(req);
  }
  async createCheckout(req: PaymentRequest) {
    return this.create(req, { checkoutUrl: "http://localhost:3000/pagamento/simulado" });
  }
  async getPayment(id: string) {
    const p = this.payments.get(id);
    if (!p) throw new Error("Pagamento não encontrado.");
    return p;
  }
  async cancelPayment(id: string) {
    return this.set(id, "CANCELLED");
  }
  async refundPayment(id: string, amountCents?: number) {
    const p = this.set(id, amountCents ? "PARTIALLY_REFUNDED" : "REFUNDED");
    return { providerRefundId: `fake_ref_${randomUUID()}`, status: p.status };
  }
  async createWebhook() {
    return { webhookId: "fake" };
  }
  async validateWebhook({ headers, rawBody }: { headers: Headers; rawBody: string }): Promise<WebhookEvent> {
    if (headers.get("x-fake-signature") !== "ok") throw new Error("Assinatura inválida.");
    const body = JSON.parse(rawBody) as { eventId: string; paymentId: string; status: PaymentStatus };
    return { eventId: body.eventId, type: "payment.updated", providerPaymentId: body.paymentId, status: body.status, raw: body };
  }
  set(id: string, status: PaymentStatus) {
    const p = { ...this.payments.get(id)!, status };
    this.payments.set(id, p);
    return p;
  }
}
