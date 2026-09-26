import type { PaymentStatus } from "@foccus/core";

/**
 * Camada abstrata de pagamentos (seção 49). O sistema conversa só com esta interface;
 * cada provedor (Mercado Pago, Asaas, futuros) é um adapter.
 * Cartões chegam SEMPRE tokenizados pelo SDK do gateway no navegador: PAN/CVV nunca passam aqui.
 */
export interface Money {
  amountCents: number;
  currency?: "BRL";
}

export interface GatewayCustomer {
  name: string;
  email: string;
  cpf: string;
  phone?: string;
}

export interface PaymentRequest extends Money {
  /** Idempotência: repetir a chamada com a mesma chave não cria cobrança duplicada. */
  idempotencyKey: string;
  description: string;
  customer: GatewayCustomer & { gatewayCustomerId?: string };
  metadata: { companyId: string; paymentId: string; reservationId?: string; rentalId?: string };
}

export interface CardPaymentRequest extends PaymentRequest {
  cardToken: string;
  installments: number;
}

export interface GatewayPayment {
  providerPaymentId: string;
  status: PaymentStatus;
  amountCents: number;
  pix?: { qrCode: string; qrCodeBase64?: string; expiresAt: Date };
  checkoutUrl?: string;
  raw: unknown;
}

export interface WebhookEvent {
  eventId: string;
  type: string;
  providerPaymentId?: string;
  status?: PaymentStatus;
  raw: unknown;
}

export interface PaymentGateway {
  readonly provider: string;
  createCustomer(customer: GatewayCustomer): Promise<{ gatewayCustomerId: string }>;
  createPixPayment(req: PaymentRequest & { expiresInMinutes?: number }): Promise<GatewayPayment>;
  createCreditCardPayment(req: CardPaymentRequest): Promise<GatewayPayment>;
  createDebitCardPayment(req: CardPaymentRequest): Promise<GatewayPayment>;
  createCheckout(req: PaymentRequest & { successUrl: string; failureUrl: string; maxInstallments?: number }): Promise<GatewayPayment>;
  getPayment(providerPaymentId: string): Promise<GatewayPayment>;
  cancelPayment(providerPaymentId: string): Promise<GatewayPayment>;
  refundPayment(providerPaymentId: string, amountCents?: number): Promise<{ providerRefundId: string; status: PaymentStatus }>;
  createWebhook(url: string): Promise<{ webhookId: string }>;
  /** Valida assinatura/autenticidade e normaliza o evento. Lança erro se inválido. */
  validateWebhook(input: { headers: Headers; rawBody: string }): Promise<WebhookEvent>;
}

export class GatewayNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Gateway ${provider} não configurado. Defina as credenciais nas variáveis de ambiente.`);
  }
}
