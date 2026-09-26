import { bigint, boolean, index, integer, jsonb, pgTable, smallint, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { authorship, id, softDelete, tenant, timestamps, ts } from "./_shared";
import {
  checklistItemResultEnum, checklistTypeEnum, contractStatusEnum, damageSeverityEnum, fuelLevelEnum,
  rentalPeriodEnum, rentalStatusEnum, reservationStatusEnum,
} from "./enums";
import { users } from "./identity";
import { customers, drivers } from "./customers";
import { locations, vehicleCategories, vehicles } from "./fleet";

const cents = (name: string) => bigint(name, { mode: "number" });

/**
 * Reservas (seção 32). Conflitos são impedidos no próprio banco por uma
 * restrição de exclusão (sql/policies.sql), não só pela aplicação.
 */
export const reservations = pgTable("reservations", {
  id: id(),
  companyId: tenant(),
  code: varchar("code", { length: 12 }).notNull(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  categoryId: uuid("category_id").references(() => vehicleCategories.id),
  /** Oferta de representante que originou a reserva, se houver. */
  representativeListingId: uuid("representative_listing_id"),
  pickupLocationId: uuid("pickup_location_id").references(() => locations.id),
  returnLocationId: uuid("return_location_id").references(() => locations.id),
  pickupAt: ts("pickup_at").notNull(),
  returnAt: ts("return_at").notNull(),
  period: rentalPeriodEnum("period").notNull().default("DAILY"),
  quantity: smallint("quantity").notNull().default(1),
  priceCents: cents("price_cents").notNull(),
  discountCents: cents("discount_cents").notNull().default(0),
  feesCents: cents("fees_cents").notNull().default(0),
  representativeMarginCents: cents("representative_margin_cents").notNull().default(0),
  depositCents: cents("deposit_cents").notNull().default(0),
  totalCents: cents("total_cents").notNull(),
  status: reservationStatusEnum("status").notNull().default("DRAFT"),
  notes: text("notes"),
  cancelledAt: ts("cancelled_at"),
  cancelReason: text("cancel_reason"),
  expiresAt: ts("expires_at"),
  ...timestamps,
  ...softDelete,
  ...authorship,
}, (t) => [
  uniqueIndex("reservations_code_uq").on(t.companyId, t.code),
  index("reservations_vehicle_period_idx").on(t.vehicleId, t.pickupAt, t.returnAt),
  index("reservations_customer_idx").on(t.customerId),
]);

/** Locação (seção 34). */
export const rentals = pgTable("rentals", {
  id: id(),
  companyId: tenant(),
  code: varchar("code", { length: 12 }).notNull(),
  reservationId: uuid("reservation_id").references(() => reservations.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  mainDriverId: uuid("main_driver_id").notNull().references(() => drivers.id),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  startAt: ts("start_at").notNull(),
  expectedReturnAt: ts("expected_return_at").notNull(),
  actualReturnAt: ts("actual_return_at"),
  period: rentalPeriodEnum("period").notNull().default("DAILY"),
  amountCents: cents("amount_cents").notNull(),
  depositCents: cents("deposit_cents").notNull().default(0),
  kmOut: integer("km_out"),
  kmIn: integer("km_in"),
  kmAllowance: integer("km_allowance"),
  fuelOut: fuelLevelEnum("fuel_out"),
  fuelIn: fuelLevelEnum("fuel_in"),
  status: rentalStatusEnum("status").notNull().default("SCHEDULED"),
  ...timestamps,
  ...softDelete,
  ...authorship,
}, (t) => [
  uniqueIndex("rentals_code_uq").on(t.companyId, t.code),
  index("rentals_vehicle_idx").on(t.vehicleId, t.startAt),
  index("rentals_customer_idx").on(t.customerId),
]);

/** Quem estava autorizado a conduzir e em qual período (seção 36). */
export const rentalDrivers = pgTable("rental_drivers", {
  id: id(),
  companyId: tenant(),
  rentalId: uuid("rental_id").notNull().references(() => rentals.id),
  driverId: uuid("driver_id").notNull().references(() => drivers.id),
  isMain: boolean("is_main").notNull().default(false),
  authorizedFrom: ts("authorized_from").notNull(),
  authorizedUntil: ts("authorized_until"),
  authorizedBy: uuid("authorized_by").references(() => users.id),
  ...timestamps,
}, (t) => [index("rental_drivers_rental_idx").on(t.rentalId)]);

/** Contrato gerado automaticamente; conteúdo congelado em `snapshot` ao emitir (seção 37). */
export const contracts = pgTable("contracts", {
  id: id(),
  companyId: tenant(),
  number: varchar("number", { length: 20 }).notNull(),
  reservationId: uuid("reservation_id").references(() => reservations.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  templateVersion: varchar("template_version", { length: 20 }).notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  pdfStorageKey: text("pdf_storage_key"),
  status: contractStatusEnum("status").notNull().default("DRAFT"),
  issuedAt: ts("issued_at"),
  signedAt: ts("signed_at"),
  /** Evidências da assinatura: provedor, IP, user agent, hash do documento. */
  signature: jsonb("signature").$type<Record<string, unknown>>(),
  ...timestamps,
  ...authorship,
}, (t) => [uniqueIndex("contracts_number_uq").on(t.companyId, t.number)]);

/** Checklist de saída, devolução ou inspeção (seções 38 a 40). */
export const checklists = pgTable("checklists", {
  id: id(),
  companyId: tenant(),
  rentalId: uuid("rental_id").references(() => rentals.id),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  type: checklistTypeEnum("type").notNull(),
  performedAt: ts("performed_at").notNull().defaultNow(),
  performedBy: uuid("performed_by").references(() => users.id),
  km: integer("km").notNull(),
  fuel: fuelLevelEnum("fuel").notNull(),
  generalCondition: text("general_condition"),
  customerSignatureKey: text("customer_signature_key"),
  operatorSignatureKey: text("operator_signature_key"),
  /** Identificador gerado no aparelho para sincronização offline idempotente (seção 85). */
  clientMutationId: varchar("client_mutation_id", { length: 64 }),
  completedAt: ts("completed_at"),
  ...timestamps,
}, (t) => [
  index("checklists_rental_idx").on(t.rentalId, t.type),
  uniqueIndex("checklists_client_mutation_uq").on(t.companyId, t.clientMutationId),
]);

export const checklistItems = pgTable("checklist_items", {
  id: id(),
  companyId: tenant(),
  checklistId: uuid("checklist_id").notNull().references(() => checklists.id, { onDelete: "cascade" }),
  item: varchar("item", { length: 40 }).notNull(),
  result: checklistItemResultEnum("result").notNull(),
  missing: boolean("missing").notNull().default(false),
  note: text("note"),
  photoKeys: jsonb("photo_keys").$type<string[]>().notNull().default([]),
  ...timestamps,
}, (t) => [uniqueIndex("checklist_items_uq").on(t.checklistId, t.item)]);

/** Avarias: existentes x novas, localização, gravidade, custo (seção 41). */
export const damages = pgTable("damages", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  detectedInChecklistId: uuid("detected_in_checklist_id").references(() => checklists.id),
  isPreExisting: boolean("is_pre_existing").notNull().default(false),
  location: varchar("location", { length: 60 }).notNull(),
  description: text("description").notNull(),
  severity: damageSeverityEnum("severity").notNull(),
  photoKeys: jsonb("photo_keys").$type<string[]>().notNull().default([]),
  estimatedCostCents: cents("estimated_cost_cents"),
  responsibleCustomerId: uuid("responsible_customer_id").references(() => customers.id),
  repairedAt: ts("repaired_at"),
  repairMaintenanceId: uuid("repair_maintenance_id"),
  ...timestamps,
  ...softDelete,
  ...authorship,
}, (t) => [index("damages_vehicle_idx").on(t.vehicleId, t.repairedAt)]);

export const fuelRecords = pgTable("fuel_records", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  level: fuelLevelEnum("level").notNull(),
  liters: integer("liters_x100"),
  costCents: cents("cost_cents"),
  recordedAt: ts("recorded_at").notNull().defaultNow(),
  recordedBy: uuid("recorded_by").references(() => users.id),
  source: varchar("source", { length: 30 }).notNull(),
  ...timestamps,
}, (t) => [index("fuel_records_vehicle_idx").on(t.vehicleId, t.recordedAt)]);

export const mileageRecords = pgTable("mileage_records", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  km: integer("km").notNull(),
  recordedAt: ts("recorded_at").notNull().defaultNow(),
  recordedBy: uuid("recorded_by").references(() => users.id),
  source: varchar("source", { length: 30 }).notNull(),
  ...timestamps,
}, (t) => [index("mileage_records_vehicle_idx").on(t.vehicleId, t.recordedAt)]);

/** Avaliações cliente → locação e empresa → cliente (seção 78). */
export const reviews = pgTable("reviews", {
  id: id(),
  companyId: tenant(),
  rentalId: uuid("rental_id").notNull().references(() => rentals.id),
  direction: varchar("direction", { length: 20 }).$type<"CUSTOMER_TO_RENTAL" | "COMPANY_TO_CUSTOMER">().notNull(),
  rating: smallint("rating").notNull(),
  criteria: jsonb("criteria").$type<Record<string, number>>().notNull().default({}),
  comment: text("comment"),
  authorUserId: uuid("author_user_id").references(() => users.id),
  ...timestamps,
}, (t) => [uniqueIndex("reviews_uq").on(t.rentalId, t.direction)]);
