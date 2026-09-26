import type { RentalPeriod } from "./enums";

export interface Interval {
  start: Date;
  end: Date;
}

/** Intervalos semiabertos [start, end): devolução às 10h e retirada às 10h não conflitam. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

export function findConflicts<T extends Interval>(wanted: Interval, existing: readonly T[]): T[] {
  return existing.filter((e) => overlaps(wanted, e));
}

/** Próxima data em que o veículo fica livre (seção 26: "Disponível novamente em"). */
export function nextAvailableDate(busy: readonly Interval[], from: Date, bufferHours = 0): Date {
  const sorted = [...busy].sort((a, b) => a.start.getTime() - b.start.getTime());
  let cursor = from.getTime();
  for (const i of sorted) {
    if (i.end.getTime() <= cursor) continue;
    if (i.start.getTime() > cursor) break;
    cursor = i.end.getTime() + bufferHours * 3_600_000;
  }
  return new Date(cursor);
}

export interface VehicleRates {
  dailyCents: number;
  weeklyCents?: number | null;
  biweeklyCents?: number | null;
  monthlyCents?: number | null;
}

const PERIOD_DAYS: Record<RentalPeriod, number> = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 15, MONTHLY: 30 };

export function rentalDays(i: Interval): number {
  return Math.max(1, Math.ceil((i.end.getTime() - i.start.getTime()) / 86_400_000));
}

/**
 * Menor preço combinando pacotes (mensal, quinzenal, semanal) e diárias avulsas.
 * Valores em centavos para evitar erros de ponto flutuante.
 */
export function quoteRental(days: number, rates: VehicleRates): { totalCents: number; breakdown: Partial<Record<RentalPeriod, number>> } {
  const packages: [RentalPeriod, number | null | undefined][] = [
    ["MONTHLY", rates.monthlyCents],
    ["BIWEEKLY", rates.biweeklyCents],
    ["WEEKLY", rates.weeklyCents],
  ];
  // Programação dinâmica simples sobre os dias (limite de 365 dias por locação).
  const n = Math.min(days, 365);
  const best: { cost: number; from: RentalPeriod | null }[] = [{ cost: 0, from: null }];
  for (let d = 1; d <= n; d++) {
    let cur = { cost: best[d - 1]!.cost + rates.dailyCents, from: "DAILY" as RentalPeriod | null };
    for (const [period, price] of packages) {
      if (price == null) continue;
      const len = PERIOD_DAYS[period];
      const prev = best[Math.max(0, d - len)]!;
      if (prev.cost + price < cur.cost) cur = { cost: prev.cost + price, from: period };
    }
    best.push(cur);
  }
  const breakdown: Partial<Record<RentalPeriod, number>> = {};
  let d = n;
  while (d > 0) {
    const step = best[d]!;
    const period = step.from!;
    breakdown[period] = (breakdown[period] ?? 0) + 1;
    d = Math.max(0, d - PERIOD_DAYS[period]);
  }
  return { totalCents: best[n]!.cost, breakdown };
}

/** Preço exibido pelo representante: preço oficial + margem permitida (seção 65). */
export function representativePrice(officialCents: number, marginCents: number, maxMarginCents: number) {
  if (marginCents < 0 || marginCents > maxMarginCents) throw new Error("Margem fora do limite permitido.");
  return { customerCents: officialCents + marginCents, companyCents: officialCents, representativeCents: marginCents };
}
