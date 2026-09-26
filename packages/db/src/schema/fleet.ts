import { boolean, index, integer, jsonb, numeric, pgTable, smallint, text, uniqueIndex, uuid, varchar, bigint } from "drizzle-orm/pg-core";
import { authorship, id, softDelete, tenant, timestamps, ts } from "./_shared";
import { documentStatusEnum, fuelTypeEnum, transmissionEnum, vehicleEventTypeEnum, vehicleStatusEnum } from "./enums";
import { users } from "./identity";

const cents = (name: string) => bigint(name, { mode: "number" });

export const vehicleCategories = pgTable("vehicle_categories", {
  id: id(),
  companyId: tenant(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 60 }).notNull(),
  requiredCnhCategory: varchar("required_cnh_category", { length: 2 }).notNull().default("B"),
  description: text("description"),
  ...timestamps,
  ...softDelete,
}, (t) => [uniqueIndex("vehicle_categories_uq").on(t.companyId, t.slug)]);

export const locations = pgTable("locations", {
  id: id(),
  companyId: tenant(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  ...timestamps,
  ...softDelete,
});

/** Veículo (seção 29). Preços em centavos. */
export const vehicles = pgTable("vehicles", {
  id: id(),
  companyId: tenant(),
  plate: varchar("plate", { length: 8 }).notNull(),
  renavam: varchar("renavam", { length: 11 }),
  chassis: varchar("chassis", { length: 17 }),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  version: text("version"),
  modelYear: smallint("model_year").notNull(),
  manufactureYear: smallint("manufacture_year"),
  color: text("color"),
  categoryId: uuid("category_id").references(() => vehicleCategories.id),
  transmission: transmissionEnum("transmission").notNull(),
  fuelType: fuelTypeEnum("fuel_type").notNull(),
  seats: smallint("seats"),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  currentKm: integer("current_km").notNull().default(0),
  status: vehicleStatusEnum("status").notNull().default("INACTIVE"),
  dailyRateCents: cents("daily_rate_cents").notNull(),
  weeklyRateCents: cents("weekly_rate_cents"),
  biweeklyRateCents: cents("biweekly_rate_cents"),
  monthlyRateCents: cents("monthly_rate_cents"),
  depositCents: cents("deposit_cents").notNull().default(0),
  kmAllowancePerDay: integer("km_allowance_per_day"),
  extraKmCents: cents("extra_km_cents"),
  locationId: uuid("location_id").references(() => locations.id),
  /** Controle da vitrine pública (seção 19). */
  showcaseVisible: boolean("showcase_visible").notNull().default(false),
  showcasePricePublic: boolean("showcase_price_public").notNull().default(true),
  showcaseFeatured: boolean("showcase_featured").notNull().default(false),
  acquiredAt: ts("acquired_at"),
  acquisitionCents: cents("acquisition_cents"),
  ...timestamps,
  ...softDelete,
  ...authorship,
}, (t) => [
  uniqueIndex("vehicles_company_plate_uq").on(t.companyId, t.plate),
  index("vehicles_showcase_idx").on(t.companyId, t.showcaseVisible, t.status),
]);

export const vehiclePhotos = pgTable("vehicle_photos", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  storageKey: text("storage_key").notNull(),
  alt: text("alt"),
  position: smallint("position").notNull().default(0),
  isCover: boolean("is_cover").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(true),
  ...timestamps,
  ...softDelete,
}, (t) => [index("vehicle_photos_vehicle_idx").on(t.vehicleId, t.position)]);

/** Documentação da frota: CRLV, licenciamento, seguro, notas (seção 74). */
export const vehicleDocuments = pgTable("vehicle_documents", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  type: varchar("type", { length: 40 }).notNull(),
  number: text("number"),
  status: documentStatusEnum("status").notNull().default("APPROVED"),
  storageKey: text("storage_key"),
  issuedAt: ts("issued_at"),
  expiresAt: ts("expires_at"),
  costCents: cents("cost_cents"),
  ...timestamps,
  ...softDelete,
  ...authorship,
}, (t) => [index("vehicle_documents_expiry_idx").on(t.companyId, t.expiresAt)]);

/**
 * Vida do Veículo (seção 31): linha do tempo imutável e única de tudo que acontece
 * com o veículo. Cada módulo grava aqui ao registrar um fato.
 */
export const vehicleEvents = pgTable("vehicle_events", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  type: vehicleEventTypeEnum("type").notNull(),
  occurredAt: ts("occurred_at").notNull().defaultNow(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  description: text("description").notNull(),
  /** Origem do evento: "rentals", "maintenance", "gps", "admin"... */
  source: varchar("source", { length: 40 }).notNull(),
  /** Referência ao registro de origem (ex.: id da locação). */
  refTable: varchar("ref_table", { length: 60 }),
  refId: uuid("ref_id"),
  km: integer("km"),
  amountCents: cents("amount_cents"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (t) => [index("vehicle_events_timeline_idx").on(t.vehicleId, t.occurredAt)]);

/** Mudanças de estado e atributos (valor anterior/novo) do veículo. */
export const vehicleHistory = pgTable("vehicle_history", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  field: varchar("field", { length: 60 }).notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  changedBy: uuid("changed_by").references(() => users.id),
  reason: text("reason"),
  ...timestamps,
}, (t) => [index("vehicle_history_vehicle_idx").on(t.vehicleId, t.createdAt)]);

/** "Avise-me quando estiver disponível" (seção 26). */
export const availabilityAlerts = pgTable("availability_alerts", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  notifiedAt: ts("notified_at"),
  ...timestamps,
}, (t) => [uniqueIndex("availability_alerts_uq").on(t.vehicleId, t.userId)]);

export const favorites = pgTable("favorites", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  ...timestamps,
}, (t) => [uniqueIndex("favorites_uq").on(t.vehicleId, t.userId)]);
