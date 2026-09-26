import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb, withTenant, type Database } from "./client";
import { ensureCompany } from "./bootstrap";
import { auditLogs, customers, financialTransactions, reservations, vehicles } from "./schema";

/**
 * Testes de integração contra um Postgres real, conectando como `foccus_app`
 * (mesmo papel da aplicação). Rodam quando TEST_DATABASE_URL está definida.
 */
const url = process.env.TEST_DATABASE_URL;
const owner = process.env.TEST_DATABASE_MIGRATION_URL ?? url;

describe.skipIf(!url)("isolamento multiempresa e integridade", () => {
  let db: Database;
  let a: string;
  let b: string;
  const suffix = Math.random().toString(36).slice(2, 8);

  const vehicle = (companyId: string, plate: string) => ({
    companyId, plate, brand: "Teste", model: "X", modelYear: 2026, transmission: "MANUAL" as const,
    fuelType: "FLEX" as const, dailyRateCents: 10000,
  });

  beforeAll(async () => {
    const ownerDb = createDb(owner);
    a = (await ensureCompany(ownerDb, { name: "Locadora A", slug: `a-${suffix}` })).id;
    b = (await ensureCompany(ownerDb, { name: "Locadora B", slug: `b-${suffix}` })).id;
    await ownerDb.$client.end();
    db = createDb(url);
    await withTenant(db, { companyId: a }, (tx) => tx.insert(vehicles).values(vehicle(a, `A${suffix}`.slice(0, 7))));
    await withTenant(db, { companyId: b }, (tx) => tx.insert(vehicles).values(vehicle(b, `B${suffix}`.slice(0, 7))));
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("cada empresa só enxerga os próprios veículos", async () => {
    const seenByA = await withTenant(db, { companyId: a }, (tx) => tx.select().from(vehicles));
    expect(seenByA.length).toBeGreaterThan(0);
    expect(seenByA.every((v) => v.companyId === a)).toBe(true);
  });

  it("sem empresa definida, nenhuma linha é visível", async () => {
    const rows = await db.select().from(vehicles);
    expect(rows).toEqual([]);
  });

  it("não grava dados em outra empresa", async () => {
    await expect(
      withTenant(db, { companyId: a }, (tx) => tx.insert(vehicles).values(vehicle(b, "ZZZ9Z99"))),
    ).rejects.toThrow();
  });

  it("não altera dados de outra empresa", async () => {
    const updated = await withTenant(db, { companyId: a }, (tx) =>
      tx.update(vehicles).set({ color: "Rosa" }).where(sql`company_id = ${b}`).returning(),
    );
    expect(updated).toEqual([]);
  });

  it("o banco impede reservas sobrepostas do mesmo veículo", async () => {
    await withTenant(db, { companyId: a }, async (tx) => {
      const [v] = await tx.select().from(vehicles).limit(1);
      const [c] = await tx.insert(customers).values({ companyId: a, fullName: "Cliente Teste" }).returning();
      const base = {
        companyId: a, customerId: c!.id, vehicleId: v!.id, priceCents: 1000, totalCents: 1000, status: "CONFIRMED" as const,
      };
      await tx.insert(reservations).values({ ...base, code: `R1${suffix}`, pickupAt: new Date("2030-01-01T10:00Z"), returnAt: new Date("2030-01-05T10:00Z") });
      // Encostar (devolução = retirada) é permitido.
      await tx.insert(reservations).values({ ...base, code: `R2${suffix}`, pickupAt: new Date("2030-01-05T10:00Z"), returnAt: new Date("2030-01-06T10:00Z") });
    });
    await expect(
      withTenant(db, { companyId: a }, async (tx) => {
        const [r] = await tx.select().from(reservations).limit(1);
        await tx.insert(reservations).values({
          companyId: a, customerId: r!.customerId, vehicleId: r!.vehicleId, priceCents: 1000, totalCents: 1000,
          status: "CONFIRMED", code: `R3${suffix}`, pickupAt: new Date("2030-01-03T00:00Z"), returnAt: new Date("2030-01-04T00:00Z"),
        });
      }),
    ).rejects.toThrow();
  });

  it("auditoria é somente inserção", async () => {
    await withTenant(db, { companyId: a }, (tx) =>
      tx.insert(auditLogs).values({ companyId: a, action: "test", entity: "vehicles", entityId: "1", origin: "test" }),
    );
    await expect(
      withTenant(db, { companyId: a }, (tx) => tx.update(auditLogs).set({ action: "hack" })),
    ).rejects.toThrow();
  });

  it("lançamento financeiro confirmado não pode ser alterado nem apagado", async () => {
    const [tx1] = await withTenant(db, { companyId: a }, (tx) =>
      tx.insert(financialTransactions).values({
        companyId: a, direction: "INCOME", category: "RENTAL", status: "CONFIRMED", amountCents: 5000,
        competenceDate: "2030-01-01", description: "Locação teste",
      }).returning(),
    );
    await expect(
      withTenant(db, { companyId: a }, (tx) => tx.update(financialTransactions).set({ amountCents: 1 }).where(sql`id = ${tx1!.id}`)),
    ).rejects.toThrow();
    await expect(
      withTenant(db, { companyId: a }, (tx) => tx.delete(financialTransactions).where(sql`id = ${tx1!.id}`)),
    ).rejects.toThrow();
  });
});
