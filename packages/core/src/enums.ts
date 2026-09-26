/**
 * Status e enumerações de domínio do Foccus Car.
 * Fonte única: o banco (packages/db) e a interface importam daqui.
 */

export const ROLES = ["CLIENTE", "REPRESENTANTE", "OPERADOR", "FINANCEIRO", "GERENTE", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** Ciclo de vida da conta (seção 21 da especificação). */
export const ACCOUNT_STATUSES = [
  "REGISTERED",
  "PROFILE_INCOMPLETE",
  "PROFILE_COMPLETE",
  "UNDER_REVIEW",
  "ACTIVE",
  "SUSPENDED",
  "BLOCKED",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const DOCUMENT_STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "EXPIRED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const CUSTOMER_DOCUMENT_TYPES = [
  "CNH_FRONT",
  "CNH_BACK",
  "RG",
  "PROOF_OF_ADDRESS",
  "SELFIE",
  "OTHER",
] as const;
export type CustomerDocumentType = (typeof CUSTOMER_DOCUMENT_TYPES)[number];

export const VEHICLE_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "RENTED",
  "MAINTENANCE",
  "INSPECTION",
  "CLEANING",
  "BLOCKED",
  "INACTIVE",
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const TRANSMISSIONS = ["MANUAL", "AUTOMATIC", "CVT", "AUTOMATED"] as const;
export const FUEL_TYPES = ["FLEX", "GASOLINE", "ETHANOL", "DIESEL", "HYBRID", "ELECTRIC"] as const;

export const RENTAL_PERIODS = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const;
export type RentalPeriod = (typeof RENTAL_PERIODS)[number];

export const RESERVATION_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
  "CONVERTED",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RENTAL_STATUSES = [
  "SCHEDULED",
  "CHECKOUT_IN_PROGRESS",
  "ACTIVE",
  "RETURN_IN_PROGRESS",
  "PENDING_SETTLEMENT",
  "CLOSED",
  "CANCELLED",
] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

export const CONTRACT_STATUSES = ["DRAFT", "ISSUED", "SIGNED", "CANCELLED"] as const;

export const CHECKLIST_TYPES = ["CHECKOUT", "RETURN", "INSPECTION"] as const;
export const CHECKLIST_ITEM_RESULTS = ["OK", "DAMAGE", "NOTE", "PHOTO"] as const;

/** Níveis de combustível em oitavos para comparação saída x retorno (seção 39). */
export const FUEL_LEVELS = { FULL: 8, THREE_QUARTERS: 6, HALF: 4, QUARTER: 2, RESERVE: 1 } as const;
export type FuelLevel = keyof typeof FUEL_LEVELS;

export const CHECKLIST_ITEMS = [
  "capo", "teto", "portas", "para_choques", "retrovisores", "vidros", "farois", "lanternas",
  "pneus", "rodas", "bancos", "painel", "volante", "cambio", "ar_condicionado", "multimidia",
  "tapetes", "cintos", "estepe", "macaco", "chave_de_roda", "triangulo", "chave",
] as const;

export const DAMAGE_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const MAINTENANCE_TYPES = [
  "PREVENTIVE", "CORRECTIVE", "REVIEW", "OIL", "BRAKES", "TIRES", "SUSPENSION", "ENGINE",
  "ELECTRICAL", "AIR_CONDITIONING", "BODYWORK", "OTHER",
] as const;
export const MAINTENANCE_STATUSES = ["SCHEDULED", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

export const PAYMENT_METHODS = ["PIX", "CREDIT_CARD", "DEBIT_CARD", "CHECKOUT_LINK"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "PENDING", "PROCESSING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED",
  "REFUNDED", "PARTIALLY_REFUNDED", "CHARGEBACK", "FAILED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FINANCIAL_DIRECTIONS = ["INCOME", "EXPENSE"] as const;
export const FINANCIAL_CATEGORIES = [
  "RENTAL", "DEPOSIT", "FUEL", "DAMAGE", "EXTRA_KM", "FINE", "EXTRA_DAY", "LATE_FEE", "CLEANING",
  "LOST_ITEM", "FEE", "MAINTENANCE", "INSURANCE", "DOCUMENTATION", "OPERATION", "REPRESENTATIVE_MARGIN",
  "REFUND", "ADJUSTMENT", "OTHER",
] as const;

export const DEPOSIT_STATUSES = ["PENDING", "HELD", "PARTIALLY_RETAINED", "RETAINED", "RELEASED", "REFUNDED"] as const;

export const SECURITY_ALERT_TYPES = [
  "GEOFENCE_EXIT", "GEOFENCE_ENTRY_FORBIDDEN", "COMMUNICATION_LOST", "UNEXPECTED_MOVEMENT",
  "IGNITION", "OFF_HOURS_MOVEMENT", "TAMPER",
] as const;
export const SECURITY_ALERT_STATUSES = ["NEW", "ANALYZING", "RESOLVED", "IGNORED"] as const;

export const TELEMATICS_COMMANDS = ["BLOCK", "UNBLOCK"] as const;
export const TELEMATICS_COMMAND_STATUSES = ["REQUESTED", "SENT", "CONFIRMED", "FAILED", "REJECTED"] as const;

export const WITHDRAWAL_STATUSES = ["REQUESTED", "REVIEW", "APPROVED", "PROCESSING", "PAID", "REJECTED"] as const;
export const WALLET_TX_STATUSES = ["PENDING", "AVAILABLE", "WITHDRAWN", "REVERSED"] as const;

export const FINE_STATUSES = ["RECEIVED", "DRIVER_IDENTIFIED", "CHARGED", "PAID", "CONTESTED", "CANCELLED"] as const;
export const OCCURRENCE_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL", "WHATSAPP", "PUSH"] as const;

/** Tipos de evento da "Vida do Veículo" (seção 31). */
export const VEHICLE_EVENT_TYPES = [
  "FLEET_ENTRY", "RESERVATION", "RENTAL_START", "RENTAL_END", "CHECKOUT", "RETURN", "MILEAGE",
  "FUEL", "CHECKLIST", "PHOTO", "DAMAGE", "REPAIR", "MAINTENANCE", "TIRES", "OIL", "FINE",
  "ACCIDENT", "OCCURRENCE", "GPS", "BLOCK", "UNBLOCK", "DOCUMENT", "COST", "REVENUE",
  "STATUS_CHANGE", "ADMIN_CHANGE",
] as const;
export type VehicleEventType = (typeof VEHICLE_EVENT_TYPES)[number];
