import { bigint, index, jsonb, pgTable, smallint, text, uniqueIndex, uuid, varchar, boolean } from "drizzle-orm/pg-core";
import { authorship, id, tenant, timestamps, ts } from "./_shared";
import { paymentMethodEnum, paymentStatusEnum } from "./enums";
import { customers } from "./customers";
import { rentals, reservations } from "./operations";

const cents = (name: string) => bigint(name, { mode: "number" });

/** Credenciais do gateway ficam em secrets; aqui só a configuração não sensível por empresa. */
export const paymentGatewayConfigs = pgTable("payment_gateway_configs", {
  id: id(),
  companyId: tenant(),
  provider: varchar("provider", { length: 30 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  /** Nome da variável/secret que guarda a credencial (nunca o valor). */
  secretRef: text("secret_ref").notNull(),
  maxInstallments: smallint("max_installments").notNull().default(1),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

/** Métodos salvos: apenas token do gateway, bandeira e 4 últimos dígitos. Nunca PAN/CVV (seção 50). */
export const paymentMethods = pgTable("payment_methods", {
  id: id(),
  companyId: tenant(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  provider: varchar("provider", { length: 30 }).notNull(),
  providerToken: text("provider_token").notNull(),
  brand: varchar("brand", { length: 20 }),
  last4: varchar("last4", { length: 4 }),
  expMonth: smallint("exp_month"),
  expYear: smallint("exp_year"),
  ...timestamps,
});

/** Cobrança (intenção de pagamento) ligada a reserva/locação/encargo. */
export const payments = pgTable("payments", {
  id: id(),
  companyId: tenant(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  reservationId: uuid("reservation_id").references(() => reservations.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  purpose: varchar("purpose", { length: 30 }).$type<"RESERVATION" | "RENTAL" | "DEPOSIT" | "EXTRA_CHARGES" | "FINE">().notNull(),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("PENDING"),
  amountCents: cents("amount_cents").notNull(),
  installments: smallint("installments").notNull().default(1),
  provider: varchar("provider", { length: 30 }).notNull(),
  providerPaymentId: text("provider_payment_id"),
  /** Chave de idempotência enviada ao gateway. */
  idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull(),
  pixQrCode: text("pix_qr_code"),
  checkoutUrl: text("checkout_url"),
  expiresAt: ts("expires_at"),
  approvedAt: ts("approved_at"),
  ...timestamps,
  ...authorship,
}, (t) => [
  uniqueIndex("payments_idempotency_uq").on(t.companyId, t.idempotencyKey),
  uniqueIndex("payments_provider_uq").on(t.provider, t.providerPaymentId),
  index("payments_status_idx").on(t.companyId, t.status),
]);

/** Tentativas/operações junto ao gateway (autorização, captura...). */
export const paymentTransactions = pgTable("payment_transactions", {
  id: id(),
  companyId: tenant(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  operation: varchar("operation", { length: 20 }).notNull(),
  status: paymentStatusEnum("status").notNull(),
  amountCents: cents("amount_cents").notNull(),
  providerTransactionId: text("provider_transaction_id"),
  response: jsonb("response"),
  ...timestamps,
});

/** Linha do tempo de status do pagamento. */
export const paymentEvents = pgTable("payment_events", {
  id: id(),
  companyId: tenant(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  fromStatus: paymentStatusEnum("from_status"),
  toStatus: paymentStatusEnum("to_status").notNull(),
  source: varchar("source", { length: 20 }).$type<"API" | "WEBHOOK" | "RECONCILIATION" | "ADMIN">().notNull(),
  webhookId: uuid("webhook_id"),
  data: jsonb("data"),
  ...timestamps,
}, (t) => [index("payment_events_payment_idx").on(t.paymentId, t.createdAt)]);

/**
 * Webhooks recebidos. A unicidade (provider, event_id) garante que o mesmo
 * evento nunca seja processado duas vezes (seção 52). Sem company_id obrigatório:
 * o tenant é descoberto depois de validar a assinatura.
 */
export const paymentWebhooks = pgTable("payment_webhooks", {
  id: id(),
  companyId: uuid("company_id"),
  provider: varchar("provider", { length: 30 }).notNull(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  signatureValid: boolean("signature_valid").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
  processingError: text("processing_error"),
  ...timestamps,
}, (t) => [uniqueIndex("payment_webhooks_event_uq").on(t.provider, t.eventId)]);

export const paymentRefunds = pgTable("payment_refunds", {
  id: id(),
  companyId: tenant(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  amountCents: cents("amount_cents").notNull(),
  reason: text("reason").notNull(),
  status: paymentStatusEnum("status").notNull().default("PROCESSING"),
  providerRefundId: text("provider_refund_id"),
  ...timestamps,
  ...authorship,
});

export const paymentChargebacks = pgTable("payment_chargebacks", {
  id: id(),
  companyId: tenant(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  amountCents: cents("amount_cents").notNull(),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull(),
  providerChargebackId: text("provider_chargeback_id"),
  disputeDeadline: ts("dispute_deadline"),
  ...timestamps,
});

export const paymentFees = pgTable("payment_fees", {
  id: id(),
  companyId: tenant(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  kind: varchar("kind", { length: 30 }).notNull(),
  amountCents: cents("amount_cents").notNull(),
  ...timestamps,
});
