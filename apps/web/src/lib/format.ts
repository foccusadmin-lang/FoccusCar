const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

export const formatCents = (cents: number) => brl.format(cents / 100);
export const formatDate = (d: Date | string) => date.format(typeof d === "string" ? new Date(d) : d);

export const TRANSMISSION_LABEL: Record<string, string> = { MANUAL: "Manual", AUTOMATIC: "Automático", CVT: "Automático CVT", AUTOMATED: "Automatizado" };
export const FUEL_LABEL: Record<string, string> = { FLEX: "Flex", GASOLINE: "Gasolina", ETHANOL: "Etanol", DIESEL: "Diesel", HYBRID: "Híbrido", ELECTRIC: "Elétrico" };
export const VEHICLE_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível", RESERVED: "Reservado", RENTED: "Alugado", MAINTENANCE: "Em manutenção", INSPECTION: "Em inspeção",
  CLEANING: "Em preparação", BLOCKED: "Bloqueado", INACTIVE: "Inativo",
};
export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Conta criada", PROFILE_INCOMPLETE: "Cadastro incompleto", PROFILE_COMPLETE: "Cadastro completo",
  UNDER_REVIEW: "Em análise", ACTIVE: "Ativa", SUSPENDED: "Suspensa", BLOCKED: "Bloqueada",
};
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
export const formatDateTime = (d: Date | string) => dateTime.format(typeof d === "string" ? new Date(d) : d);
export const formatKm = (km: number) => `${km.toLocaleString("pt-BR")} km`;
/** "1.234,56" ou "1234.56" → centavos. Vazio → null. */
export function parseMoneyToCents(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
export const centsToInput = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
