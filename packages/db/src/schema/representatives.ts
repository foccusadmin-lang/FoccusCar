import { bigint, index, pgTable, text, uniqueIndex, uuid, varchar, boolean } from "drizzle-orm/pg-core";
import { authorship, id, softDelete, tenant, timestamps, ts } from "./_shared";
import { walletTxStatusEnum, withdrawalStatusEnum } from "./enums";
import { users } from "./identity";
import { vehicles } from "./fleet";
import { rentals, reservations } from "./operations";

const cents = (name: string) => bigint(name, { mode: "number" });

export const representatives = pgTable("representatives", {
  id: id(),
  companyId: tenant(),
  userId: uuid("user_id").notNull().references(() => users.id),
  displayName: text("display_name").notNull(),
  document: varchar("document", { length: 14 }),
  /** Margem máxima permitida em centavos por locação (seção 65). */
  maxMarginCents: cents("max_margin_cents").notNull().default(0),
  status: varchar("status", { length: 12 }).$type<"PENDING" | "ACTIVE" | "SUSPENDED">().notNull().default("PENDING"),
  ...timestamps,
  ...softDelete,
}, (t) => [uniqueIndex("representatives_user_uq").on(t.companyId, t.userId)]);

/** Oferta republicada: preço oficial + margem. O cliente paga pelo fluxo oficial. */
export const representativeListings = pgTable("representative_listings", {
  id: id(),
  companyId: tenant(),
  representativeId: uuid("representative_id").notNull().references(() => representatives.id),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  slug: varchar("slug", { length: 80 }).notNull(),
  marginCents: cents("margin_cents").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
  ...softDelete,
}, (t) => [uniqueIndex("representative_listings_slug_uq").on(t.companyId, t.slug)]);

export const wallets = pgTable("wallets", {
  id: id(),
  companyId: tenant(),
  representativeId: uuid("representative_id").notNull().references(() => representatives.id),
  /** Saldos são derivados de wallet_transactions; estes campos são cache atualizado em transação. */
  availableCents: cents("available_cents").notNull().default(0),
  pendingCents: cents("pending_cents").notNull().default(0),
  totalEarnedCents: cents("total_earned_cents").notNull().default(0),
  totalWithdrawnCents: cents("total_withdrawn_cents").notNull().default(0),
  totalInvestedCents: cents("total_invested_cents").notNull().default(0),
  ...timestamps,
}, (t) => [uniqueIndex("wallets_rep_uq").on(t.representativeId)]);

export const walletTransactions = pgTable("wallet_transactions", {
  id: id(),
  companyId: tenant(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  kind: varchar("kind", { length: 20 }).$type<"MARGIN" | "WITHDRAWAL" | "REVERSAL" | "INVEST" | "ADJUSTMENT">().notNull(),
  amountCents: cents("amount_cents").notNull(),
  status: walletTxStatusEnum("status").notNull().default("PENDING"),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  reservationId: uuid("reservation_id").references(() => reservations.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  withdrawalRequestId: uuid("withdrawal_request_id"),
  availableAt: ts("available_at"),
  ...timestamps,
}, (t) => [index("wallet_tx_wallet_idx").on(t.walletId, t.createdAt)]);

export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: id(),
  companyId: tenant(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  amountCents: cents("amount_cents").notNull(),
  destination: varchar("destination", { length: 20 }).$type<"BANK" | "PIX" | "FOCCUS_INVEST">().notNull(),
  destinationDetailsMasked: text("destination_details_masked"),
  status: withdrawalStatusEnum("status").notNull().default("REQUESTED"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: ts("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  paidAt: ts("paid_at"),
  ...timestamps,
  ...authorship,
});
