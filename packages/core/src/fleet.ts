import { z } from "zod";
import { FUEL_TYPES, TRANSMISSIONS, type VehicleStatus } from "./enums";

/** Rótulos em português para status de veículo (seção 30). */
export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  AVAILABLE: "Disponível",
  RESERVED: "Reservado",
  RENTED: "Alugado",
  MAINTENANCE: "Em manutenção",
  INSPECTION: "Em inspeção",
  CLEANING: "Em preparação",
  BLOCKED: "Bloqueado",
  INACTIVE: "Inativo",
};

/**
 * Status que o painel pode definir manualmente. RESERVED e RENTED vêm só da operação
 * (reserva e locação), para o status nunca mentir sobre onde o carro está.
 */
export const MANUAL_VEHICLE_STATUSES = ["AVAILABLE", "MAINTENANCE", "INSPECTION", "CLEANING", "BLOCKED", "INACTIVE"] as const;
export type ManualVehicleStatus = (typeof MANUAL_VEHICLE_STATUSES)[number];

/** Mudanças que exigem motivo e confirmação (seção 104). */
export const STATUS_NEEDS_REASON: readonly VehicleStatus[] = ["BLOCKED", "INACTIVE", "MAINTENANCE"];

export function checkManualStatusChange(from: VehicleStatus, to: VehicleStatus): { ok: true } | { ok: false; reason: string } {
  if (from === to) return { ok: false, reason: "O veículo já está com este status." };
  if (!(MANUAL_VEHICLE_STATUSES as readonly string[]).includes(to))
    return { ok: false, reason: "Reservado e Alugado são definidos automaticamente pela reserva e pela locação." };
  if (from === "RENTED") return { ok: false, reason: "O veículo está alugado. Finalize a devolução antes de mudar o status." };
  return { ok: true };
}

/**
 * Status administrativo BLOCKED é só uma trava no sistema (o carro não pode ser reservado).
 * Não é bloqueio físico: esse depende do rastreador compatível (seção 62).
 */
export const ADMIN_BLOCK_NOTE = "Bloqueio administrativo: impede novas reservas. Não envia comando ao rastreador.";

/** Tipos de documento da frota (seção 74). */
export const VEHICLE_DOCUMENT_TYPES = ["CRLV", "LICENSING", "INSURANCE", "IPVA", "INVOICE", "CONTRACT", "INSPECTION", "OTHER"] as const;
export type VehicleDocumentType = (typeof VEHICLE_DOCUMENT_TYPES)[number];

export const VEHICLE_DOCUMENT_LABELS: Record<VehicleDocumentType, string> = {
  CRLV: "Documento do veículo (CRLV)",
  LICENSING: "Licenciamento",
  INSURANCE: "Seguro",
  IPVA: "IPVA",
  INVOICE: "Nota fiscal",
  CONTRACT: "Contrato",
  INSPECTION: "Vistoria / laudo",
  OTHER: "Outro documento",
};

export type ExpiryState = "NO_EXPIRY" | "VALID" | "EXPIRING" | "EXPIRED";

/** Alerta de vencimento: EXPIRING a partir de `warnDays` dias antes (padrão 30). */
export function documentExpiry(expiresAt: Date | string | null | undefined, now = new Date(), warnDays = 30): { state: ExpiryState; daysLeft: number | null } {
  if (!expiresAt) return { state: "NO_EXPIRY", daysLeft: null };
  const end = new Date(expiresAt);
  const day = 86_400_000;
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / day);
  if (daysLeft < 0) return { state: "EXPIRED", daysLeft };
  if (daysLeft <= warnDays) return { state: "EXPIRING", daysLeft };
  return { state: "VALID", daysLeft };
}

/** Placa no padrão antigo (ABC1234) ou Mercosul (ABC1D23), sem hífen. */
export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidPlate(value: string): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizePlate(value));
}

export function formatPlate(value: string): string {
  const p = normalizePlate(value);
  return /^[A-Z]{3}[0-9]{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

/** Ocupação da frota: alugados + reservados sobre a frota operável (exclui inativos). */
export function fleetOccupancy(counts: Partial<Record<VehicleStatus, number>>): number {
  const total = Object.entries(counts).reduce((a, [s, n]) => (s === "INACTIVE" ? a : a + (n ?? 0)), 0);
  if (!total) return 0;
  return Math.round((((counts.RENTED ?? 0) + (counts.RESERVED ?? 0)) / total) * 100);
}

const cents = (label: string) => z.coerce.number({ error: `${label}: valor inválido.` }).int().min(0, `${label}: valor inválido.`).max(10_000_000_00);
const optCents = (label: string) => z.union([z.null(), z.literal(""), cents(label)]).optional().transform((v) => (v === "" || v == null ? null : v));
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const thisYear = new Date().getFullYear();

/** Data sem hora ("AAAA-MM-DD") guardada ao meio-dia UTC, para não virar o dia anterior no fuso do Brasil. */
export const dateOnly = z.union([z.literal(""), z.null(), z.coerce.date({ error: "Data inválida." })]).optional().transform((v) => {
  if (v === "" || v == null) return null;
  const d = new Date(v);
  d.setUTCHours(12, 0, 0, 0);
  return d;
});

/** Cadastro/edição de veículo (seção 29). Valores em centavos. A API sempre revalida. */
export const vehicleInputSchema = z.object({
  plate: z.string().transform(normalizePlate).refine(isValidPlate, "Placa inválida. Use ABC1234 ou ABC1D23."),
  renavam: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v === "" || /^\d{9,11}$/.test(v), "RENAVAM inválido.").transform((v) => v || null).optional(),
  chassis: z.string().trim().toUpperCase().refine((v) => v === "" || /^[A-HJ-NPR-Z0-9]{17}$/.test(v), "Chassi deve ter 17 caracteres.").transform((v) => v || null).optional(),
  brand: z.string().trim().min(2, "Informe a marca.").max(40),
  model: z.string().trim().min(1, "Informe o modelo.").max(60),
  version: optText(80),
  modelYear: z.coerce.number().int().min(1990, "Ano inválido.").max(thisYear + 1, "Ano inválido."),
  manufactureYear: z.union([z.literal(""), z.null(), z.coerce.number().int().min(1990).max(thisYear + 1)]).optional().transform((v) => (v === "" || v == null ? null : v)),
  color: optText(40),
  categoryId: z.union([z.literal(""), z.null(), z.uuid()]).optional().transform((v) => v || null),
  locationId: z.union([z.literal(""), z.null(), z.uuid()]).optional().transform((v) => v || null),
  transmission: z.enum(TRANSMISSIONS, { error: "Escolha o câmbio." }),
  fuelType: z.enum(FUEL_TYPES, { error: "Escolha o combustível." }),
  seats: z.union([z.literal(""), z.null(), z.coerce.number().int().min(1).max(60)]).optional().transform((v) => (v === "" || v == null ? null : v)),
  currentKm: z.coerce.number({ error: "KM inválido." }).int().min(0, "KM inválido.").max(3_000_000),
  features: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  dailyRateCents: cents("Diária").refine((v) => v > 0, "Informe o valor da diária."),
  weeklyRateCents: optCents("Semanal"),
  biweeklyRateCents: optCents("Quinzenal"),
  monthlyRateCents: optCents("Mensal"),
  depositCents: cents("Caução").default(0),
  kmAllowancePerDay: z.union([z.literal(""), z.null(), z.coerce.number().int().min(0).max(5000)]).optional().transform((v) => (v === "" || v == null ? null : v)),
  extraKmCents: optCents("KM excedente"),
  showcaseVisible: z.coerce.boolean().default(false),
  showcasePricePublic: z.coerce.boolean().default(true),
  showcaseFeatured: z.coerce.boolean().default(false),
  acquiredAt: dateOnly,
  acquisitionCents: optCents("Valor de aquisição"),
});
export type VehicleInput = z.input<typeof vehicleInputSchema>;
export type VehicleData = z.output<typeof vehicleInputSchema>;

/** Campos cuja alteração exige motivo (dados críticos, seção 104). */
export const CRITICAL_VEHICLE_FIELDS = ["plate", "renavam", "chassis", "currentKm", "acquisitionCents"] as const;

export const VEHICLE_FIELD_LABELS: Record<string, string> = {
  plate: "Placa", renavam: "RENAVAM", chassis: "Chassi", brand: "Marca", model: "Modelo", version: "Versão",
  modelYear: "Ano modelo", manufactureYear: "Ano de fabricação", color: "Cor", categoryId: "Categoria",
  locationId: "Localização", transmission: "Câmbio", fuelType: "Combustível", seats: "Lugares", currentKm: "KM atual",
  features: "Características", dailyRateCents: "Diária", weeklyRateCents: "Semanal", biweeklyRateCents: "Quinzenal",
  monthlyRateCents: "Mensal", depositCents: "Caução", kmAllowancePerDay: "KM livre por dia", extraKmCents: "KM excedente",
  showcaseVisible: "Visível na vitrine", showcasePricePublic: "Preço público", showcaseFeatured: "Destaque",
  acquiredAt: "Data de aquisição", acquisitionCents: "Valor de aquisição", status: "Status",
};
