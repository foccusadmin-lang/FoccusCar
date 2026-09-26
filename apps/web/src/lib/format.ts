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
