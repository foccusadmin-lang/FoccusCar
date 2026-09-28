import { bigint, doublePrecision, index, pgTable, real, text, uuid, varchar } from "drizzle-orm/pg-core";
import type { ClientPlatform, LocationSource } from "@foccus/core";
import { id, tenant, timestamps, ts } from "./_shared";
import { customers } from "./customers";
import { users } from "./identity";
import { rentals } from "./operations";

/**
 * Aceites LGPD (art. 8º): guarda a versão e o hash do texto exibido, quando, de onde e em qual aparelho.
 * Nunca é apagado: a retirada preenche `revoked_at` e um novo aceite cria outra linha.
 */
export const consents = pgTable("consents", {
  id: id(),
  companyId: tenant(),
  userId: uuid("user_id").notNull().references(() => users.id),
  customerId: uuid("customer_id").references(() => customers.id),
  /** Ex.: TRACKING_LOCATION (rastreamento do veículo + localização do celular). */
  type: varchar("type", { length: 40 }).notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  textSha256: varchar("text_sha256", { length: 64 }).notNull(),
  platform: varchar("platform", { length: 10 }).$type<ClientPlatform>().notNull(),
  acceptedAt: ts("accepted_at").notNull().defaultNow(),
  revokedAt: ts("revoked_at"),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("user_agent"),
  ...timestamps,
}, (t) => [index("consents_user_type_idx").on(t.companyId, t.userId, t.type)]);

/**
 * Posições do celular do cliente (complemento do rastreador do veículo).
 * Só recebe pontos com aceite vigente e locação em andamento, além do ponto do aceite no cadastro.
 */
export const customerLocations = pgTable("customer_locations", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  companyId: tenant(),
  userId: uuid("user_id").notNull().references(() => users.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  rentalId: uuid("rental_id").references(() => rentals.id),
  consentId: uuid("consent_id").notNull().references(() => consents.id),
  source: varchar("source", { length: 12 }).$type<LocationSource>().notNull(),
  platform: varchar("platform", { length: 10 }).$type<ClientPlatform>().notNull(),
  recordedAt: ts("recorded_at").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  accuracyM: real("accuracy_m"),
  speedKmh: real("speed_kmh"),
  heading: real("heading"),
  ...timestamps,
}, (t) => [
  index("customer_locations_rental_time_idx").on(t.rentalId, t.recordedAt),
  index("customer_locations_customer_time_idx").on(t.customerId, t.recordedAt),
]);
