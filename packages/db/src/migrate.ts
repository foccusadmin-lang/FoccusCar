import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Aplica as migrations e, em seguida, as políticas (RLS, restrições, imutabilidade). */
export async function runMigrations(url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_MIGRATION_URL não configurada.");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
    await client.unsafe(readFileSync(fileURLToPath(new URL("../sql/policies.sql", import.meta.url)), "utf8"));
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().then(
    () => console.log("Migrations e políticas aplicadas."),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
