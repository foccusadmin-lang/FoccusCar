import { z } from "zod";
import type { RentalStatus } from "./enums";

/**
 * Rastreamento em duas camadas (seções 58–63):
 * 1. Rastreador GPS instalado no veículo (principal, funciona com o celular desligado).
 * 2. Localização do celular do cliente (complementar), ativada no fim do cadastro e
 *    enviada em segundo plano somente enquanto houver locação em andamento.
 *
 * LGPD: o aceite é registrado com versão do texto, data, IP e aparelho. Fora de uma
 * locação em andamento o servidor não guarda posições do celular (minimização, art. 6º, III).
 */
export const TRACKING_CONSENT_VERSION = "2026-09-28";

export const TRACKING_CONSENT_TITLE = "Autorização de localização e rastreamento";

export const TRACKING_CONSENT_TEXT = [
  "Para proteger você e o veículo, a locadora usa duas formas de localização durante a locação:",
  "1. O rastreador GPS instalado no veículo, que envia a posição do carro o tempo todo enquanto ele pertence à frota.",
  "2. A localização deste celular, que o aplicativo envia inclusive em segundo plano, somente enquanto você tiver uma locação em andamento.",
  "As posições são usadas para segurança do veículo, recuperação em caso de furto ou roubo, apoio em emergências e cumprimento do contrato. Não são vendidas nem compartilhadas para publicidade.",
  "Fora da locação o aplicativo não envia a localização do celular. Os dados ficam guardados pelo prazo exigido no contrato e na lei e depois são excluídos.",
  "Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento. Retirar esta autorização impede novas locações enquanto ela estiver retirada, porque o rastreamento faz parte das condições de segurança do contrato.",
].join("\n\n");

export const LOCATION_SOURCES = ["REGISTRATION", "FOREGROUND", "BACKGROUND"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const CLIENT_PLATFORMS = ["WEB", "ANDROID", "IOS"] as const;
export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

/** Locação em que o celular deve enviar posição (o carro está com o cliente). */
export const TRACKED_RENTAL_STATUSES: readonly RentalStatus[] = ["CHECKOUT_IN_PROGRESS", "ACTIVE", "RETURN_IN_PROGRESS"];

export function isTrackedRental(status: RentalStatus): boolean {
  return TRACKED_RENTAL_STATUSES.includes(status);
}

export const positionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100_000).optional(),
  speedKmh: z.number().min(0).max(400).optional(),
  heading: z.number().min(0).max(360).optional(),
  recordedAt: z.coerce.date(),
});
export type PhonePosition = z.infer<typeof positionSchema>;

export const trackingConsentSchema = z.object({
  version: z.literal(TRACKING_CONSENT_VERSION, { error: "O texto da autorização mudou. Recarregue a página e leia novamente." }),
  accepted: z.literal(true, { error: "É preciso aceitar a autorização para concluir o cadastro." }),
  platform: z.enum(CLIENT_PLATFORMS),
  /** Posição obtida no momento do aceite: prova de que a permissão do aparelho foi concedida. */
  position: positionSchema,
});

export const locationBatchSchema = z.object({
  platform: z.enum(CLIENT_PLATFORMS),
  source: z.enum(["FOREGROUND", "BACKGROUND"]),
  positions: z.array(positionSchema).min(1).max(200),
});

/**
 * Filtra posições do lote: descarta datas no futuro (relógio errado) e muito antigas
 * (o aparelho guarda pontos quando está sem internet, mas não por mais de 7 dias).
 */
export function acceptablePositions<T extends { recordedAt: Date }>(positions: readonly T[], now = new Date()): T[] {
  const maxFuture = now.getTime() + 5 * 60_000;
  const maxPast = now.getTime() - 7 * 86_400_000;
  return positions.filter((p) => p.recordedAt.getTime() <= maxFuture && p.recordedAt.getTime() >= maxPast);
}

/** Resposta ao aplicativo: se deve continuar enviando a localização em segundo plano. */
export type TrackingDecision =
  | { track: true; rentalId: string }
  | { track: false; reason: "NO_CONSENT" | "NO_ACTIVE_RENTAL" };

export function trackingDecision(input: {
  consentActive: boolean;
  rental: { id: string; status: RentalStatus } | null;
}): TrackingDecision {
  if (!input.consentActive) return { track: false, reason: "NO_CONSENT" };
  if (!input.rental || !isTrackedRental(input.rental.status)) return { track: false, reason: "NO_ACTIVE_RENTAL" };
  return { track: true, rentalId: input.rental.id };
}
