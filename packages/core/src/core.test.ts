import { describe, expect, it } from "vitest";
import {
  AccessDeniedError, authorize, buildAccessContext, canAssignRole, checkServiceAccess, canTransition,
  compareChecklists, evaluateEligibility, findConflicts, isValidCpf, maintenanceHealth, nextAvailableDate,
  permissionsFor, quoteRental, representativePrice, PUBLIC_SIGNUP_ROLE, customerProfileSchema,
} from "./index";

const d = (s: string) => new Date(s);

describe("permissões", () => {
  it("toda conta pública começa como CLIENTE", () => {
    expect(PUBLIC_SIGNUP_ROLE).toBe("CLIENTE");
  });

  it("cliente não acessa módulos administrativos", () => {
    const p = permissionsFor(["CLIENTE"]);
    expect(p.has("showcase:view")).toBe(true);
    for (const perm of ["customers:view", "finance:view", "users:roles.assign", "security:commands.execute"] as const)
      expect(p.has(perm)).toBe(false);
  });

  it("operador opera locações mas não mexe no financeiro", () => {
    const p = permissionsFor(["OPERADOR"]);
    expect(p.has("checklists:execute")).toBe(true);
    expect(p.has("finance:manage")).toBe(false);
    expect(p.has("payments:refund")).toBe(false);
  });

  it("financeiro faz estorno mas não executa bloqueio", () => {
    const p = permissionsFor(["FINANCEIRO"]);
    expect(p.has("payments:refund")).toBe(true);
    expect(p.has("security:commands.execute")).toBe(false);
  });

  it("representante gerencia ofertas e carteira", () => {
    const p = permissionsFor(["REPRESENTANTE"]);
    expect(p.has("representative:listings.manage")).toBe(true);
    expect(p.has("customers:view")).toBe(false);
  });

  it("admin tem tudo", () => {
    const p = permissionsFor(["ADMIN"]);
    expect(p.has("users:roles.assign")).toBe(true);
    expect(p.has("audit:view")).toBe(true);
  });

  it("atribuição de perfil exige permissão e bloqueia autoescalonamento", () => {
    const admin = { actorId: "a", actorRoles: ["ADMIN"] as const, actorPermissions: permissionsFor(["ADMIN"]) };
    expect(canAssignRole({ ...admin, targetUserId: "b", role: "ADMIN" }).allowed).toBe(true);
    expect(canAssignRole({ ...admin, targetUserId: "a", role: "ADMIN" }).allowed).toBe(false);
    const client = { actorId: "c", actorRoles: ["CLIENTE"] as const, actorPermissions: permissionsFor(["CLIENTE"]) };
    expect(canAssignRole({ ...client, targetUserId: "b", role: "OPERADOR" }).allowed).toBe(false);
    const manager = { actorId: "m", actorRoles: ["GERENTE"] as const, actorPermissions: new Set([...permissionsFor(["GERENTE"]), "users:roles.assign" as const]) };
    expect(canAssignRole({ ...manager, targetUserId: "b", role: "ADMIN" }).allowed).toBe(false);
    expect(canAssignRole({ ...manager, targetUserId: "b", role: "OPERADOR" }).allowed).toBe(true);
  });
});

describe("autorização de API", () => {
  const ctx = buildAccessContext({ userId: "u1", companyId: "c1", roles: ["CLIENTE"], accountStatus: "ACTIVE" });

  it("exige login", () => {
    expect(() => authorize(null, { permission: "showcase:view", companyId: "c1" })).toThrowError(AccessDeniedError);
  });
  it("bloqueia outra empresa", () => {
    expect(() => authorize(ctx, { permission: "showcase:view", companyId: "c2" })).toThrow(/empresa/);
  });
  it("bloqueia permissão ausente", () => {
    expect(() => authorize(ctx, { permission: "customers:view", companyId: "c1" })).toThrow(/perfil/);
  });
  it("bloqueia recurso de outra pessoa", () => {
    expect(() => authorize(ctx, { permission: "self:rentals.view", companyId: "c1", ownerUserId: "u2" })).toThrow(/outra pessoa/);
    expect(authorize(ctx, { permission: "self:rentals.view", companyId: "c1", ownerUserId: "u1" })).toBe(ctx);
  });
  it("bloqueia conta suspensa", () => {
    const s = buildAccessContext({ userId: "u1", companyId: "c1", roles: ["ADMIN"], accountStatus: "SUSPENDED" });
    expect(() => authorize(s, { permission: "showcase:view", companyId: "c1" })).toThrow(/restrito/);
  });
});

describe("status da conta e bloqueio de serviços", () => {
  it("cadastro incompleto é bloqueado com COMPLETAR CADASTRO", () => {
    const g = checkServiceAccess("PROFILE_INCOMPLETE");
    expect(g.allowed).toBe(false);
    if (!g.allowed) {
      expect(g.message).toBe("Complete seu cadastro para continuar.");
      expect(g.action?.label).toBe("COMPLETAR CADASTRO");
    }
  });
  it("cadastro completo ainda aguarda validação", () => {
    expect(checkServiceAccess("PROFILE_COMPLETE").allowed).toBe(false);
    expect(checkServiceAccess("ACTIVE").allowed).toBe(true);
  });
  it("não pula de incompleto direto para ativo", () => {
    expect(canTransition("PROFILE_INCOMPLETE", "ACTIVE")).toBe(false);
    expect(canTransition("PROFILE_INCOMPLETE", "PROFILE_COMPLETE")).toBe(true);
    expect(canTransition("UNDER_REVIEW", "ACTIVE")).toBe(true);
  });
});

describe("elegibilidade", () => {
  const base = {
    accountStatus: "ACTIVE" as const,
    cnh: { expiresAt: d("2030-01-01"), categories: ["AB"] },
    requiredCnhCategory: "B",
    documents: [{ type: "CNH_FRONT", status: "APPROVED" as const }, { type: "CNH_BACK", status: "APPROVED" as const }],
    requiredDocuments: ["CNH_FRONT", "CNH_BACK"],
    reservationConfirmed: true,
    contractSigned: true,
    until: d("2026-10-10"),
  };
  it("libera quando tudo está ok", () => expect(evaluateEligibility(base).eligible).toBe(true));
  it("aponta CNH vencida antes da devolução", () => {
    const r = evaluateEligibility({ ...base, cnh: { expiresAt: d("2026-10-01"), categories: ["B"] } });
    expect(r.failed.map((f) => f.check)).toEqual(["CNH_VALID"]);
  });
  it("aponta categoria e documento", () => {
    const r = evaluateEligibility({ ...base, cnh: { expiresAt: d("2030-01-01"), categories: ["A"] }, documents: [] });
    expect(r.failed.map((f) => f.check)).toEqual(["CNH_CATEGORY", "DOCUMENTS_APPROVED"]);
  });
});

describe("reservas", () => {
  const busy = [
    { id: "r1", start: d("2026-10-01T10:00Z"), end: d("2026-10-05T10:00Z") },
    { id: "r2", start: d("2026-10-05T10:00Z"), end: d("2026-10-08T10:00Z") },
  ];
  it("detecta conflito e aceita encostar", () => {
    expect(findConflicts({ start: d("2026-10-04T00:00Z"), end: d("2026-10-06T00:00Z") }, busy).map((b) => b.id)).toEqual(["r1", "r2"]);
    expect(findConflicts({ start: d("2026-10-08T10:00Z"), end: d("2026-10-09T10:00Z") }, busy)).toEqual([]);
  });
  it("calcula a próxima disponibilidade", () => {
    expect(nextAvailableDate(busy, d("2026-10-02T00:00Z")).toISOString()).toBe("2026-10-08T10:00:00.000Z");
  });
  it("escolhe o pacote mais barato", () => {
    const rates = { dailyCents: 20000, weeklyCents: 120000, monthlyCents: 400000 };
    expect(quoteRental(3, rates).totalCents).toBe(60000);
    expect(quoteRental(9, rates)).toEqual({ totalCents: 160000, breakdown: { DAILY: 2, WEEKLY: 1 } });
    expect(quoteRental(30, rates).totalCents).toBe(400000);
  });
  it("modelo de margem do representante", () => {
    expect(representativePrice(150000, 20000, 30000)).toEqual({ customerCents: 170000, companyCents: 150000, representativeCents: 20000 });
    expect(() => representativePrice(150000, 40000, 30000)).toThrow();
  });
});

describe("checklist e manutenção", () => {
  it("compara saída x devolução", () => {
    const out = { mileageKm: 1000, fuel: "FULL" as const, items: { capo: { result: "OK" as const }, estepe: { result: "OK" as const }, portas: { result: "DAMAGE" as const } }, damageIds: [] };
    const back = { mileageKm: 1600, fuel: "HALF" as const, items: { capo: { result: "DAMAGE" as const }, estepe: { result: "OK" as const, missing: true }, portas: { result: "DAMAGE" as const } }, damageIds: [] };
    expect(compareChecklists(out, back, 500)).toEqual({ kmDriven: 600, kmExcess: 100, fuelEighthsMissing: 4, newDamageItems: ["capo"], missingItems: ["estepe"] });
  });
  it("classifica manutenção", () => {
    const now = { date: d("2026-09-26"), km: 50000 };
    expect(maintenanceHealth(now, { km: 60000 })).toBe("GREEN");
    expect(maintenanceHealth(now, { km: 50500 })).toBe("YELLOW");
    expect(maintenanceHealth(now, { date: d("2026-09-01") })).toBe("RED");
  });
});

describe("validação de cadastro", () => {
  it("valida CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
  });
  it("rejeita menor de idade e CPF inválido", () => {
    const r = customerProfileSchema.safeParse({
      fullName: "Fulano de Tal", cpf: "123", birthDate: new Date().toISOString(), phone: "11999998888",
      whatsapp: "11999998888", email: "a@b.com",
      address: { zip: "01001000", street: "Praça da Sé", number: "1", district: "Sé", city: "São Paulo", state: "SP" },
      cnh: { number: "12345678901", categories: "B", expiresAt: "2030-01-01", issuedAt: "2020-01-01" },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toEqual(["cpf", "birthDate"]);
  });
});
