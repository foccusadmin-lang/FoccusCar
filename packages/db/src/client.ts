import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * A aplicação conecta com o papel `foccus_app` (sem superusuário, sujeito a RLS).
 * Migrations usam DATABASE_MIGRATION_URL (dono do schema).
 */
export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL não configurada.");
  const client = postgres(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 10), prepare: false });
  return drizzle(client, { schema, casing: "snake_case" });
}

let singleton: Database | undefined;
export function getDb(): Database {
  singleton ??= createDb();
  return singleton;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Executa `fn` dentro de uma transação com o tenant fixado (seção 12).
 * O Postgres aplica as políticas RLS a partir de `app.company_id`, então mesmo
 * uma consulta esquecida sem filtro nunca enxerga dados de outra empresa.
 */
export async function withTenant<T>(
  db: Database,
  ctx: { companyId: string; userId?: string | null },
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(ctx.companyId)) throw new Error("Empresa inválida.");
  if (ctx.userId && !UUID_RE.test(ctx.userId)) throw new Error("Usuário inválido.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.company_id', ${ctx.companyId}, true), set_config('app.user_id', ${ctx.userId ?? ""}, true)`);
    return fn(tx);
  });
}

/** Contexto apenas do usuário (ex.: listar as empresas das quais ele participa). */
export async function withUser<T>(db: Database, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(userId)) throw new Error("Usuário inválido.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}
