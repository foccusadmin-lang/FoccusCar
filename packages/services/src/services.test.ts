import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildAccessContext, type Role } from "@foccus/core";
import { companyMembers, createDb, ensureCompany, users, withTenant, type Database } from "@foccus/db";
import { MemoryStorage } from "@foccus/integrations";
import { approveAccount, getMyProfile, listReviewQueue, readDocumentFile, reviewDocument, saveMyProfile, submitMyProfile, uploadMyDocument, type ServiceDeps } from "./index";

const url = process.env.TEST_DATABASE_URL;
const owner = process.env.TEST_DATABASE_MIGRATION_URL ?? url;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);

// CPFs válidos gerados para o teste.
function cpf(seed: number) {
  const base = String(100000000 + seed).slice(0, 9).split("").map(Number);
  const dv = (ds: number[]) => { const s = ds.reduce((a, d, i) => a + d * (ds.length + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = dv(base); const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

describe.skipIf(!url)("cadastro do cliente e análise", () => {
  let db: Database;
  let deps: ServiceDeps;
  const mails: string[] = [];
  let companyId: string;
  let otherCompanyId: string;
  const s = Math.floor(Math.random() * 800000);

  async function makeUser(role: Role, company = companyId) {
    const [u] = await db.insert(users).values({ name: `Pessoa ${role}`, email: `${role.toLowerCase()}-${s}-${Math.random()}@ex.com` }).returning();
    await withTenant(db, { companyId: company }, (tx) => tx.insert(companyMembers).values({ companyId: company, userId: u!.id, role }));
    return buildAccessContext({ userId: u!.id, companyId: company, roles: [role], accountStatus: u!.status });
  }

  const profile = (n: number) => ({
    personal: { fullName: "Maria da Silva Teste", cpf: cpf(s + n), birthDate: "1990-05-10", phone: "(11) 99999-8888", whatsapp: "11999998888", email: "maria@ex.com" },
    address: { zip: "01001-000", street: "Praça da Sé", number: "100", complement: "", district: "Sé", city: "São Paulo", state: "sp" },
    cnh: { number: "12345678901", categories: "AB", issuedAt: "2020-01-01", expiresAt: "2031-01-01" },
  });

  beforeAll(async () => {
    const o = createDb(owner);
    companyId = (await ensureCompany(o, { name: "Loc Serviços", slug: `svc-${s}` })).id;
    otherCompanyId = (await ensureCompany(o, { name: "Outra", slug: `svc2-${s}` })).id;
    await o.$client.end();
    db = createDb(url);
    deps = { db, storage: new MemoryStorage(), mailer: { send: async (m) => void mails.push(m.subject) } };
  });
  afterAll(async () => db?.$client.end());

  it("fluxo completo: dados → documentos → análise → aprovação → ACTIVE", async () => {
    const client = await makeUser("CLIENTE");
    const operator = await makeUser("OPERADOR");

    let p = await getMyProfile(deps, client);
    expect(p.status).toBe("PROFILE_INCOMPLETE");
    expect(p.progress.readyToSubmit).toBe(false);

    await expect(uploadMyDocument(deps, client, { type: "SELFIE", fileName: "a.jpg", contentType: "image/jpeg", bytes: JPEG })).rejects.toThrow(/Preencha seus dados/);
    await saveMyProfile(deps, client, profile(1));
    await expect(submitMyProfile(deps, client)).rejects.toThrow(/documentos pendentes/);

    for (const type of ["CNH_FRONT", "CNH_BACK", "SELFIE", "PROOF_OF_ADDRESS"] as const)
      await uploadMyDocument(deps, client, { type, fileName: `${type}.jpg`, contentType: "image/jpeg", bytes: JPEG });
    p = await getMyProfile(deps, client);
    expect(p.progress.readyToSubmit).toBe(true);
    expect(p.address?.state).toBe("SP");

    expect((await submitMyProfile(deps, client)).status).toBe("UNDER_REVIEW");
    // identidade travada após envio
    await expect(saveMyProfile(deps, client, { ...profile(1), personal: { ...profile(1).personal, fullName: "Outro Nome Qualquer" } })).rejects.toThrow(/fale com a locadora/);
    // contato continua editável
    await saveMyProfile(deps, client, { ...profile(1), personal: { ...profile(1).personal, phone: "11988887777" } });

    // cliente não entra na fila de análise
    await expect(listReviewQueue(deps, client)).rejects.toThrow(/perfil/);
    const queue = await listReviewQueue(deps, operator);
    const item = queue.find((q) => q.fullName === "Maria da Silva Teste")!;
    expect(item.cpf).toMatch(/^\*\*\*\./);

    // não aprova conta antes dos documentos
    await expect(approveAccount(deps, operator, item.id)).rejects.toThrow(/Aprove todos/);
    const docs = (await getMyProfile(deps, client)).documents;
    for (const d of docs) await reviewDocument(deps, operator, d.id, { decision: "APPROVE" });
    expect((await approveAccount(deps, operator, item.id)).status).toBe("ACTIVE");
    expect((await getMyProfile(deps, client)).status).toBe("ACTIVE");
    expect(mails).toContain("Foccus Car: cadastro aprovado");
  });

  it("documento recusado devolve o cadastro com o motivo", async () => {
    const client = await makeUser("CLIENTE");
    const operator = await makeUser("OPERADOR");
    await saveMyProfile(deps, client, profile(2));
    for (const type of ["CNH_FRONT", "CNH_BACK", "SELFIE", "PROOF_OF_ADDRESS"] as const)
      await uploadMyDocument(deps, client, { type, fileName: "x.jpg", contentType: "image/jpeg", bytes: JPEG });
    await submitMyProfile(deps, client);
    const selfie = (await getMyProfile(deps, client)).documents.find((d) => d.type === "SELFIE")!;
    await expect(reviewDocument(deps, operator, selfie.id, { decision: "REJECT", reason: "" })).rejects.toThrow();
    await reviewDocument(deps, operator, selfie.id, { decision: "REJECT", reason: "Foto sem nitidez, envie outra." });
    const p = await getMyProfile(deps, client);
    expect(p.status).toBe("PROFILE_INCOMPLETE");
    expect(p.documents.find((d) => d.type === "SELFIE")).toMatchObject({ status: "REJECTED", rejectionReason: "Foto sem nitidez, envie outra." });
    expect(p.progress.rejectedDocuments).toEqual(["SELFIE"]);
    // reenvia e volta para análise
    await uploadMyDocument(deps, client, { type: "SELFIE", fileName: "y.jpg", contentType: "image/jpeg", bytes: JPEG });
    expect((await submitMyProfile(deps, client)).status).toBe("UNDER_REVIEW");
  });

  it("protege arquivos e dados", async () => {
    const a = await makeUser("CLIENTE");
    const b = await makeUser("CLIENTE");
    const foreignOperator = await makeUser("OPERADOR", otherCompanyId);
    await saveMyProfile(deps, a, profile(3));
    // CPF duplicado na mesma empresa
    await expect(saveMyProfile(deps, b, profile(3))).rejects.toThrow(/CPF já está cadastrado/);
    // arquivo falso (extensão .jpg mas conteúdo não é imagem)
    await expect(uploadMyDocument(deps, a, { type: "RG", fileName: "rg.jpg", contentType: "image/jpeg", bytes: new TextEncoder().encode("MZ executável") })).rejects.toThrow(/conteúdo/);
    const doc = await uploadMyDocument(deps, a, { type: "RG", fileName: "rg.jpg", contentType: "image/jpeg", bytes: JPEG });
    expect((await readDocumentFile(deps, a, doc.id)).bytes).toEqual(JPEG);
    await expect(readDocumentFile(deps, b, doc.id)).rejects.toThrow(/perfil/);
    // operador de outra empresa nem encontra o documento (isolamento)
    await expect(readDocumentFile(deps, foreignOperator, doc.id)).rejects.toThrow(/não encontrado/);
    const [row] = await db.select({ status: users.status }).from(users).where(eq(users.id, a.userId));
    expect(row!.status).toBe("PROFILE_INCOMPLETE");
  });
});
