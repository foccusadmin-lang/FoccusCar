import { boolean, date, index, jsonb, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { authorship, id, softDelete, tenant, timestamps, ts } from "./_shared";
import { customerDocumentTypeEnum, documentStatusEnum } from "./enums";
import { users } from "./identity";

/** Cadastro do cliente dentro da empresa (seção 22). Dados pessoais protegidos (LGPD). */
export const customers = pgTable("customers", {
  id: id(),
  companyId: tenant(),
  userId: uuid("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  cpf: varchar("cpf", { length: 11 }),
  birthDate: date("birth_date"),
  phone: varchar("phone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  email: text("email"),
  zip: varchar("zip", { length: 8 }),
  street: text("street"),
  number: varchar("number", { length: 20 }),
  complement: text("complement"),
  district: text("district"),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  profileCompletedAt: ts("profile_completed_at"),
  notes: text("notes"),
  ...timestamps,
  ...softDelete,
  ...authorship,
}, (t) => [
  uniqueIndex("customers_company_cpf_uq").on(t.companyId, t.cpf),
  uniqueIndex("customers_company_user_uq").on(t.companyId, t.userId),
  index("customers_company_name_idx").on(t.companyId, t.fullName),
]);

/** Condutores: o próprio cliente ou terceiros autorizados (seções 35 e 36). */
export const drivers = pgTable("drivers", {
  id: id(),
  companyId: tenant(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  fullName: text("full_name").notNull(),
  cpf: varchar("cpf", { length: 11 }).notNull(),
  isCustomerSelf: boolean("is_customer_self").notNull().default(false),
  cnhNumber: varchar("cnh_number", { length: 11 }),
  cnhCategories: varchar("cnh_categories", { length: 4 }),
  cnhIssuedAt: date("cnh_issued_at"),
  cnhExpiresAt: date("cnh_expires_at"),
  ...timestamps,
  ...softDelete,
  ...authorship,
}, (t) => [index("drivers_customer_idx").on(t.customerId), uniqueIndex("drivers_company_cpf_uq").on(t.companyId, t.cpf)]);

/** Documentos do cliente/condutor com status e histórico de análise (seção 23). */
export const customerDocuments = pgTable("customer_documents", {
  id: id(),
  companyId: tenant(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  driverId: uuid("driver_id").references(() => drivers.id),
  type: customerDocumentTypeEnum("type").notNull(),
  customTypeLabel: text("custom_type_label"),
  status: documentStatusEnum("status").notNull().default("PENDING"),
  /** Chave do arquivo no storage (nunca o arquivo no banco). */
  storageKey: text("storage_key").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: text("size_bytes"),
  submittedAt: ts("submitted_at").notNull().defaultNow(),
  reviewedAt: ts("reviewed_at"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  expiresAt: date("expires_at"),
  /** Histórico de mudanças de status: [{status, at, by, reason}]. */
  history: jsonb("history").$type<{ status: string; at: string; by?: string; reason?: string }[]>().notNull().default([]),
  ...timestamps,
  ...softDelete,
}, (t) => [index("customer_documents_customer_idx").on(t.customerId, t.type)]);
