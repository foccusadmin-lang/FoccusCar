/**
 * Arquitetura de telemetria (seção 62):
 * Foccus Car → TelematicsAdapter → Provider/API → Rastreador → Veículo.
 * Cada fornecedor de rastreador vira um adapter. GPS sozinho NÃO bloqueia veículo.
 */
export interface DeviceCapabilities {
  positions: boolean;
  ignition: boolean;
  remoteBlock: boolean;
  tamper: boolean;
}

export interface Position {
  externalDeviceId: string;
  recordedAt: Date;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  heading?: number;
  ignition?: boolean;
  raw?: unknown;
}

export interface CommandResult {
  /** CONFIRMED somente quando o provedor confirma a execução no veículo. */
  status: "SENT" | "CONFIRMED" | "FAILED" | "REJECTED";
  providerRequestId?: string;
  providerResponse?: unknown;
}

export interface TelematicsAdapter {
  readonly provider: string;
  capabilities(externalDeviceId: string): Promise<DeviceCapabilities>;
  latestPositions(externalDeviceIds: string[]): Promise<Position[]>;
  history(externalDeviceId: string, from: Date, to: Date): Promise<Position[]>;
  sendCommand(externalDeviceId: string, command: "BLOCK" | "UNBLOCK"): Promise<CommandResult>;
  commandStatus(providerRequestId: string): Promise<CommandResult>;
  /** Normaliza posições/eventos recebidos por push (webhook) do provedor. */
  parseWebhook(input: { headers: Headers; rawBody: string }): Promise<Position[]>;
}

export interface BlockSafetyInput {
  command: "BLOCK" | "UNBLOCK";
  device: { supportsRemoteBlock: boolean; active: boolean } | null;
  lastPosition: { recordedAt: Date; speedKmh?: number | null } | null;
  reason: string;
  confirmed: boolean;
  now?: Date;
}

export type BlockSafetyResult =
  | { allowed: true; warnings: string[] }
  | { allowed: false; reasons: string[] };

/**
 * Regras de segurança do bloqueio (seção 63). Avaliadas no servidor antes de enviar qualquer comando.
 * Bloqueio com veículo em movimento não é enviado: o operador deve aguardar parada ou acionar autoridades.
 */
export function evaluateRemoteCommand(input: BlockSafetyInput): BlockSafetyResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const now = input.now ?? new Date();
  if (!input.device || !input.device.active) reasons.push("Veículo sem rastreador ativo.");
  else if (!input.device.supportsRemoteBlock) reasons.push("O rastreador deste veículo não suporta bloqueio remoto.");
  if (!input.confirmed) reasons.push("Confirme a operação para continuar.");
  if (input.reason.trim().length < 10) reasons.push("Descreva o motivo (mínimo de 10 caracteres).");
  if (input.command === "BLOCK") {
    if (!input.lastPosition) reasons.push("Sem posição recente do veículo: não é seguro bloquear.");
    else {
      const ageMin = (now.getTime() - input.lastPosition.recordedAt.getTime()) / 60_000;
      if (ageMin > 5) reasons.push("Última comunicação há mais de 5 minutos: não é possível confirmar que o veículo está parado.");
      if ((input.lastPosition.speedKmh ?? 0) > 5) reasons.push("Veículo em movimento. Aguarde a parada para bloquear com segurança.");
    }
  } else if (input.lastPosition && (now.getTime() - input.lastPosition.recordedAt.getTime()) / 60_000 > 5) {
    warnings.push("Rastreador sem comunicação recente: o desbloqueio pode demorar a ser executado.");
  }
  return reasons.length ? { allowed: false, reasons } : { allowed: true, warnings };
}

/** Distância em metros (haversine) e ponto-em-polígono para geofencing (seção 60). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** GeoJSON usa [longitude, latitude]. */
export function pointInPolygon(point: { lat: number; lng: number }, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function geofenceTransition(
  kind: "ALLOWED" | "FORBIDDEN",
  wasInside: boolean,
  isInside: boolean,
): "GEOFENCE_EXIT" | "GEOFENCE_ENTRY_FORBIDDEN" | null {
  if (kind === "ALLOWED" && wasInside && !isInside) return "GEOFENCE_EXIT";
  if (kind === "FORBIDDEN" && !wasInside && isInside) return "GEOFENCE_ENTRY_FORBIDDEN";
  return null;
}
