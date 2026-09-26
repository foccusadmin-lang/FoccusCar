import { FUEL_LEVELS, type FuelLevel } from "./enums";

export interface ChecklistSnapshot {
  mileageKm: number;
  fuel: FuelLevel;
  items: Record<string, { result: "OK" | "DAMAGE" | "NOTE" | "PHOTO"; missing?: boolean }>;
  damageIds: readonly string[];
}

export interface ReturnComparison {
  kmDriven: number;
  kmExcess: number;
  fuelEighthsMissing: number;
  newDamageItems: string[];
  missingItems: string[];
}

/** Compara saída x devolução (seção 40). */
export function compareChecklists(out: ChecklistSnapshot, back: ChecklistSnapshot, kmAllowance: number | null): ReturnComparison {
  const kmDriven = Math.max(0, back.mileageKm - out.mileageKm);
  const newDamageItems: string[] = [];
  const missingItems: string[] = [];
  for (const [item, b] of Object.entries(back.items)) {
    const o = out.items[item];
    if (b.result === "DAMAGE" && o?.result !== "DAMAGE") newDamageItems.push(item);
    if (b.missing && !o?.missing) missingItems.push(item);
  }
  return {
    kmDriven,
    kmExcess: kmAllowance == null ? 0 : Math.max(0, kmDriven - kmAllowance),
    fuelEighthsMissing: Math.max(0, FUEL_LEVELS[out.fuel] - FUEL_LEVELS[back.fuel]),
    newDamageItems,
    missingItems,
  };
}

/** Status da manutenção (seção 45): GREEN em dia, YELLOW próxima, RED atrasada. */
export function maintenanceHealth(
  now: { date: Date; km: number },
  next: { date?: Date | null; km?: number | null },
  warn = { days: 15, km: 1000 },
): "GREEN" | "YELLOW" | "RED" {
  const daysLeft = next.date ? (next.date.getTime() - now.date.getTime()) / 86_400_000 : Infinity;
  const kmLeft = next.km != null ? next.km - now.km : Infinity;
  if (daysLeft < 0 || kmLeft < 0) return "RED";
  if (daysLeft <= warn.days || kmLeft <= warn.km) return "YELLOW";
  return "GREEN";
}
