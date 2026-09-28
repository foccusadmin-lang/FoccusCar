import { describe, expect, it } from "vitest";
import {
  TRACKING_CONSENT_VERSION, acceptablePositions, isTrackedRental, locationBatchSchema, profileProgress,
  trackingConsentSchema, trackingDecision,
} from "./index";

const pos = { latitude: -23.55, longitude: -46.63, recordedAt: new Date().toISOString() };

describe("rastreamento pelo celular", () => {
  it("só rastreia com aceite e locação em andamento", () => {
    expect(trackingDecision({ consentActive: false, rental: { id: "r", status: "ACTIVE" } })).toEqual({ track: false, reason: "NO_CONSENT" });
    expect(trackingDecision({ consentActive: true, rental: null })).toEqual({ track: false, reason: "NO_ACTIVE_RENTAL" });
    expect(trackingDecision({ consentActive: true, rental: { id: "r", status: "CLOSED" } })).toEqual({ track: false, reason: "NO_ACTIVE_RENTAL" });
    expect(trackingDecision({ consentActive: true, rental: { id: "r", status: "ACTIVE" } })).toEqual({ track: true, rentalId: "r" });
  });

  it("rastreia da retirada até a devolução", () => {
    expect(isTrackedRental("SCHEDULED")).toBe(false);
    expect(isTrackedRental("CHECKOUT_IN_PROGRESS")).toBe(true);
    expect(isTrackedRental("RETURN_IN_PROGRESS")).toBe(true);
    expect(isTrackedRental("PENDING_SETTLEMENT")).toBe(false);
  });

  it("aceite exige versão atual, marcação e posição válida", () => {
    const ok = { version: TRACKING_CONSENT_VERSION, accepted: true, platform: "ANDROID", position: pos };
    expect(trackingConsentSchema.safeParse(ok).success).toBe(true);
    expect(trackingConsentSchema.safeParse({ ...ok, version: "2020-01-01" }).success).toBe(false);
    expect(trackingConsentSchema.safeParse({ ...ok, accepted: false }).success).toBe(false);
    expect(trackingConsentSchema.safeParse({ ...ok, position: { ...pos, latitude: 120 } }).success).toBe(false);
  });

  it("lote limitado e sem pontos fora do tempo", () => {
    expect(locationBatchSchema.safeParse({ platform: "WEB", source: "BACKGROUND", positions: [] }).success).toBe(false);
    const now = new Date("2026-10-01T12:00:00Z");
    const list = [
      { recordedAt: new Date("2026-10-01T11:59:00Z") },
      { recordedAt: new Date("2026-10-01T13:00:00Z") },
      { recordedAt: new Date("2026-09-20T12:00:00Z") },
    ];
    expect(acceptablePositions(list, now)).toEqual([list[0]]);
  });

  it("cadastro só fica pronto para envio com a localização autorizada", () => {
    const base = { profileSaved: true, documents: [{ type: "CNH_FRONT", status: "PENDING" }], required: ["CNH_FRONT"] };
    expect(profileProgress({ ...base, trackingConsent: false }).readyToSubmit).toBe(false);
    expect(profileProgress({ ...base, trackingConsent: false }).documentsReady).toBe(true);
    expect(profileProgress({ ...base, trackingConsent: true }).readyToSubmit).toBe(true);
  });
});
