import { eq } from "drizzle-orm";
import { createDb, ownerDatabaseUrl, withTenant } from "./client";
import { ensureCompany } from "./bootstrap";
import { locations, vehicleCategories, vehicleEvents, vehicles } from "./schema";

/** Dados de desenvolvimento: empresa Foccus Car, categorias e alguns veículos na vitrine. */
async function main() {
  const db = createDb(ownerDatabaseUrl());
  const company = await ensureCompany(db, {
    name: "Foccus Car",
    slug: process.env.DEFAULT_COMPANY_SLUG ?? "foccus-car",
    domain: process.env.DEFAULT_COMPANY_DOMAIN ?? null,
  });

  await withTenant(db, { companyId: company.id }, async (tx) => {
    const already = await tx.select({ id: vehicles.id }).from(vehicles).limit(1);
    if (already.length) return;

    const cats = await tx
      .insert(vehicleCategories)
      .values([
        { companyId: company.id, name: "Sedã Executivo", slug: "seda-executivo" },
        { companyId: company.id, name: "SUV", slug: "suv" },
        { companyId: company.id, name: "Hatch", slug: "hatch" },
      ])
      .returning();
    const bySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
    const [loc] = await tx
      .insert(locations)
      .values({ companyId: company.id, name: "Loja Central", city: "São Paulo", state: "SP" })
      .returning();

    const fleet = [
      { plate: "FCC1A23", brand: "Toyota", model: "Corolla", version: "Altis Hybrid", modelYear: 2026, color: "Preto", cat: "seda-executivo", transmission: "CVT", fuelType: "HYBRID", daily: 28900, featured: true },
      { plate: "FCC2B34", brand: "Jeep", model: "Compass", version: "Limited T270", modelYear: 2025, color: "Cinza Grafite", cat: "suv", transmission: "AUTOMATIC", fuelType: "FLEX", daily: 32900, featured: true },
      { plate: "FCC3C45", brand: "Volkswagen", model: "Polo", version: "Highline TSI", modelYear: 2025, color: "Branco", cat: "hatch", transmission: "AUTOMATIC", fuelType: "FLEX", daily: 17900, featured: false },
      { plate: "FCC4D56", brand: "BYD", model: "Seal", version: "AWD", modelYear: 2026, color: "Prata", cat: "seda-executivo", transmission: "AUTOMATIC", fuelType: "ELECTRIC", daily: 45900, featured: true },
    ] as const;

    for (const v of fleet) {
      const [row] = await tx
        .insert(vehicles)
        .values({
          companyId: company.id, plate: v.plate, brand: v.brand, model: v.model, version: v.version,
          modelYear: v.modelYear, color: v.color, categoryId: bySlug[v.cat], transmission: v.transmission,
          fuelType: v.fuelType, seats: 5, status: "AVAILABLE", dailyRateCents: v.daily,
          weeklyRateCents: v.daily * 6, monthlyRateCents: v.daily * 22, depositCents: 150000,
          kmAllowancePerDay: 200, extraKmCents: 150, locationId: loc!.id, showcaseVisible: true,
          showcaseFeatured: v.featured, acquiredAt: new Date(),
        })
        .returning();
      await tx.insert(vehicleEvents).values({
        companyId: company.id, vehicleId: row!.id, type: "FLEET_ENTRY", description: "Entrada na frota", source: "seed",
      });
    }
  });

  console.log(`Seed concluído para a empresa ${company.name} (${company.id}).`);
  await db.$client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
