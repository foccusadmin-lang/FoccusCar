import { bigint, index, integer, jsonb, pgTable, text, uuid, varchar, date } from "drizzle-orm/pg-core";
import { authorship, id, softDelete, tenant, timestamps, ts } from "./_shared";
import { fineStatusEnum, maintenanceStatusEnum, maintenanceTypeEnum, occurrenceStatusEnum } from "./enums";
import { users } from "./identity";
import { customers, drivers } from "./customers";
import { vehicles } from "./fleet";
import { rentals } from "./operations";

const cents = (name: string) => bigint(name, { mode: "number" });

/** Manutenção (seção 44). Status GREEN/YELLOW/RED é calculado (core/checklist.ts). */
export const maintenance = pgTable("maintenance", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  type: maintenanceTypeEnum("type").notNull(),
  status: maintenanceStatusEnum("status").notNull().default("SCHEDULED"),
  performedAt: ts("performed_at"),
  km: integer("km"),
  workshop: text("workshop"),
  service: text("service").notNull(),
  partsCents: cents("parts_cents").notNull().default(0),
  laborCents: cents("labor_cents").notNull().default(0),
  totalCents: cents("total_cents").notNull().default(0),
  invoiceKey: text("invoice_key"),
  photoKeys: jsonb("photo_keys").$type<string[]>().notNull().default([]),
  nextDate: date("next_date"),
  nextKm: integer("next_km"),
  notes: text("notes"),
  ...timestamps,
  ...softDelete,
  ...authorship,
}, (t) => [index("maintenance_vehicle_idx").on(t.vehicleId, t.performedAt)]);

export const maintenanceItems = pgTable("maintenance_items", {
  id: id(),
  companyId: tenant(),
  maintenanceId: uuid("maintenance_id").notNull().references(() => maintenance.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 10 }).$type<"PART" | "LABOR">().notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitCents: cents("unit_cents").notNull(),
  ...timestamps,
});

/** Multas (seção 72). */
export const fines = pgTable("fines", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  driverId: uuid("driver_id").references(() => drivers.id),
  infractionAt: ts("infraction_at").notNull(),
  place: text("place"),
  infractionCode: varchar("infraction_code", { length: 20 }),
  description: text("description"),
  amountCents: cents("amount_cents").notNull(),
  documentKey: text("document_key"),
  status: fineStatusEnum("status").notNull().default("RECEIVED"),
  responsibility: varchar("responsibility", { length: 20 }).$type<"CUSTOMER" | "COMPANY" | "UNDEFINED">().notNull().default("UNDEFINED"),
  paidAt: ts("paid_at"),
  ...timestamps,
  ...softDelete,
  ...authorship,
}, (t) => [index("fines_vehicle_idx").on(t.vehicleId, t.infractionAt)]);

/** Ocorrências: acidentes, roubo, pane, etc. (seção 73). */
export const occurrences = pgTable("occurrences", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  customerId: uuid("customer_id").references(() => customers.id),
  driverId: uuid("driver_id").references(() => drivers.id),
  kind: varchar("kind", { length: 30 }).notNull(),
  occurredAt: ts("occurred_at").notNull(),
  place: text("place"),
  description: text("description").notNull(),
  photoKeys: jsonb("photo_keys").$type<string[]>().notNull().default([]),
  documentKeys: jsonb("document_keys").$type<string[]>().notNull().default([]),
  costCents: cents("cost_cents"),
  responsibleUserId: uuid("responsible_user_id").references(() => users.id),
  status: occurrenceStatusEnum("status").notNull().default("OPEN"),
  ...timestamps,
  ...softDelete,
  ...authorship,
}, (t) => [index("occurrences_vehicle_idx").on(t.vehicleId, t.occurredAt)]);
