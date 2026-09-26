import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

/** ID único (UUID v4 gerado pelo Postgres). */
export const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);

/** created_at / updated_at em todas as entidades (seção 11). */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};

/** Exclusão lógica: nada crítico desaparece (seção 105). */
export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

/** Quem criou / alterou. Referência lógica a users.id. */
export const authorship = {
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

export const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Coluna de tenant. Toda tabela com ela recebe política RLS automaticamente (sql/policies.sql). */
export const tenant = () => uuid("company_id").notNull();
