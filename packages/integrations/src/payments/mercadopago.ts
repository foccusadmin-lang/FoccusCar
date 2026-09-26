import { createHmac, timingSafeEqual } from "node:crypto";
import type { CardPaymentRequest, GatewayCustomer, GatewayPayment, PaymentGateway, PaymentRequest, WebhookEvent } from "./gateway";
import { requestJson } from "./http";
import { mapMercadoPagoStatus } from "./status-maps";

interface MpPayment {
  id: number;
  status: string;
  transaction_amount: number;
  date_of_expiration?: string;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
}

/**
 * Adapter Mercado Pago (API v1). Implementado conforme a documentação pública;
 * validar em sandbox com credenciais de teste antes de produção.
 */
export class MercadoPagoGateway implements PaymentGateway {
  readonly provider = "mercadopago";
  private readonly base = "https://api.mercadopago.com";

  constructor(private readonly cfg: { accessToken: string; webhookSecret: string; fetchImpl?: typeof fetch }) {}

  private call<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
    return requestJson<T>(this.provider, `${this.base}${path}`, {
      ...init,
      fetchImpl: this.cfg.fetchImpl,
      headers: {
        authorization: `Bearer ${this.cfg.accessToken}`,
        ...(init.idempotencyKey ? { "x-idempotency-key": init.idempotencyKey } : {}),
      },
    });
  }

  private toPayment(p: MpPayment): GatewayPayment {
    const td = p.point_of_interaction?.transaction_data;
    return {
      providerPaymentId: String(p.id),
      status: mapMercadoPagoStatus(p.status),
      amountCents: Math.round(p.transaction_amount * 100),
      pix: td?.qr_code
        ? { qrCode: td.qr_code, qrCodeBase64: td.qr_code_base64, expiresAt: new Date(p.date_of_expiration ?? Date.now()) }
        : undefined,
      raw: p,
    };
  }

  private payer(c: GatewayCustomer) {
    return { email: c.email, first_name: c.name, identification: { type: "CPF", number: c.cpf } };
  }

  async createCustomer(c: GatewayCustomer) {
    const res = await this.call<{ id: string }>("/v1/customers", { method: "POST", body: JSON.stringify({ email: c.email, first_name: c.name, identification: { type: "CPF", number: c.cpf } }) });
    return { gatewayCustomerId: res.id };
  }

  async createPixPayment(req: PaymentRequest & { expiresInMinutes?: number }) {
    const expires = new Date(Date.now() + (req.expiresInMinutes ?? 30) * 60_000);
    const p = await this.call<MpPayment>("/v1/payments", {
      method: "POST",
      idempotencyKey: req.idempotencyKey,
      body: JSON.stringify({
        transaction_amount: req.amountCents / 100,
        description: req.description,
        payment_method_id: "pix",
        date_of_expiration: expires.toISOString(),
        payer: this.payer(req.customer),
        external_reference: req.metadata.paymentId,
        metadata: req.metadata,
      }),
    });
    return this.toPayment(p);
  }

  private async card(req: CardPaymentRequest, kind: "credit" | "debit") {
    const p = await this.call<MpPayment>("/v1/payments", {
      method: "POST",
      idempotencyKey: req.idempotencyKey,
      body: JSON.stringify({
        transaction_amount: req.amountCents / 100,
        description: req.description,
        token: req.cardToken,
        installments: kind === "debit" ? 1 : req.installments,
        payer: this.payer(req.customer),
        external_reference: req.metadata.paymentId,
        metadata: req.metadata,
      }),
    });
    return this.toPayment(p);
  }

  createCreditCardPayment(req: CardPaymentRequest) {
    return this.card(req, "credit");
  }

  createDebitCardPayment(req: CardPaymentRequest) {
    return this.card(req, "debit");
  }

  async createCheckout(req: PaymentRequest & { successUrl: string; failureUrl: string; maxInstallments?: number }) {
    const pref = await this.call<{ id: string; init_point: string }>("/checkout/preferences", {
      method: "POST",
      idempotencyKey: req.idempotencyKey,
      body: JSON.stringify({
        items: [{ title: req.description, quantity: 1, currency_id: "BRL", unit_price: req.amountCents / 100 }],
        payer: { email: req.customer.email, name: req.customer.name },
        external_reference: req.metadata.paymentId,
        back_urls: { success: req.successUrl, failure: req.failureUrl, pending: req.successUrl },
        payment_methods: { installments: req.maxInstallments ?? 1 },
        metadata: req.metadata,
      }),
    });
    return { providerPaymentId: pref.id, status: "PENDING" as const, amountCents: req.amountCents, checkoutUrl: pref.init_point, raw: pref };
  }

  async getPayment(id: string) {
    return this.toPayment(await this.call<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`));
  }

  async cancelPayment(id: string) {
    return this.toPayment(await this.call<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) }));
  }

  async refundPayment(id: string, amountCents?: number) {
    const r = await this.call<{ id: number; status: string }>(`/v1/payments/${encodeURIComponent(id)}/refunds`, {
      method: "POST",
      idempotencyKey: `refund-${id}-${amountCents ?? "full"}`,
      body: JSON.stringify(amountCents ? { amount: amountCents / 100 } : {}),
    });
    return { providerRefundId: String(r.id), status: amountCents ? ("PARTIALLY_REFUNDED" as const) : ("REFUNDED" as const) };
  }

  async createWebhook(): Promise<{ webhookId: string }> {
    throw new Error("No Mercado Pago o webhook é configurado no painel do desenvolvedor (Suas integrações → Webhooks).");
  }

  /** Valida o header x-signature (HMAC-SHA256 de "id:{data.id};request-id:{x-request-id};ts:{ts};"). */
  async validateWebhook({ headers, rawBody }: { headers: Headers; rawBody: string }): Promise<WebhookEvent> {
    const signature = headers.get("x-signature") ?? "";
    const requestId = headers.get("x-request-id") ?? "";
    const parts = Object.fromEntries(signature.split(",").map((kv) => kv.trim().split("=") as [string, string]));
    const body = JSON.parse(rawBody) as { id?: number | string; type?: string; action?: string; data?: { id?: string | number } };
    const dataId = String(body.data?.id ?? "").toLowerCase();
    if (!parts.ts || !parts.v1 || !dataId) throw new Error("Webhook sem assinatura válida.");
    const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
    const expected = createHmac("sha256", this.cfg.webhookSecret).update(manifest).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(parts.v1);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Assinatura do webhook inválida.");
    const ageMs = Date.now() - Number(parts.ts) * (parts.ts.length > 10 ? 1 : 1000);
    if (Math.abs(ageMs) > 10 * 60_000) throw new Error("Webhook expirado.");
    return {
      eventId: String(body.id ?? `${body.type}-${dataId}-${parts.ts}`),
      type: body.action ?? body.type ?? "unknown",
      providerPaymentId: body.type === "payment" ? dataId : undefined,
      raw: body,
    };
  }
}
