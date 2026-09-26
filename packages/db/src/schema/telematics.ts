import { bigint, boolean, doublePrecision, index, jsonb, pgTable, real, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { id, softDelete, tenant, timestamps, ts } from "./_shared";
import {
  securityAlertStatusEnum, securityAlertTypeEnum, telematicsCommandEnum, telematicsCommandStatusEnum,
} from "./enums";
import { users } from "./identity";
import { vehicles } from "./fleet";

/**
 * Rastreadores. `supportsRemoteBlock` só é verdadeiro quando o hardware e o provedor
 * suportam bloqueio: GPS sozinho não bloqueia veículo (seção 62).
 */
export const gpsDevices = pgTable("gps_devices", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  provider: varchar("provider", { length: 40 }).notNull(),
  externalId: text("external_id").notNull(),
  imei: varchar("imei", { length: 20 }),
  model: text("model"),
  supportsRemoteBlock: boolean("supports_remote_block").notNull().default(false),
  supportsIgnition: boolean("supports_ignition").notNull().default(false),
  lastCommunicationAt: ts("last_communication_at"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
  ...softDelete,
}, (t) => [uniqueIndex("gps_devices_provider_uq").on(t.provider, t.externalId)]);

/** Posições (alto volume): pronta para particionamento por mês na produção. */
export const gpsPositions = pgTable("gps_positions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  companyId: tenant(),
  deviceId: uuid("device_id").notNull().references(() => gpsDevices.id),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  recordedAt: ts("recorded_at").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  speedKmh: real("speed_kmh"),
  heading: real("heading"),
  ignition: boolean("ignition"),
  raw: jsonb("raw"),
  ...timestamps,
}, (t) => [index("gps_positions_vehicle_time_idx").on(t.vehicleId, t.recordedAt)]);

export const gpsEvents = pgTable("gps_events", {
  id: id(),
  companyId: tenant(),
  deviceId: uuid("device_id").notNull().references(() => gpsDevices.id),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  type: varchar("type", { length: 40 }).notNull(),
  occurredAt: ts("occurred_at").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (t) => [index("gps_events_vehicle_idx").on(t.vehicleId, t.occurredAt)]);

/** Cercas: polígono GeoJSON; áreas permitidas ou proibidas (seção 60). */
export const geofences = pgTable("geofences", {
  id: id(),
  companyId: tenant(),
  name: text("name").notNull(),
  kind: varchar("kind", { length: 10 }).$type<"ALLOWED" | "FORBIDDEN">().notNull(),
  geometry: jsonb("geometry").$type<{ type: "Polygon"; coordinates: number[][][] }>().notNull(),
  alertOnEnter: boolean("alert_on_enter").notNull().default(false),
  alertOnExit: boolean("alert_on_exit").notNull().default(true),
  active: boolean("active").notNull().default(true),
  ...timestamps,
  ...softDelete,
});

/** Central FOCCUS SECURITY (seção 61). */
export const securityAlerts = pgTable("security_alerts", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  deviceId: uuid("device_id").references(() => gpsDevices.id),
  geofenceId: uuid("geofence_id").references(() => geofences.id),
  type: securityAlertTypeEnum("type").notNull(),
  status: securityAlertStatusEnum("status").notNull().default("NEW"),
  severity: varchar("severity", { length: 10 }).$type<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">().notNull(),
  occurredAt: ts("occurred_at").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  resolvedAt: ts("resolved_at"),
  resolution: text("resolution"),
  ...timestamps,
}, (t) => [index("security_alerts_status_idx").on(t.companyId, t.status, t.occurredAt)]);

/**
 * Comandos de bloqueio/desbloqueio: registram quem, quando, motivo e o resultado
 * REAL devolvido pelo provedor. Nunca marcar CONFIRMED sem confirmação (seção 63).
 */
export const telematicsCommands = pgTable("telematics_commands", {
  id: id(),
  companyId: tenant(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  deviceId: uuid("device_id").notNull().references(() => gpsDevices.id),
  command: telematicsCommandEnum("command").notNull(),
  status: telematicsCommandStatusEnum("status").notNull().default("REQUESTED"),
  reason: text("reason").notNull(),
  requestedBy: uuid("requested_by").notNull().references(() => users.id),
  confirmedBy: uuid("confirmed_by").references(() => users.id),
  securityAlertId: uuid("security_alert_id").references(() => securityAlerts.id),
  vehicleStateAtRequest: jsonb("vehicle_state_at_request").$type<Record<string, unknown>>(),
  providerRequestId: text("provider_request_id"),
  providerResponse: jsonb("provider_response"),
  sentAt: ts("sent_at"),
  resultAt: ts("result_at"),
  ...timestamps,
}, (t) => [index("telematics_commands_vehicle_idx").on(t.vehicleId, t.createdAt)]);
