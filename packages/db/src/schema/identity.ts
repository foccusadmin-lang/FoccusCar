import { boolean, index, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { authorship, id, softDelete, timestamps, ts } from "./_shared";
import { accountStatusEnum, roleEnum } from "./enums";

/**
 * Empresas (tenants). Cada locadora é um ambiente lógico isolado (seção 12).
 * `domain` permite resolver o tenant pelo endereço acessado (ex.: app.foccuscar.com.br).
 */
export const companies = pgTable("companies", {
  id: id(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  cnpj: varchar("cnpj", { length: 14 }),
  slug: varchar("slug", { length: 60 }).notNull(),
  domain: text("domain"),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
  ...softDelete,
}, (t) => [uniqueIndex("companies_slug_uq").on(t.slug), uniqueIndex("companies_domain_uq").on(t.domain)]);

/**
 * Identidade interna (seção 15). Tabelas users/sessions/accounts/verifications seguem o
 * formato do Better Auth. O vínculo com Google/Microsoft/Apple fica em `accounts`
 * (provider_id + account_id), permitindo vários provedores por pessoa sem usar o e-mail como chave.
 */
export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  status: accountStatusEnum("status").notNull().default("PROFILE_INCOMPLETE"),
  /** Operador da plataforma SaaS (não de uma locadora). Só por seed/CLI, nunca por cadastro. */
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  lastLoginAt: ts("last_login_at"),
  ...timestamps,
  ...softDelete,
}, (t) => [uniqueIndex("users_email_uq").on(t.email)]);

export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: ts("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  /** Empresa ativa nesta sessão (usuário pode pertencer a mais de uma). */
  activeCompanyId: uuid("active_company_id").references(() => companies.id),
  ...timestamps,
}, (t) => [uniqueIndex("sessions_token_uq").on(t.token), index("sessions_user_idx").on(t.userId)]);

/** Contas de login vinculadas: provider (google, microsoft, apple, credential) + id no provedor. */
export const accounts = pgTable("accounts", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull(),
  accountId: text("account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  /** Hash da senha (login por e-mail). Nunca a senha em texto. */
  password: text("password"),
  ...timestamps,
}, (t) => [uniqueIndex("accounts_provider_uq").on(t.providerId, t.accountId), index("accounts_user_idx").on(t.userId)]);

export const verifications = pgTable("verifications", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  ...timestamps,
}, (t) => [index("verifications_identifier_idx").on(t.identifier)]);

/** Perfis configuráveis por empresa (seção 16). Os papéis-base usam `key` = Role. */
export const roles = pgTable("roles", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  key: roleEnum("key").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  ...timestamps,
}, (t) => [uniqueIndex("roles_company_key_uq").on(t.companyId, t.key)]);

/** Catálogo global de permissões ("modulo:acao"). */
export const permissions = pgTable("permissions", {
  key: varchar("key", { length: 80 }).primaryKey(),
  description: text("description"),
  ...timestamps,
});

export const rolePermissions = pgTable("role_permissions", {
  companyId: uuid("company_id").notNull().references(() => companies.id),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionKey: varchar("permission_key", { length: 80 }).notNull().references(() => permissions.key),
  ...timestamps,
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })]);

/** Vínculo usuário ↔ empresa ↔ perfil. Cadastro público cria somente CLIENTE. */
export const companyMembers = pgTable("company_members", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: roleEnum("role").notNull().default("CLIENTE"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
  ...authorship,
}, (t) => [uniqueIndex("company_members_uq").on(t.companyId, t.userId, t.role), index("company_members_user_idx").on(t.userId)]);
