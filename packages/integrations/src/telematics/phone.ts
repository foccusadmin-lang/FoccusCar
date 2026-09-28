import { distanceMeters } from "./adapter";

/**
 * Cruza a posição do rastreador do veículo com a do celular do cliente (as duas camadas).
 * - TOGETHER: cliente perto do carro.
 * - APART: celular longe do carro (possível furto, carro emprestado a terceiro ou celular esquecido).
 * - VEHICLE_SILENT: só o celular comunica (rastreador sem sinal, desligado ou violado).
 * - PHONE_SILENT: só o rastreador comunica (celular desligado ou app fechado).
 */
export type LayerStatus = "TOGETHER" | "APART" | "VEHICLE_SILENT" | "PHONE_SILENT" | "NO_DATA";

interface Fix {
  latitude: number;
  longitude: number;
  recordedAt: Date;
  accuracyM?: number | null;
}

export function compareTrackingLayers(input: {
  vehicle: Fix | null;
  phone: Fix | null;
  now?: Date;
  /** Posição mais velha que isso é considerada "sem sinal". */
  staleAfterMin?: number;
  /** Distância a partir da qual cliente e carro são considerados separados. */
  apartMeters?: number;
}): { status: LayerStatus; distanceM: number | null } {
  const now = input.now ?? new Date();
  const staleMs = (input.staleAfterMin ?? 15) * 60_000;
  const fresh = (f: Fix | null) => (f && now.getTime() - f.recordedAt.getTime() <= staleMs ? f : null);
  const vehicle = fresh(input.vehicle);
  const phone = fresh(input.phone);
  if (!vehicle && !phone) return { status: "NO_DATA", distanceM: null };
  if (!vehicle) return { status: "VEHICLE_SILENT", distanceM: null };
  if (!phone) return { status: "PHONE_SILENT", distanceM: null };
  const distanceM = distanceMeters({ lat: vehicle.latitude, lng: vehicle.longitude }, { lat: phone.latitude, lng: phone.longitude });
  // Tolerância pela imprecisão do GPS do celular (em ambiente fechado pode passar de 100 m).
  const threshold = (input.apartMeters ?? 500) + Math.min(phone.accuracyM ?? 0, 1_000);
  return { status: distanceM > threshold ? "APART" : "TOGETHER", distanceM: Math.round(distanceM) };
}
