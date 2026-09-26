import { timingSafeEqual } from "node:crypto";
import type { CardPaymentRequest, GatewayCustomer, GatewayPayment, PaymentGateway, PaymentRequest, WebhookEvent } from "./gateway";
import { requestJson } from "./http";
import { mapAsaasStatus } from "./status-maps";

interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  invoiceUrl?: string;
}

/**
 * Adapter Asaas (API v3). Implementado conforme a documentação pública;
 * validar em sandbox (api-sandbox.asaas.com) antes de produção.
 */
export class AsaasGateway implements PaymentGateway {
  readonly provider = "asaas";

  constructor(private readonly cfg: { apiKey: string; webhookToken: string; sandbox?: boolean; fetchImpl?: typeof fetch }) {}

  private get base() {
    return this.cfg.sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  }

  private call<T>(path: string, init: RequestInit = {}) {
    return requestJson<T>(this.provider, `${this.base}${path}`, {
      ...init,
      fetchImpl: this.cfg.fetchImpl,
      headers: { access_token: this.cfg.apiKey, "user-agent": "FoccusCar/1.0" },
    });
  }

  private toPayment(p: AsaasPayment, extra: Partial<GatewayPayment> = {}): GatewayPayment {
    return { providerPaymentId: p.id, status: mapAsaasStatus(p.status), amountCents: Math.round(p.value * 100), checkoutUrl: p.invoiceUrl, raw: p, ...extra };
  }

  private async ensureCustomer(req: PaymentRequest) {
    return req.customer.gatewayCustomerId ?? (await this.createCustomer(req.customer)).gatewayCustomerId;
  }

  private today(offsetDays = 0) {
    return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  }

  async createCustomer(c: GatewayCustomer) {
    const res = await this.call<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({ name: c.name, cpfCnpj: c.cpf, email: c.email, mobilePhone: c.phone }),
    });
    return { gatewayCustomerId: res.id };
  }

  async createPixPayment(req: PaymentRequest) {
    const p = await this.call<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: await this.ensureCustomer(req), billingType: "PIX", value: req.amountCents / 100,
        dueDate: this.today(), description: req.description, externalReference: req.metadata.paymentId,
      }),
    });
    const qr = await this.call<{ encodedImage: string; payload: string; expirationDate: string }>(`/payments/${p.id}/pixQrCode`);
    return this.toPayment(p, { pix: { qrCode: qr.payload, qrCodeBase64: qr.encodedImage, expiresAt: new Date(qr.expirationDate) } });
  }

  private async card(req: CardPaymentRequest, billingType: "CREDIT_CARD" | "DEBIT_CARD") {
    const installments = billingType === "DEBIT_CARD" ? 1 : req.installments;
    const p = await this.call<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: await this.ensureCustomer(req), billingType, dueDate: this.today(), description: req.description,
        externalReference: req.metadata.paymentId, creditCardToken: req.cardToken,
        ...(installments > 1 ? { installmentCount: installments, totalValue: req.amountCents / 100 } : { value: req.amountCents / 100 }),
      }),
    });
    return this.toPayment(p);
  }

  createCreditCardPayment(req: CardPaymentRequest) {
    return this.card(req, "CREDIT_CARD");
  }

  createDebitCardPayment(req: CardPaymentRequest) {
    return this.card(req, "DEBIT_CARD");
  }

  async createCheckout(req: PaymentRequest & { successUrl: string; maxInstallments?: number }) {
    const p = await this.call<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: await this.ensureCustomer(req), billingType: "UNDEFINED", value: req.amountCents / 100,
        dueDate: this.today(1), description: req.description, externalReference: req.metadata.paymentId,
        callback: { successUrl: req.successUrl, autoRedirect: true },
      }),
    });
    return this.toPayment(p);
  }

  async getPayment(id: string) {
    return this.toPayment(await this.call<AsaasPayment>(`/payments/${encodeURIComponent(id)}`));
  }

  async cancelPayment(id: string) {
    await this.call(`/payments/${encodeURIComponent(id)}`, { method: "DELETE" });
    return this.getPayment(id);
  }

  async refundPayment(id: string, amountCents?: number) {
    const p = await this.call<AsaasPayment>(`/payments/${encodeURIComponent(id)}/refund`, {
      method: "POST",
      body: JSON.stringify(amountCents ? { value: amountCents / 100 } : {}),
    });
    return { providerRefundId: p.id, status: amountCents ? ("PARTIALLY_REFUNDED" as const) : ("REFUNDED" as const) };
  }

  async createWebhook(url: string) {
    const res = await this.call<{ id: string }>("/webhooks", {
      method: "POST",
      body: JSON.stringify({ name: "Foccus Car", url, enabled: true, interrupted: false, authToken: this.cfg.webhookToken, sendType: "SEQUENTIALLY", events: ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_CHARGEBACK_REQUESTED"] }),
    });
    return { webhookId: res.id };
  }

  /** O Asaas envia o token configurado no header asaas-access-token. */
  async validateWebhook({ headers, rawBody }: { headers: Headers; rawBody: string }): Promise<WebhookEvent> {
    const token = headers.get("asaas-access-token") ?? "";
    const a = Buffer.from(token);
    const b = Buffer.from(this.cfg.webhookToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Token do webhook inválido.");
    const body = JSON.parse(rawBody) as { id: string; event: string; payment?: AsaasPayment };
    return {
      eventId: body.id,
      type: body.event,
      providerPaymentId: body.payment?.id,
      status: body.payment ? mapAsaasStatus(body.payment.status) : undefined,
      raw: body,
    };
  }
}
