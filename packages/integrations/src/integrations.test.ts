import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AsaasGateway, FakeGateway, MercadoPagoGateway, canMovePayment, createPaymentGateway, evaluateRemoteCommand,
  geofenceTransition, pointInPolygon, sniffMime, validateUploadRequest,
} from "./index";

const customer = { name: "Ana", email: "ana@exemplo.com", cpf: "52998224725" };
const meta = { companyId: "c", paymentId: "p" };

describe("pagamentos", () => {
  it("Pix, cartão aprovado e recusado, com idempotência", async () => {
    const g = new FakeGateway();
    const pix = await g.createPixPayment({ amountCents: 1000, idempotencyKey: "k1", description: "x", customer, metadata: meta });
    expect(pix.pix?.qrCode).toBeTruthy();
    const again = await g.createPixPayment({ amountCents: 1000, idempotencyKey: "k1", description: "x", customer, metadata: meta });
    expect(again.providerPaymentId).toBe(pix.providerPaymentId);
    const ok = await g.createCreditCardPayment({ amountCents: 1000, idempotencyKey: "k2", description: "x", customer, metadata: meta, cardToken: "tok_ok", installments: 3 });
    expect(ok.status).toBe("APPROVED");
    const no = await g.createCreditCardPayment({ amountCents: 1000, idempotencyKey: "k3", description: "x", customer, metadata: meta, cardToken: "tok_declined", installments: 1 });
    expect(no.status).toBe("REJECTED");
    expect((await g.refundPayment(ok.providerPaymentId)).status).toBe("REFUNDED");
  });

  it("status final não retrocede com webhook fora de ordem", () => {
    expect(canMovePayment("PENDING", "APPROVED")).toBe(true);
    expect(canMovePayment("APPROVED", "PENDING")).toBe(false);
    expect(canMovePayment("APPROVED", "REFUNDED")).toBe(true);
    expect(canMovePayment("REFUNDED", "APPROVED")).toBe(false);
  });

  it("gateway simulado é proibido em produção e credenciais são exigidas", () => {
    expect(() => createPaymentGateway("fake", { NODE_ENV: "production" })).toThrow();
    expect(() => createPaymentGateway("mercadopago", {})).toThrow(/não configurado/);
  });

  it("Mercado Pago: aceita assinatura válida e recusa adulterada", async () => {
    const secret = "segredo";
    const g = new MercadoPagoGateway({ accessToken: "x", webhookSecret: secret });
    const ts = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ id: 99, type: "payment", action: "payment.updated", data: { id: "123" } });
    const v1 = createHmac("sha256", secret).update(`id:123;request-id:req-1;ts:${ts};`).digest("hex");
    const ev = await g.validateWebhook({ headers: new Headers({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-1" }), rawBody });
    expect(ev).toMatchObject({ eventId: "99", providerPaymentId: "123" });
    await expect(g.validateWebhook({ headers: new Headers({ "x-signature": `ts=${ts},v1=${"0".repeat(64)}`, "x-request-id": "req-1" }), rawBody })).rejects.toThrow();
  });

  it("Asaas: exige o token do webhook", async () => {
    const g = new AsaasGateway({ apiKey: "x", webhookToken: "tok" });
    const rawBody = JSON.stringify({ id: "evt_1", event: "PAYMENT_RECEIVED", payment: { id: "pay_1", status: "RECEIVED", value: 10 } });
    expect(await g.validateWebhook({ headers: new Headers({ "asaas-access-token": "tok" }), rawBody })).toMatchObject({ status: "APPROVED" });
    await expect(g.validateWebhook({ headers: new Headers({ "asaas-access-token": "errado" }), rawBody })).rejects.toThrow();
  });
});

describe("bloqueio remoto", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  const fresh = { recordedAt: new Date("2026-09-26T11:59:00Z"), speedKmh: 0 };
  const device = { supportsRemoteBlock: true, active: true };
  it("não existe bloqueio sem hardware compatível", () => {
    const r = evaluateRemoteCommand({ command: "BLOCK", device: { ...device, supportsRemoteBlock: false }, lastPosition: fresh, reason: "Roubo informado pelo cliente", confirmed: true, now });
    expect(r.allowed).toBe(false);
  });
  it("não bloqueia veículo em movimento ou sem comunicação", () => {
    expect(evaluateRemoteCommand({ command: "BLOCK", device, lastPosition: { ...fresh, speedKmh: 60 }, reason: "Roubo informado pelo cliente", confirmed: true, now }).allowed).toBe(false);
    expect(evaluateRemoteCommand({ command: "BLOCK", device, lastPosition: { recordedAt: new Date("2026-09-26T11:00:00Z") }, reason: "Roubo informado pelo cliente", confirmed: true, now }).allowed).toBe(false);
  });
  it("exige confirmação e motivo", () => {
    expect(evaluateRemoteCommand({ command: "BLOCK", device, lastPosition: fresh, reason: "x", confirmed: false, now }).allowed).toBe(false);
    expect(evaluateRemoteCommand({ command: "BLOCK", device, lastPosition: fresh, reason: "Roubo informado pelo cliente", confirmed: true, now }).allowed).toBe(true);
  });
});

describe("geofencing e uploads", () => {
  const square = [[-46.7, -23.6], [-46.6, -23.6], [-46.6, -23.5], [-46.7, -23.5], [-46.7, -23.6]];
  it("detecta saída de área permitida", () => {
    expect(pointInPolygon({ lat: -23.55, lng: -46.65 }, square)).toBe(true);
    expect(pointInPolygon({ lat: -22.9, lng: -43.2 }, square)).toBe(false);
    expect(geofenceTransition("ALLOWED", true, false)).toBe("GEOFENCE_EXIT");
    expect(geofenceTransition("FORBIDDEN", false, true)).toBe("GEOFENCE_ENTRY_FORBIDDEN");
  });
  it("valida tipo, tamanho, extensão e conteúdo", () => {
    expect(validateUploadRequest("document", { name: "cnh.pdf", contentType: "application/pdf", sizeBytes: 1000 })).toBeNull();
    expect(validateUploadRequest("document", { name: "cnh.exe", contentType: "application/pdf", sizeBytes: 1000 })).toMatch(/extensão/);
    expect(validateUploadRequest("photo", { name: "a.jpg", contentType: "image/jpeg", sizeBytes: 50 * 1024 * 1024 })).toMatch(/MB/);
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(new Uint8Array([0x4d, 0x5a]))).toBeNull();
  });
});
