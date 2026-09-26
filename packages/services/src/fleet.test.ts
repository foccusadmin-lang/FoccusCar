import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildAccessContext, checkManualStatusChange, documentExpiry, fleetOccupancy, isValidPlate, vehicleInputSchema, canRevokeRole, permissionsFor, type Role } from "@foccus/core";
import { companyMembers, createDb, ensureCompany, users, vehicleEvents, withTenant, type Database } from "@foccus/db";
import { MemoryStorage } from "@foccus/integrations";
import { sql } from "drizzle-orm";
import {
  addVehicleDocument, changeMemberRole, changeVehicleStatus, createVehicle, getAdminDashboard, getMember, getVehicle, getVehicleTimeline,
  listAuditLogs, listFleetDocumentAlerts, listMembers, listVehicles, readVehiclePhoto, removeVehiclePhoto, updateVehicle, uploadVehiclePhoto,
  type ServiceDeps,
} from "./index";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);

describe("regras da frota (puras)", () => {
  it("valida placas antiga e Mercosul", () => {
    expect(isValidPlate("abc-1234")).toBe(true);
    expect(isValidPlate("ABC1D23")).toBe(true);
    expect(isValidPlate("AB12345")).toBe(false);
  });
  it("status manual nunca define Alugado/Reservado nem mexe em carro alugado", () => {
    expect(checkManualStatusChange("AVAILABLE", "RENTED").ok).toBe(false);
    expect(checkManualStatusChange("RENTED", "AVAILABLE").ok).toBe(false);
    expect(checkManualStatusChange("AVAILABLE", "MAINTENANCE").ok).toBe(true);
  });
  it("alerta de vencimento em 30 dias", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    expect(documentExpiry("2026-09-20", now).state).toBe("EXPIRED");
    expect(documentExpiry("2026-10-10", now).state).toBe("EXPIRING");
    expect(documentExpiry("2027-01-10", now).state).toBe("VALID");
    expect(documentExpiry(null, now).state).toBe("NO_EXPIRY");
  });
  it("ocupação ignora inativos", () => {
    expect(fleetOccupancy({ AVAILABLE: 2, RENTED: 1, RESERVED: 1, INACTIVE: 10 })).toBe(50);
  });
  it("valores em centavos e campos opcionais vazios", () => {
    const d = vehicleInputSchema.parse({ plate: "fcc-9z99", brand: "Fiat", model: "Pulse", modelYear: 2025, transmission: "MANUAL", fuelType: "FLEX", currentKm: "1200", dailyRateCents: 15900, weeklyRateCents: "", renavam: "" });
    expect(d.plate).toBe("FCC9Z99");
    expect(d.weeklyRateCents).toBeNull();
    expect(d.renavam).toBeNull();
  });
  it("nunca deixa a empresa sem administrador e não retira Cliente", () => {
    const admin = { actorId: "a", actorRoles: ["ADMIN"] as Role[], actorPermissions: permissionsFor(["ADMIN"]), targetUserId: "b" };
    expect(canRevokeRole({ ...admin, role: "ADMIN", remainingAdmins: 1 }).allowed).toBe(false);
    expect(canRevokeRole({ ...admin, role: "CLIENTE", remainingAdmins: 2 }).allowed).toBe(false);
    expect(canRevokeRole({ ...admin, role: "OPERADOR", remainingAdmins: 1 }).allowed).toBe(true);
  });
});

const url = process.env.TEST_DATABASE_URL;
const owner = process.env.TEST_DATABASE_MIGRATION_URL ?? url;

describe.skipIf(!url)("painel administrativo e frota (banco real)", () => {
  let db: Database;
  let deps: ServiceDeps;
  let companyId: string;
  let otherCompanyId: string;
  const s = Math.floor(Math.random() * 800000);
  const plate = (n: number) => `T${String.fromCharCode(65 + (s % 26))}${String.fromCharCode(65 + (n % 26))}${(s + n) % 10}${String.fromCharCode(65 + ((s + n) % 26))}${String((s + n) % 100).padStart(2, "0")}`;

  async function makeUser(roles: Role[], company = companyId, verified = true) {
    const [u] = await db.insert(users).values({ name: `Pessoa ${roles.join("+")}`, email: `${roles.join("-").toLowerCase()}-${s}-${Math.random()}@ex.com`, emailVerified: verified }).returning();
    await withTenant(db, { companyId: company }, (tx) => tx.insert(companyMembers).values(roles.map((role) => ({ companyId: company, userId: u!.id, role }))));
    return buildAccessContext({ userId: u!.id, companyId: company, roles, accountStatus: "ACTIVE" });
  }

  const vehicle = (n: number) => ({
    plate: plate(n), brand: "Toyota", model: "Yaris", version: "XLS", modelYear: 2025, transmission: "CVT", fuelType: "FLEX",
    currentKm: 1000, dailyRateCents: 19900, depositCents: 100000,
  });

  beforeAll(async () => {
    const o = createDb(owner);
    companyId = (await ensureCompany(o, { name: "Loc Frota", slug: `frota-${s}` })).id;
    otherCompanyId = (await ensureCompany(o, { name: "Outra Frota", slug: `frota2-${s}` })).id;
    await o.$client.end();
    db = createDb(url);
    deps = { db, storage: new MemoryStorage(), mailer: { send: async () => {} } };
  });
  afterAll(async () => db?.$client.end());

  it("cadastro → fotos → documentos → status → Vida do Veículo completa", async () => {
    const admin = await makeUser(["CLIENTE", "ADMIN"]);
    const { id } = await createVehicle(deps, admin, vehicle(1));
    let d = await getVehicle(deps, admin, id);
    expect(d.vehicle.status).toBe("INACTIVE");
    expect(d.vehicle.showcaseVisible).toBe(false);

    // placa duplicada na mesma empresa é recusada com mensagem clara
    await expect(createVehicle(deps, admin, vehicle(1))).rejects.toMatchObject({ code: "PLATE_TAKEN" });

    // foto: conteúdo real precisa ser imagem
    await expect(uploadVehiclePhoto(deps, admin, id, { fileName: "x.jpg", contentType: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) })).rejects.toMatchObject({ code: "INVALID_FILE" });
    const p1 = await uploadVehiclePhoto(deps, admin, id, { fileName: "frente.jpg", contentType: "image/jpeg", bytes: JPEG });
    const p2 = await uploadVehiclePhoto(deps, admin, id, { fileName: "lado.jpg", contentType: "image/jpeg", bytes: JPEG });
    expect(p1.isCover).toBe(true);
    expect(p2.isCover).toBe(false);

    // foto de veículo fora da vitrine não é pública
    await expect(readVehiclePhoto(deps, companyId, null, p1.id)).rejects.toMatchObject({ status: 404 });
    expect((await readVehiclePhoto(deps, companyId, admin, p1.id)).isPublic).toBe(false);

    // não liga a vitrine com o carro inativo
    await expect(updateVehicle(deps, admin, id, { data: { ...vehicle(1), showcaseVisible: true } })).rejects.toMatchObject({ code: "NOT_AVAILABLE" });

    await changeVehicleStatus(deps, admin, id, { status: "AVAILABLE" });
    await updateVehicle(deps, admin, id, { data: { ...vehicle(1), showcaseVisible: true } });
    expect((await readVehiclePhoto(deps, companyId, null, p1.id)).isPublic).toBe(true);

    // placa e KM são críticos: exigem motivo
    await expect(updateVehicle(deps, admin, id, { data: { ...vehicle(1), showcaseVisible: true, currentKm: 5000 } })).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    const upd = await updateVehicle(deps, admin, id, { data: { ...vehicle(1), showcaseVisible: true, currentKm: 5000 }, reason: "Leitura do painel na entrega" });
    expect(upd.changed).toEqual(["currentKm"]);

    // documentos: vencido e em dia
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
    const future = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
    await addVehicleDocument(deps, admin, id, { type: "LICENSING", number: "2025", expiresAt: past });
    await addVehicleDocument(deps, admin, id, { type: "INSURANCE", number: "AP-1", issuedAt: "2026-01-01", expiresAt: future, costCents: "250000" }, { fileName: "apolice.jpg", contentType: "image/jpeg", bytes: JPEG });
    await expect(addVehicleDocument(deps, admin, id, { type: "IPVA", issuedAt: "2026-05-01", expiresAt: "2026-01-01" })).rejects.toThrow();
    d = await getVehicle(deps, admin, id);
    expect(d.documents.map((x) => x.state).sort()).toEqual(["EXPIRED", "VALID"]);
    const alerts = await listFleetDocumentAlerts(deps, admin);
    expect(alerts.some((a) => a.vehicleId === id && a.state === "EXPIRED")).toBe(true);

    // bloqueio administrativo exige motivo, tira da vitrine e vira BLOCK na linha do tempo
    await expect(changeVehicleStatus(deps, admin, id, { status: "BLOCKED" })).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await changeVehicleStatus(deps, admin, id, { status: "BLOCKED", reason: "Documento vencido" });
    d = await getVehicle(deps, admin, id);
    expect(d.vehicle.showcaseVisible).toBe(false);
    expect(d.blockNote).toMatch(/não envia comando/i);
    await expect(changeVehicleStatus(deps, admin, id, { status: "RENTED" })).rejects.toMatchObject({ code: "INVALID_STATUS" });

    await removeVehiclePhoto(deps, admin, p1.id);
    d = await getVehicle(deps, admin, id);
    expect(d.photos).toHaveLength(1);
    expect(d.photos[0]!.isCover).toBe(true);

    const tl = await getVehicleTimeline(deps, admin, id);
    const types = tl.events.map((e) => e.type);
    for (const t of ["FLEET_ENTRY", "PHOTO", "STATUS_CHANGE", "MILEAGE", "DOCUMENT", "BLOCK"]) expect(types).toContain(t);
    expect(tl.events.every((e) => e.actor !== "Sistema")).toBe(true);

    // a Vida do Veículo é imutável no banco
    await expect(withTenant(db, admin, (tx) => tx.update(vehicleEvents).set({ description: "x" }).where(sql`vehicle_id = ${id}`))).rejects.toThrow();

    const audit = await listAuditLogs(deps, admin, { entidade: "vehicles", registro: id });
    expect(audit.items.map((a) => a.action)).toEqual(expect.arrayContaining(["vehicle.create", "vehicle.update", "vehicle.status", "vehicle.block"]));
    const upd2 = audit.items.find((a) => a.action === "vehicle.update" && (a.newValue as { currentKm?: number }).currentKm === 5000);
    expect(upd2?.oldValue).toEqual({ currentKm: 1000 });
  });

  it("timeline pagina sem pular eventos do mesmo instante", async () => {
    const admin = await makeUser(["ADMIN"]);
    const { id } = await createVehicle(deps, admin, vehicle(2));
    await withTenant(db, admin, async (tx) => {
      for (let i = 0; i < 45; i++) await tx.insert(vehicleEvents).values({ companyId, vehicleId: id, type: "MILEAGE", description: `leitura ${i}`, source: "admin" });
    });
    const seen = new Set<string>();
    let cursor: string | null | undefined;
    do {
      const page = await getVehicleTimeline(deps, admin, id, cursor ? { antes: cursor } : {});
      page.events.forEach((e) => seen.add(e.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen.size).toBe(46);
  });

  it("operador vê a frota mas não cadastra; cliente não vê o painel; outra empresa não enxerga", async () => {
    const admin = await makeUser(["ADMIN"]);
    const op = await makeUser(["CLIENTE", "OPERADOR"]);
    const client = await makeUser(["CLIENTE"]);
    const { id } = await createVehicle(deps, admin, vehicle(3));
    expect((await listVehicles(deps, op, { q: plate(3) })).items.map((v) => v.id)).toEqual([id]);
    await expect(createVehicle(deps, op, vehicle(4))).rejects.toMatchObject({ status: 403 });
    await expect(changeVehicleStatus(deps, op, id, { status: "AVAILABLE" })).rejects.toMatchObject({ status: 403 });
    await expect(listVehicles(deps, client, {})).rejects.toMatchObject({ status: 403 });
    await expect(listAuditLogs(deps, op, {})).rejects.toMatchObject({ status: 403 });

    const stranger = await makeUser(["ADMIN"], otherCompanyId);
    await expect(getVehicle(deps, stranger, id)).rejects.toMatchObject({ status: 404 });
    expect((await listVehicles(deps, stranger, {})).items.find((v) => v.id === id)).toBeUndefined();
    await expect(readVehiclePhoto(deps, otherCompanyId, stranger, id)).rejects.toMatchObject({ status: 404 });

    const dash = await getAdminDashboard(deps, op);
    expect(dash.fleet).not.toBeNull();
    expect(dash.finance).toBeNull();
    await expect(getAdminDashboard(deps, client)).rejects.toMatchObject({ status: 403 });
  });

  it("perfis: só admin concede, com motivo, sem autoescalonamento e sem ficar sem admin", async () => {
    const admin = await makeUser(["CLIENTE", "ADMIN"]);
    const manager = await makeUser(["CLIENTE", "GERENTE"]);
    const person = await makeUser(["CLIENTE"]);
    const unverified = await makeUser(["CLIENTE"], companyId, false);

    await expect(changeMemberRole(deps, manager, person.userId, { role: "OPERADOR", action: "GRANT", reason: "teste gerente" })).rejects.toMatchObject({ status: 403 });
    await expect(changeMemberRole(deps, admin, admin.userId, { role: "FINANCEIRO", action: "GRANT", reason: "autoatribuição" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeMemberRole(deps, admin, person.userId, { role: "OPERADOR", action: "GRANT", reason: "" })).rejects.toThrow();
    await expect(changeMemberRole(deps, admin, unverified.userId, { role: "OPERADOR", action: "GRANT", reason: "contratado hoje" })).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });

    const r = await changeMemberRole(deps, admin, person.userId, { role: "OPERADOR", action: "GRANT", reason: "Contratado como operador" });
    expect(r.roles.sort()).toEqual(["CLIENTE", "OPERADOR"]);
    await expect(changeMemberRole(deps, admin, person.userId, { role: "CLIENTE", action: "REVOKE", reason: "tentativa inválida" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const r2 = await changeMemberRole(deps, admin, person.userId, { role: "OPERADOR", action: "REVOKE", reason: "Mudou de função" });
    expect(r2.roles).toEqual(["CLIENTE"]);

    const m = await getMember(deps, manager, person.userId);
    expect(m.roles.every((x) => !x.editable)).toBe(true);
    const list = await listMembers(deps, admin, { perfil: "GERENTE" });
    expect(list.items.some((u) => u.id === manager.userId)).toBe(true);

    const audit = await listAuditLogs(deps, admin, { entidade: "users", registro: person.userId });
    expect(audit.items.map((a) => a.action)).toEqual(["user.role.revoke", "user.role.grant"]);
    expect((audit.items[1]!.newValue as { reason: string }).reason).toBe("Contratado como operador");

    // o único admin de uma empresa nova não pode perder o perfil (nem por outro admin, que também é único aqui)
    const o = createDb(owner);
    const soloCo = (await ensureCompany(o, { name: "Solo", slug: `solo-${s}` })).id;
    await o.$client.end();
    const solo = await makeUser(["ADMIN"], soloCo);
    const target = await makeUser(["CLIENTE"], soloCo);
    await changeMemberRole(deps, solo, target.userId, { role: "ADMIN", action: "GRANT", reason: "sócio da empresa" });
    const targetCtx = buildAccessContext({ userId: target.userId, companyId: soloCo, roles: ["CLIENTE", "ADMIN"], accountStatus: "ACTIVE" });
    await changeMemberRole(deps, targetCtx, solo.userId, { role: "ADMIN", action: "REVOKE", reason: "saiu da sociedade" });
    await expect(changeMemberRole(deps, solo, target.userId, { role: "ADMIN", action: "REVOKE", reason: "tentativa" })).rejects.toMatchObject({ status: 403 });
  });
});
