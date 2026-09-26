import { bigint, boolean, date, index, jsonb, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { authorship, id, softDelete, tenant, timestamps, ts } from "./_shared";
import { depositStatusEnum, financialCategoryEnum, financialDirectionEnum } from "./enums";
import { customers } from "./customers";
import { vehicles } from "./fleet";
import { rentals, reservations } from "./operations";
import { payments } from "./payments";

const cents = (name: string) => bigint(name, { mode: "number" });

/** Contas bancárias de recebimento/settlement (seção 57). Dados sensíveis cifrados. */
export const bankAccounts = pgTable("bank_accounts", {
  id: id(),
  companyId: tenant(),
  label: text("label").notNull(),
  bankCode: varchar("bank_code", { length: 5 }).notNull(),
  branch: varchar("branch", { length: 10 }).notNull(),
  /** Número da conta cifrado pela aplicação (AES-GCM, chave em secret). */
  accountNumberEncrypted: text("account_number_encrypted").notNull(),
  accountNumberLast4: varchar("account_number_last4", { length: 4 }).notNull(),
  pixKeyEncrypted: text("pix_key_encrypted"),
  holderName: text("holder_name").notNull(),
  holderDocumentMasked: varchar("holder_document_masked", { length: 20 }),
  isDefault: boolean("is_default").notNull().default(false),
  ...timestamps,
  ...softDelete,
  ...authorship,
});

/** Plano de contas / centros (caixa, gateway, banco). */
export const financialAccounts = pgTable("financial_accounts", {
  id: id(),
  companyId: tenant(),
  name: text("name").notNull(),
  kind: varchar("kind", { length: 20 }).$type<"CASH" | "GATEWAY" | "BANK" | "DEPOSIT_HOLDING">().notNull(),
  bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id),
  ...timestamps,
  ...softDelete,
});

/**
 * Livro financeiro IMUTÁVEL (seção 53): linhas CONFIRMED não são alteradas nem apagadas
 * (trigger em sql/policies.sql). Correção = nova linha com `reversesId`.
 */
export const financialTransactions = pgTable("financial_transactions", {
  id: id(),
  companyId: tenant(),
  direction: financialDirectionEnum("direction").notNull(),
  category: financialCategoryEnum("category").notNull(),
  status: varchar("status", { length: 12 }).$type<"PENDING" | "CONFIRMED" | "CANCELLED">().notNull().default("PENDING"),
  amountCents: cents("amount_cents").notNull(),
  competenceDate: date("competence_date").notNull(),
  settledAt: ts("settled_at"),
  financialAccountId: uuid("financial_account_id").references(() => financialAccounts.id),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  customerId: uuid("customer_id").references(() => customers.id),
  reservationId: uuid("reservation_id").references(() => reservations.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  paymentId: uuid("payment_id").references(() => payments.id),
  /** Referência genérica à origem (manutenção, multa, encargo...). */
  sourceTable: varchar("source_table", { length: 60 }),
  sourceId: uuid("source_id"),
  reversesId: uuid("reverses_id"),
  description: text("description").notNull(),
  ...timestamps,
  ...authorship,
}, (t) => [
  index("financial_tx_vehicle_idx").on(t.vehicleId, t.competenceDate),
  index("financial_tx_company_date_idx").on(t.companyId, t.competenceDate),
]);

/** Extrato bancário importado (OFX/API) para conciliação. */
export const bankTransactions = pgTable("bank_transactions", {
  id: id(),
  companyId: tenant(),
  bankAccountId: uuid("bank_account_id").notNull().references(() => bankAccounts.id),
  externalId: text("external_id").notNull(),
  postedAt: ts("posted_at").notNull(),
  amountCents: cents("amount_cents").notNull(),
  description: text("description"),
  raw: jsonb("raw"),
  ...timestamps,
}, (t) => [uniqueIndex("bank_transactions_uq").on(t.bankAccountId, t.externalId)]);

/** Conciliação Foccus Car x Gateway x Banco (seção 56). */
export const reconciliationRecords = pgTable("reconciliation_records", {
  id: id(),
  companyId: tenant(),
  paymentId: uuid("payment_id").references(() => payments.id),
  financialTransactionId: uuid("financial_transaction_id").references(() => financialTransactions.id),
  bankTransactionId: uuid("bank_transaction_id").references(() => bankTransactions.id),
  status: varchar("status", { length: 20 }).$type<"MATCHED" | "DIVERGENT" | "MISSING_GATEWAY" | "MISSING_BANK" | "RESOLVED">().notNull(),
  differenceCents: cents("difference_cents").notNull().default(0),
  notes: text("notes"),
  resolvedAt: ts("resolved_at"),
  ...timestamps,
  ...authorship,
});

/** Caução separada da receita (seção 54). */
export const deposits = pgTable("deposits", {
  id: id(),
  companyId: tenant(),
  rentalId: uuid("rental_id").references(() => rentals.id),
  reservationId: uuid("reservation_id").references(() => reservations.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  amountCents: cents("amount_cents").notNull(),
  retainedCents: cents("retained_cents").notNull().default(0),
  status: depositStatusEnum("status").notNull().default("PENDING"),
  paymentId: uuid("payment_id").references(() => payments.id),
  ...timestamps,
});

export const depositMovements = pgTable("deposit_movements", {
  id: id(),
  companyId: tenant(),
  depositId: uuid("deposit_id").notNull().references(() => deposits.id),
  kind: varchar("kind", { length: 20 }).$type<"HOLD" | "RETAIN" | "RELEASE" | "REFUND">().notNull(),
  amountCents: cents("amount_cents").notNull(),
  reason: text("reason"),
  damageId: uuid("damage_id"),
  ...timestamps,
  ...authorship,
});

/** Encargos pós-devolução (seção 55). */
export const rentalCharges = pgTable("rental_charges", {
  id: id(),
  companyId: tenant(),
  rentalId: uuid("rental_id").notNull().references(() => rentals.id),
  category: financialCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  amountCents: cents("amount_cents").notNull(),
  status: varchar("status", { length: 12 }).$type<"OPEN" | "BILLED" | "PAID" | "WAIVED">().notNull().default("OPEN"),
  paymentId: uuid("payment_id").references(() => payments.id),
  ...timestamps,
  ...authorship,
});
