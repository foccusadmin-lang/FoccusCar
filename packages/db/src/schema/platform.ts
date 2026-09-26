import { bigint, index, inet, jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { id, tenant, timestamps, ts } from "./_shared";
import { notificationChannelEnum } from "./enums";
import { users } from "./identity";

/** Central de notificações + fila por canal (seção 75). */
export const notifications = pgTable("notifications", {
  id: id(),
  companyId: tenant(),
  userId: uuid("user_id").notNull().references(() => users.id),
  channel: notificationChannelEnum("channel").notNull().default("IN_APP"),
  topic: varchar("topic", { length: 30 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  status: varchar("status", { length: 12 }).$type<"QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "READ">().notNull().default("QUEUED"),
  sentAt: ts("sent_at"),
  readAt: ts("read_at"),
  error: text("error"),
  ...timestamps,
}, (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)]);

/**
 * Auditoria de negócio, somente inserção (seção 80). Separada dos logs técnicos,
 * que vão para o sistema de observabilidade (seção 109).
 */
export const auditLogs = pgTable("audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  companyId: tenant(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: varchar("action", { length: 60 }).notNull(),
  entity: varchar("entity", { length: 60 }).notNull(),
  entityId: text("entity_id").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  origin: varchar("origin", { length: 20 }).notNull(),
  ip: inet("ip"),
  userAgent: text("user_agent"),
  ...timestamps,
}, (t) => [index("audit_logs_entity_idx").on(t.companyId, t.entity, t.entityId), index("audit_logs_time_idx").on(t.companyId, t.createdAt)]);
