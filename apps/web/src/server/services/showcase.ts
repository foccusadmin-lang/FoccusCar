import "server-only";
import { nextAvailableDate } from "@foccus/core";
import { rentals, reservations, vehicleCategories, vehiclePhotos, vehicles, withTenant } from "@foccus/db";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";

export const showcaseFiltersSchema = z.object({
  categoria: z.string().max(60).optional(),
  marca: z.string().max(60).optional(),
  cambio: z.enum(["MANUAL", "AUTOMATIC", "CVT", "AUTOMATED"]).optional(),
  combustivel: z.enum(["FLEX", "GASOLINE", "ETHANOL", "DIESEL", "HYBRID", "ELECTRIC"]).optional(),
  precoMax: z.coerce.number().int().positive().optional(),
  ordem: z.enum(["destaque", "preco", "novos", "disponibilidade"]).default("destaque"),
  pagina: z.coerce.number().int().min(1).default(1),
});
export type ShowcaseFilters = z.infer<typeof showcaseFiltersSchema>;

export interface ShowcaseVehicle {
  id: string;
  title: string;
  brand: string;
  model: string;
  version: string | null;
  modelYear: number;
  color: string | null;
  category: string | null;
  transmission: string;
  fuelType: string;
  seats: number | null;
  dailyRateCents: number | null;
  weeklyRateCents: number | null;
  monthlyRateCents: number | null;
  depositCents: number;
  featured: boolean;
  status: string;
  available: boolean;
  nextAvailableAt: string | null;
  coverKey: string | null;
  features: string[];
}

const PAGE_SIZE = 12;
const BUSY_RESERVATION = ["PENDING_PAYMENT", "CONFIRMED"] as const;
const BUSY_RENTAL = ["SCHEDULED", "CHECKOUT_IN_PROGRESS", "ACTIVE", "RETURN_IN_PROGRESS"] as const;

/**
 * Vitrine pública (seções 19, 25, 26): somente veículos marcados como visíveis,
 * sem dados internos (placa, chassi, custos). Veículo alugado aparece com a próxima disponibilidade.
 */
export async function listShowcase(companyId: string, filters: ShowcaseFilters, onlyId?: string) {
  return withTenant(db, { companyId }, async (tx) => {
    const where: SQL[] = [eq(vehicles.showcaseVisible, true), isNull(vehicles.deletedAt), inArray(vehicles.status, ["AVAILABLE", "RESERVED", "RENTED", "CLEANING", "INSPECTION"])];
    if (onlyId) where.push(eq(vehicles.id, onlyId));
    if (filters.categoria) where.push(eq(vehicleCategories.slug, filters.categoria));
    if (filters.marca) where.push(sql`lower(${vehicles.brand}) = lower(${filters.marca})`);
    if (filters.cambio) where.push(eq(vehicles.transmission, filters.cambio));
    if (filters.combustivel) where.push(eq(vehicles.fuelType, filters.combustivel));
    if (filters.precoMax) where.push(lte(vehicles.dailyRateCents, filters.precoMax * 100));

    const order =
      filters.ordem === "preco" ? [asc(vehicles.dailyRateCents)]
      : filters.ordem === "novos" ? [desc(vehicles.modelYear), desc(vehicles.createdAt)]
      : filters.ordem === "disponibilidade" ? [asc(sql`case when ${vehicles.status} = 'AVAILABLE' then 0 else 1 end`)]
      : [desc(vehicles.showcaseFeatured), asc(vehicles.dailyRateCents)];

    const rows = await tx
      .select({ v: vehicles, category: vehicleCategories.name })
      .from(vehicles)
      .leftJoin(vehicleCategories, eq(vehicleCategories.id, vehicles.categoryId))
      .where(and(...where))
      .orderBy(...order)
      .limit(PAGE_SIZE + 1)
      .offset((filters.pagina - 1) * PAGE_SIZE);

    const page = rows.slice(0, PAGE_SIZE);
    const ids = page.map((r) => r.v.id);
    const now = new Date();
    const [busyRes, busyRent, covers, categories] = await Promise.all([
      ids.length
        ? tx.select({ vehicleId: reservations.vehicleId, start: reservations.pickupAt, end: reservations.returnAt }).from(reservations)
            .where(and(inArray(reservations.vehicleId, ids), inArray(reservations.status, [...BUSY_RESERVATION]), gte(reservations.returnAt, now)))
        : [],
      ids.length
        ? tx.select({ vehicleId: rentals.vehicleId, start: rentals.startAt, end: rentals.expectedReturnAt }).from(rentals)
            .where(and(inArray(rentals.vehicleId, ids), inArray(rentals.status, [...BUSY_RENTAL]), or(isNull(rentals.actualReturnAt), gte(rentals.expectedReturnAt, now))))
        : [],
      ids.length
        ? tx.select().from(vehiclePhotos).where(and(inArray(vehiclePhotos.vehicleId, ids), eq(vehiclePhotos.isCover, true), eq(vehiclePhotos.isPublic, true)))
        : [],
      tx.select({ slug: vehicleCategories.slug, name: vehicleCategories.name }).from(vehicleCategories).where(isNull(vehicleCategories.deletedAt)).orderBy(asc(vehicleCategories.name)),
    ]);

    const items: ShowcaseVehicle[] = page.map(({ v, category }) => {
      const busy = [...busyRes, ...busyRent].filter((b) => b.vehicleId === v.id);
      const next = nextAvailableDate(busy, now, 2);
      const available = v.status === "AVAILABLE" && next.getTime() <= now.getTime();
      return {
        id: v.id,
        title: `${v.brand} ${v.model}`,
        brand: v.brand,
        model: v.model,
        version: v.version,
        modelYear: v.modelYear,
        color: v.color,
        category,
        transmission: v.transmission,
        fuelType: v.fuelType,
        seats: v.seats,
        dailyRateCents: v.showcasePricePublic ? v.dailyRateCents : null,
        weeklyRateCents: v.showcasePricePublic ? v.weeklyRateCents : null,
        monthlyRateCents: v.showcasePricePublic ? v.monthlyRateCents : null,
        depositCents: v.depositCents,
        featured: v.showcaseFeatured,
        status: v.status,
        available,
        nextAvailableAt: available ? null : next.toISOString(),
        coverKey: covers.find((c) => c.vehicleId === v.id)?.storageKey ?? null,
        features: v.features,
      };
    });

    return { items, categories, hasMore: rows.length > PAGE_SIZE, page: filters.pagina };
  });
}

export async function getShowcaseVehicle(companyId: string, id: string): Promise<ShowcaseVehicle | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { items } = await listShowcase(companyId, showcaseFiltersSchema.parse({}), id);
  return items[0] ?? null;
}
