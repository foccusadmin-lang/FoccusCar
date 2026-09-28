import { describe, expect, it } from "vitest";
import { FakeTelematicsAdapter, TelematicsNotConfiguredError, compareTrackingLayers, createTelematicsAdapter } from "./index";

const now = new Date("2026-10-01T12:00:00Z");
const at = (min: number) => new Date(now.getTime() - min * 60_000);

describe("rastreador (interface genérica)", () => {
  it("sem fornecedor escolhido a fábrica avisa em vez de inventar", () => {
    expect(() => createTelematicsAdapter("", {})).toThrow(TelematicsNotConfiguredError);
    expect(() => createTelematicsAdapter("fake", { NODE_ENV: "production" })).toThrow(/produção/);
    expect(createTelematicsAdapter("fake", {}).provider).toBe("fake");
  });

  it("simulado: posições, webhook e bloqueio só com hardware compatível", async () => {
    const t = new FakeTelematicsAdapter();
    const [p] = await t.parseWebhook({ headers: new Headers(), rawBody: JSON.stringify({ positions: [{ deviceId: "d1", lat: -23.5, lng: -46.6, at: at(1).toISOString(), speed: 0 }] }) });
    t.push(p!);
    expect((await t.latestPositions(["d1"]))[0]?.latitude).toBe(-23.5);
    expect((await t.sendCommand("d1", "BLOCK")).status).toBe("REJECTED");
    t.capabilitiesByDevice.set("d1", { positions: true, ignition: true, remoteBlock: true, tamper: false });
    const r = await t.sendCommand("d1", "BLOCK");
    expect(r.status).toBe("SENT");
    expect((await t.commandStatus(r.providerRequestId!)).status).toBe("SENT");
  });
});

describe("duas camadas: veículo x celular", () => {
  const car = { latitude: -23.5505, longitude: -46.6333, recordedAt: at(1) };
  it("juntos quando perto", () => {
    expect(compareTrackingLayers({ vehicle: car, phone: { ...car, latitude: -23.5510 }, now }).status).toBe("TOGETHER");
  });
  it("separados quando o celular está longe do carro", () => {
    const r = compareTrackingLayers({ vehicle: car, phone: { ...car, latitude: -23.60 }, now });
    expect(r.status).toBe("APART");
    expect(r.distanceM).toBeGreaterThan(5_000);
  });
  it("aponta qual camada ficou sem sinal", () => {
    expect(compareTrackingLayers({ vehicle: { ...car, recordedAt: at(60) }, phone: car, now }).status).toBe("VEHICLE_SILENT");
    expect(compareTrackingLayers({ vehicle: car, phone: null, now }).status).toBe("PHONE_SILENT");
    expect(compareTrackingLayers({ vehicle: null, phone: null, now }).status).toBe("NO_DATA");
  });
  it("tolera a imprecisão informada pelo celular", () => {
    expect(compareTrackingLayers({ vehicle: car, phone: { ...car, latitude: -23.557, accuracyM: 800 }, now }).status).toBe("TOGETHER");
  });
});
