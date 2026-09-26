import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { CHECKLIST_ITEMS, type AccountStatus, type Role } from "@foccus/core";
import {
  auditLogs, checklistItems, checklists, companyMembers, contracts, createDb, customerDocuments, customers, damages,
  depositMovements, deposits, drivers, ensureCompany, favorites, financialAccounts, financialTransactions, fines,
  geofences, gpsDevices, gpsPositions, locations, maintenance, maintenanceItems, notifications, occurrences,
  paymentEvents, paymentGatewayConfigs, payments, rentalCharges, rentalDrivers, rentals, representativeListings,
  representatives, reservations, reviews, securityAlerts, telematicsCommands, users, accounts, vehicleCategories,
  vehicleDocuments, vehicleEvents, vehiclePhotos, vehicles, walletTransactions, wallets, withTenant, withdrawalRequests, type Tx,
} from "@foccus/db";
import { buildStorageKey, createStorage } from "@foccus/integrations";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { DEFAULT_DEMO_PASSWORD, DEMO_DOMAIN } from "./logins";

/**
 * Locadora de demonstração para o ambiente de testes (docs/AMBIENTE-DE-TESTES.md).
 * Cria frota, clientes em todos os status, representantes, reservas, locações, pagamentos,
 * manutenção, multas, rastreamento e financeiro com datas relativas a hoje, além de um usuário
 * de teste por perfil. Idempotente: se os usuários de demonstração já existem, não faz nada.
 *
 * Nunca rode em produção com clientes reais: as senhas de teste são públicas.
 */

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD;

type Money = number;
const DAY = 86_400_000;
const now = new Date();
now.setMinutes(0, 0, 0);
/** Data relativa a hoje, no horário indicado (horário de Brasília, UTC-3). */
const at = (days: number, hour = 10) => {
  const d = new Date(now.getTime() + days * DAY);
  d.setUTCHours(hour + 3, 0, 0, 0);
  return d;
};
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: Date, b: Date) => Math.max(1, Math.round((b.getTime() - a.getTime()) / DAY));

/** Gerador pseudoaleatório com semente: a demonstração sai igual a cada instalação. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(2026);
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

/** CPF válido a partir de 9 dígitos. */
function cpf(base: string) {
  const d = base.split("").map(Number);
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += d[i]! * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(9));
  d.push(dv(10));
  return d.join("");
}

// ── Pessoas ────────────────────────────────────────────────────────────────

type Person = {
  key: string;
  name: string;
  email?: string;
  roles: Role[];
  status: AccountStatus;
  customer?: {
    cpfBase: string; birth: string; phone: string; street: string; number: string; district: string; city: string; state: string; zip: string;
    cnh: string; cnhCat: string; complete: boolean;
    docs?: "APPROVED" | "UNDER_REVIEW" | "ONE_REJECTED" | "NONE";
  };
};

const PEOPLE: Person[] = [
  { key: "admin", name: "Administrador Foccus", email: "admin", roles: ["ADMIN"], status: "ACTIVE" },
  { key: "gerente", name: "Ana Ribeiro", email: "gerente", roles: ["GERENTE"], status: "ACTIVE" },
  { key: "operador", name: "Bruno Alves", email: "operador", roles: ["OPERADOR"], status: "ACTIVE" },
  { key: "financeiro", name: "Paula Nunes", email: "financeiro", roles: ["FINANCEIRO"], status: "ACTIVE" },
  {
    key: "mariana", name: "Mariana Costa", email: "cliente", roles: ["CLIENTE"], status: "ACTIVE",
    customer: { cpfBase: "529982247", birth: "1990-03-15", phone: "11987654321", street: "Avenida Paulista", number: "1000", district: "Bela Vista", city: "São Paulo", state: "SP", zip: "01310100", cnh: "04512378901", cnhCat: "AB", complete: true, docs: "APPROVED" },
  },
  {
    key: "carlos", name: "Carlos Mendes", email: "representante", roles: ["REPRESENTANTE", "CLIENTE"], status: "ACTIVE",
    customer: { cpfBase: "153509460", birth: "1984-07-02", phone: "11976543210", street: "Rua Augusta", number: "2200", district: "Jardins", city: "São Paulo", state: "SP", zip: "01412000", cnh: "07845123690", cnhCat: "B", complete: true, docs: "APPROVED" },
  },
  {
    key: "rafael", name: "Rafael Oliveira", email: "analise", roles: ["CLIENTE"], status: "UNDER_REVIEW",
    customer: { cpfBase: "390533447", birth: "1995-11-20", phone: "11965432109", street: "Rua Vergueiro", number: "3185", district: "Vila Mariana", city: "São Paulo", state: "SP", zip: "04101300", cnh: "01928374650", cnhCat: "B", complete: true, docs: "UNDER_REVIEW" },
  },
  {
    key: "thiago", name: "Thiago Almeida", email: "pendente", roles: ["CLIENTE"], status: "PROFILE_INCOMPLETE",
    customer: { cpfBase: "714602380", birth: "1998-01-09", phone: "11954321098", street: "", number: "", district: "", city: "", state: "SP", zip: "", cnh: "", cnhCat: "", complete: false, docs: "NONE" },
  },
  {
    key: "beatriz", name: "Beatriz Carvalho", email: "recusado", roles: ["CLIENTE"], status: "PROFILE_INCOMPLETE",
    customer: { cpfBase: "862731540", birth: "1992-05-30", phone: "11943210987", street: "Rua Harmonia", number: "455", district: "Vila Madalena", city: "São Paulo", state: "SP", zip: "05435000", cnh: "05647382910", cnhCat: "B", complete: true, docs: "ONE_REJECTED" },
  },
  {
    key: "diego", name: "Diego Pereira", email: "bloqueado", roles: ["CLIENTE"], status: "BLOCKED",
    customer: { cpfBase: "247816350", birth: "1987-09-14", phone: "11932109876", street: "Rua Tuiuti", number: "1500", district: "Tatuapé", city: "São Paulo", state: "SP", zip: "03081000", cnh: "03928475610", cnhCat: "B", complete: true, docs: "APPROVED" },
  },
  // Clientes sem senha de teste publicada: dão volume às listas do painel.
  { key: "lucas", name: "Lucas Martins", roles: ["CLIENTE"], status: "ACTIVE", customer: { cpfBase: "318457209", birth: "1989-02-11", phone: "11921098765", street: "Rua Oscar Freire", number: "900", district: "Pinheiros", city: "São Paulo", state: "SP", zip: "05409010", cnh: "06758493021", cnhCat: "AB", complete: true, docs: "APPROVED" } },
  { key: "juliana", name: "Juliana Rocha", roles: ["CLIENTE"], status: "ACTIVE", customer: { cpfBase: "605928371", birth: "1993-08-25", phone: "19998765432", street: "Avenida Norte-Sul", number: "1200", district: "Cambuí", city: "Campinas", state: "SP", zip: "13025320", cnh: "08473625190", cnhCat: "B", complete: true, docs: "APPROVED" } },
  { key: "pedro", name: "Pedro Henrique Lima", roles: ["CLIENTE"], status: "ACTIVE", customer: { cpfBase: "927364518", birth: "1996-12-03", phone: "11910987654", street: "Rua Domingos de Morais", number: "2000", district: "Vila Mariana", city: "São Paulo", state: "SP", zip: "04036000", cnh: "02736451890", cnhCat: "B", complete: true, docs: "APPROVED" } },
  { key: "fernanda", name: "Fernanda Souza", roles: ["CLIENTE"], status: "ACTIVE", customer: { cpfBase: "481736295", birth: "1991-04-17", phone: "11909876543", street: "Alameda Santos", number: "700", district: "Cerqueira César", city: "São Paulo", state: "SP", zip: "01418100", cnh: "09182736450", cnhCat: "B", complete: true, docs: "APPROVED" } },
  { key: "gabriel", name: "Gabriel Santos", roles: ["CLIENTE"], status: "ACTIVE", customer: { cpfBase: "736281945", birth: "1985-10-28", phone: "11998761234", street: "Rua Bela Cintra", number: "1500", district: "Consolação", city: "São Paulo", state: "SP", zip: "01415000", cnh: "01827364590", cnhCat: "AB", complete: true, docs: "APPROVED" } },
  { key: "camila", name: "Camila Ferreira", roles: ["CLIENTE"], status: "UNDER_REVIEW", customer: { cpfBase: "293847561", birth: "1999-06-06", phone: "11987651234", street: "Rua Teodoro Sampaio", number: "800", district: "Pinheiros", city: "São Paulo", state: "SP", zip: "05406000", cnh: "04736281950", cnhCat: "B", complete: true, docs: "UNDER_REVIEW" } },
  { key: "patricia", name: "Patrícia Gomes", roles: ["REPRESENTANTE"], status: "ACTIVE" },
  { key: "roberto", name: "Roberto Dias", roles: [], status: "ACTIVE", customer: { cpfBase: "564738291", birth: "1978-03-19", phone: "11976541234", street: "Avenida Brigadeiro Faria Lima", number: "3000", district: "Itaim Bibi", city: "São Paulo", state: "SP", zip: "01451000", cnh: "05738291640", cnhCat: "B", complete: true, docs: "APPROVED" } },
  { key: "aline", name: "Aline Barbosa", roles: [], status: "ACTIVE", customer: { cpfBase: "819273645", birth: "1994-09-09", phone: "19987651234", street: "Rua Barão de Jaguara", number: "1100", district: "Centro", city: "Campinas", state: "SP", zip: "13015000", cnh: "07382916450", cnhCat: "B", complete: true, docs: "APPROVED" } },
  { key: "marcos", name: "Marcos Vieira", roles: [], status: "ACTIVE", customer: { cpfBase: "374829165", birth: "1982-01-23", phone: "11965431234", street: "Rua Cardeal Arcoverde", number: "1700", district: "Pinheiros", city: "São Paulo", state: "SP", zip: "05407002", cnh: "03827164590", cnhCat: "B", complete: true, docs: "APPROVED" } },
];

/** Usuários de teste publicados no guia: um por perfil e por situação de cadastro. */
export const DEMO_LOGINS = PEOPLE.filter((p) => p.email).map((p) => ({ email: `${p.email}@${DEMO_DOMAIN}`, name: p.name, roles: p.roles, status: p.status }));

// ── Frota ──────────────────────────────────────────────────────────────────

type Car = {
  key: string; plate: string; brand: string; model: string; version: string; year: number; color: string; cat: string;
  transmission: "MANUAL" | "AUTOMATIC" | "CVT" | "AUTOMATED"; fuel: "FLEX" | "GASOLINE" | "DIESEL" | "HYBRID" | "ELECTRIC";
  daily: Money; km: number; status: "AVAILABLE" | "RESERVED" | "RENTED" | "MAINTENANCE" | "CLEANING" | "BLOCKED" | "INACTIVE";
  featured?: boolean; hidden?: boolean; seats?: number; features: string[]; acquisition: Money;
};

const FLEET: Car[] = [
  { key: "corolla", plate: "FCC1A23", brand: "Toyota", model: "Corolla", version: "Altis Hybrid", year: 2026, color: "Preto", cat: "seda-executivo", transmission: "CVT", fuel: "HYBRID", daily: 28900, km: 8000, status: "RENTED", featured: true, features: ["Ar-condicionado digital", "Câmera de ré", "Apple CarPlay e Android Auto", "Piloto automático adaptativo"], acquisition: 18990000 },
  { key: "compass", plate: "FCC2B34", brand: "Jeep", model: "Compass", version: "Limited T270", year: 2025, color: "Cinza Grafite", cat: "suv", transmission: "AUTOMATIC", fuel: "FLEX", daily: 32900, km: 21000, status: "AVAILABLE", featured: true, features: ["Teto solar", "Bancos em couro", "Central multimídia 10\"", "Sensor de estacionamento"], acquisition: 21490000 },
  { key: "polo", plate: "FCC3C45", brand: "Volkswagen", model: "Polo", version: "Highline TSI", year: 2025, color: "Branco", cat: "hatch", transmission: "AUTOMATIC", fuel: "FLEX", daily: 17900, km: 12000, status: "AVAILABLE", features: ["Ar-condicionado", "Painel digital", "Apple CarPlay e Android Auto"], acquisition: 11290000 },
  { key: "seal", plate: "FCC4D56", brand: "BYD", model: "Seal", version: "AWD", year: 2026, color: "Prata", cat: "eletrico", transmission: "AUTOMATIC", fuel: "ELECTRIC", daily: 45900, km: 3000, status: "AVAILABLE", featured: true, features: ["Autonomia de 460 km", "Tração integral", "Teto panorâmico", "Carregador por indução"], acquisition: 29690000 },
  { key: "creta", plate: "FCC5E67", brand: "Hyundai", model: "Creta", version: "Ultimate 1.0 Turbo", year: 2025, color: "Azul", cat: "suv", transmission: "AUTOMATIC", fuel: "FLEX", daily: 27900, km: 15000, status: "RENTED", features: ["Teto solar", "Frenagem autônoma", "Câmera 360°"], acquisition: 16490000 },
  { key: "onix", plate: "FCC6F78", brand: "Chevrolet", model: "Onix", version: "Premier 1.0 Turbo", year: 2025, color: "Vermelho", cat: "hatch", transmission: "AUTOMATIC", fuel: "FLEX", daily: 15900, km: 26000, status: "MAINTENANCE", features: ["Wi-Fi nativo", "Ar-condicionado", "Sensor de estacionamento"], acquisition: 10390000 },
  { key: "civic", plate: "FCC7G89", brand: "Honda", model: "Civic", version: "Touring Hybrid", year: 2024, color: "Champanhe", cat: "seda-executivo", transmission: "CVT", fuel: "HYBRID", daily: 26900, km: 34000, status: "AVAILABLE", features: ["Honda Sensing", "Som Bose", "Bancos em couro"], acquisition: 26500000 },
  { key: "hilux", plate: "FCC8H90", brand: "Toyota", model: "Hilux", version: "SRX 2.8 Diesel 4x4", year: 2025, color: "Branco Pérola", cat: "pickup", transmission: "AUTOMATIC", fuel: "DIESEL", daily: 39900, km: 29000, status: "RESERVED", features: ["Tração 4x4", "Capota marítima", "Controle de descida"], acquisition: 31990000 },
  { key: "pulse", plate: "FCC9J01", brand: "Fiat", model: "Pulse", version: "Impetus 1.0 Turbo", year: 2025, color: "Laranja", cat: "hatch", transmission: "AUTOMATIC", fuel: "FLEX", daily: 16900, km: 9000, status: "CLEANING", features: ["Central multimídia 10\"", "Carregador por indução"], acquisition: 12990000 },
  { key: "kwid", plate: "FCD0K12", brand: "Renault", model: "Kwid", version: "Zen 1.0", year: 2024, color: "Verde", cat: "hatch", transmission: "MANUAL", fuel: "FLEX", daily: 9900, km: 45000, status: "AVAILABLE", features: ["Ar-condicionado", "Direção elétrica"], acquisition: 6890000 },
  { key: "bmw", plate: "FCD1L23", brand: "BMW", model: "320i", version: "M Sport", year: 2025, color: "Azul Portimão", cat: "seda-executivo", transmission: "AUTOMATIC", fuel: "GASOLINE", daily: 54900, km: 5000, status: "AVAILABLE", featured: true, features: ["Pacote M Sport", "Head-up display", "Som Harman Kardon", "Assistente de estacionamento"], acquisition: 34950000 },
  { key: "volvo", plate: "FCD2M34", brand: "Volvo", model: "EX30", version: "Ultra", year: 2026, color: "Grafite", cat: "eletrico", transmission: "AUTOMATIC", fuel: "ELECTRIC", daily: 42900, km: 1500, status: "RENTED", features: ["Autonomia de 338 km", "Google integrado", "Teto panorâmico"], acquisition: 28995000 },
  { key: "kicks", plate: "FCD3N45", brand: "Nissan", model: "Kicks", version: "Exclusive", year: 2024, color: "Prata", cat: "suv", transmission: "CVT", fuel: "FLEX", daily: 21900, km: 41000, status: "INACTIVE", hidden: true, features: ["Câmera 360°", "Ar-condicionado digital"], acquisition: 12490000 },
  { key: "strada", plate: "FCD4P56", brand: "Fiat", model: "Strada", version: "Volcano 1.3 CVT", year: 2025, color: "Vermelho", cat: "pickup", transmission: "CVT", fuel: "FLEX", daily: 19900, km: 20000, status: "BLOCKED", hidden: true, features: ["Caçamba com protetor", "Central multimídia"], acquisition: 11490000 },
];

/** Posição de referência de cada carro no mapa (região de São Paulo e Campinas). */
const POSITIONS: Record<string, [number, number]> = {
  corolla: [-23.5874, -46.6576], compass: [-23.5614, -46.6559], polo: [-23.5614, -46.6561], seal: [-23.5615, -46.6558],
  creta: [-23.4356, -46.4731], onix: [-23.5329, -46.6395], civic: [-23.6261, -46.6566], hilux: [-23.6262, -46.6564],
  pulse: [-23.5613, -46.6560], kwid: [-22.9056, -47.0608], bmw: [-23.6263, -46.6565], volvo: [-23.0145, -46.8412],
  kicks: [-22.9057, -47.0609], strada: [-24.0058, -46.4028],
};

// ── Seed ───────────────────────────────────────────────────────────────────

export async function seedDemo(opts: { databaseUrl?: string; companySlug?: string } = {}) {
  const url = opts.databaseUrl ?? process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  const db = createDb(url);
  try {
    const adminEmail = `admin@${DEMO_DOMAIN}`;
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
    if (existing) {
      console.log("Demonstração já instalada: nada a fazer.");
      return { created: false };
    }

    const company = await ensureCompany(db, {
      name: "Foccus Car",
      slug: opts.companySlug ?? process.env.DEFAULT_COMPANY_SLUG ?? "foccus-car",
      domain: process.env.DEFAULT_COMPANY_DOMAIN || null,
    });
    const companyId = company.id;
    companyIdForHelpers = companyId;
    const storage = createStorage();
    const docImages = {
      CNH_FRONT: readAsset("cnh-frente.jpg"),
      CNH_BACK: readAsset("cnh-verso.jpg"),
      RG: readAsset("rg.jpg"),
      PROOF_OF_ADDRESS: readAsset("comprovante.jpg"),
      SELFIE: readAsset("selfie.jpg"),
    } as const;

    // Usuários e senhas (tabelas globais, fora do isolamento por empresa).
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const userIds: Record<string, string> = {};
    for (const p of PEOPLE) {
      if (!p.roles.length) continue; // cliente de balcão, sem login
      const email = p.email ? `${p.email}@${DEMO_DOMAIN}` : `${slugify(p.name)}@${DEMO_DOMAIN}`;
      const [u] = await db
        .insert(users)
        .values({ name: p.name, email, emailVerified: true, status: p.status, lastLoginAt: p.email ? at(-between(0, 6), 9) : null, createdAt: at(-between(60, 170)) })
        .returning({ id: users.id });
      userIds[p.key] = u!.id;
      if (p.email) await db.insert(accounts).values({ userId: u!.id, providerId: "credential", accountId: u!.id, password: passwordHash });
    }
    const uid = (k: string) => userIds[k]!;
    const staff = { admin: uid("admin"), gerente: uid("gerente"), operador: uid("operador"), financeiro: uid("financeiro") };

    const pendingUploads: { key: string; bytes: Buffer; type: string }[] = [];

    await withTenant(db, { companyId, userId: staff.admin }, async (tx) => {
      // Perfis na empresa
      for (const p of PEOPLE)
        for (const role of p.roles)
          await tx.insert(companyMembers).values({ companyId, userId: uid(p.key), role, createdBy: role === "CLIENTE" ? null : staff.admin }).onConflictDoNothing();

      await tx.insert(paymentGatewayConfigs).values({ companyId, provider: "mercadopago", isDefault: true, secretRef: "MERCADOPAGO_ACCESS_TOKEN", maxInstallments: 6 });
      const [cash, gateway, holding] = await tx
        .insert(financialAccounts)
        .values([
          { companyId, name: "Caixa da loja", kind: "CASH" },
          { companyId, name: "Mercado Pago", kind: "GATEWAY" },
          { companyId, name: "Cauções em garantia", kind: "DEPOSIT_HOLDING" },
        ])
        .returning();

      // Lojas e categorias
      const locs = await tx
        .insert(locations)
        .values([
          { companyId, name: "Loja Paulista", address: "Av. Paulista, 1500", city: "São Paulo", state: "SP", latitude: "-23.561400", longitude: "-46.655900" },
          { companyId, name: "Aeroporto de Congonhas", address: "Av. Washington Luís, s/n", city: "São Paulo", state: "SP", latitude: "-23.626200", longitude: "-46.656500" },
          { companyId, name: "Unidade Campinas", address: "Av. Norte-Sul, 1200", city: "Campinas", state: "SP", latitude: "-22.905600", longitude: "-47.060800" },
        ])
        .returning();
      const [paulista, congonhas, campinas] = locs as [typeof locs[0], typeof locs[0], typeof locs[0]];
      const cats = await tx
        .insert(vehicleCategories)
        .values([
          { companyId, name: "Sedã Executivo", slug: "seda-executivo", description: "Conforto e tecnologia para viagens e compromissos." },
          { companyId, name: "SUV", slug: "suv", description: "Espaço, posição de dirigir elevada e porta-malas generoso." },
          { companyId, name: "Hatch", slug: "hatch", description: "Econômicos e práticos para o dia a dia na cidade." },
          { companyId, name: "Elétrico", slug: "eletrico", description: "Zero emissão, silêncio e muita aceleração." },
          { companyId, name: "Picape", slug: "pickup", description: "Força para trabalho, obra e estrada de terra." },
        ])
        .onConflictDoNothing()
        .returning();
      const allCats = cats.length ? cats : await tx.select().from(vehicleCategories);
      const catId = Object.fromEntries(allCats.map((c) => [c.slug, c.id]));

      // Veículos
      const car: Record<string, { id: string; km: number; daily: Money; deposit: Money } & Car> = {};
      for (const c of FLEET) {
        const loc = ["kwid", "kicks"].includes(c.key) ? campinas : ["civic", "hilux", "bmw"].includes(c.key) ? congonhas : paulista;
        const deposit = c.daily >= 40000 ? 300000 : c.daily >= 25000 ? 200000 : 150000;
        const acquiredAt = at(-between(200, 400));
        const [row] = await tx
          .insert(vehicles)
          .values({
            companyId, plate: c.plate, brand: c.brand, model: c.model, version: c.version, modelYear: c.year, manufactureYear: c.year - (c.year === 2026 ? 1 : 0),
            color: c.color, categoryId: catId[c.cat], transmission: c.transmission, fuelType: c.fuel, seats: c.seats ?? 5, features: c.features,
            currentKm: c.km, status: c.status, dailyRateCents: c.daily, weeklyRateCents: Math.round(c.daily * 6.3), biweeklyRateCents: Math.round(c.daily * 12),
            monthlyRateCents: Math.round(c.daily * 22), depositCents: deposit, kmAllowancePerDay: 200, extraKmCents: 150, locationId: loc.id,
            showcaseVisible: !c.hidden, showcaseFeatured: Boolean(c.featured), acquiredAt, acquisitionCents: c.acquisition,
            renavam: String(between(10000000000, 99999999999)).slice(0, 11), chassis: `9BW${c.plate}${String(between(100000, 999999))}`.slice(0, 17),
            createdBy: staff.admin, createdAt: acquiredAt,
          })
          .onConflictDoNothing()
          .returning();
        const v = row ?? (await tx.select().from(vehicles).where(eq(vehicles.plate, c.plate)))[0]!;
        car[c.key] = { ...c, id: v.id, km: c.km, daily: c.daily, deposit };
        // Foto ilustrativa da marca (a equipe troca pelas fotos reais no painel).
        const photoId = randomUUID();
        const photoKey = buildStorageKey(companyId, `vehicles/${v.id}/photos`, photoId, "image/webp");
        await tx.insert(vehiclePhotos).values({ id: photoId, companyId, vehicleId: v.id, storageKey: photoKey, position: 0, isCover: true, isPublic: true, alt: `${c.brand} ${c.model}` });
        pendingUploads.push({ key: photoKey, bytes: carImage(c.color), type: "image/webp" });
        await event(tx, v.id, "FLEET_ENTRY", acquiredAt, `Entrada na frota: ${c.brand} ${c.model} ${c.version}`, "admin", { km: c.km, amountCents: c.acquisition, actor: staff.admin });
        // Documentação da frota
        const crlvExp = c.key === "kwid" ? at(12) : c.key === "kicks" ? at(-20) : at(between(90, 300));
        await tx.insert(vehicleDocuments).values([
          { companyId, vehicleId: v.id, type: "CRLV", number: `CRLV-${c.plate}-2026`, status: c.key === "kicks" ? "EXPIRED" : "APPROVED", issuedAt: at(-120), expiresAt: crlvExp, costCents: 16000, createdBy: staff.operador },
          { companyId, vehicleId: v.id, type: "INSURANCE", number: `APL-${between(100000, 999999)}`, status: "APPROVED", issuedAt: at(-200), expiresAt: c.key === "pulse" ? at(9) : at(between(120, 330)), costCents: Math.round(c.acquisition * 0.04), createdBy: staff.financeiro },
          { companyId, vehicleId: v.id, type: "IPVA", number: `IPVA-2026-${c.plate}`, status: "APPROVED", issuedAt: at(-240), expiresAt: at(between(40, 90)), costCents: Math.round(c.acquisition * 0.04), createdBy: staff.financeiro },
        ]);
      }

      // Clientes, condutores e documentos
      const cust: Record<string, { id: string; driverId?: string; userId?: string }> = {};
      for (const p of PEOPLE) {
        if (!p.customer) continue;
        const c = p.customer;
        const hasUser = p.roles.length > 0;
        const created = at(-between(40, 160));
        const [row] = await tx
          .insert(customers)
          .values({
            companyId, userId: hasUser ? uid(p.key) : null, fullName: p.name, cpf: cpf(c.cpfBase), birthDate: c.birth, phone: c.phone, whatsapp: c.phone,
            email: p.email ? `${p.email}@${DEMO_DOMAIN}` : `${slugify(p.name)}@${DEMO_DOMAIN}`, zip: c.zip || null, street: c.street || null, number: c.number || null,
            district: c.district || null, city: c.city || null, state: c.state || null, profileCompletedAt: c.complete ? created : null, createdAt: created,
            notes: p.key === "diego" ? "Bloqueado após devolução com atraso de 9 dias e débito em aberto." : null,
          })
          .returning({ id: customers.id });
        cust[p.key] = { id: row!.id, userId: hasUser ? uid(p.key) : undefined };
        if (c.cnh) {
          const [d] = await tx
            .insert(drivers)
            .values({ companyId, customerId: row!.id, fullName: p.name, cpf: cpf(c.cpfBase), isCustomerSelf: true, cnhNumber: c.cnh, cnhCategories: c.cnhCat, cnhIssuedAt: "2021-08-10", cnhExpiresAt: p.key === "lucas" ? dateOnly(at(25)) : "2031-08-10" })
            .returning({ id: drivers.id });
          cust[p.key]!.driverId = d!.id;
        }
        if (c.docs && c.docs !== "NONE") {
          for (const type of ["CNH_FRONT", "CNH_BACK", "SELFIE", "PROOF_OF_ADDRESS"] as const) {
            const status = c.docs === "APPROVED" ? "APPROVED" : c.docs === "UNDER_REVIEW" ? "UNDER_REVIEW" : type === "SELFIE" ? "REJECTED" : "APPROVED";
            const id = randomUUID();
            const key = buildStorageKey(companyId, `customers/${row!.id}/documents`, id, "image/jpeg");
            const submitted = at(-between(2, 30), 14);
            const history: { status: string; at: string; by?: string; reason?: string }[] = [{ status: "PENDING", at: submitted.toISOString(), by: uid(p.key) }, { status: "UNDER_REVIEW", at: submitted.toISOString(), by: uid(p.key) }];
            const reason = status === "REJECTED" ? "A foto ficou escura e o rosto não aparece por inteiro. Envie uma nova selfie com boa iluminação." : null;
            if (status !== "UNDER_REVIEW") history.push({ status, at: new Date(submitted.getTime() + DAY).toISOString(), by: staff.operador, reason: reason ?? undefined });
            await tx.insert(customerDocuments).values({
              id, companyId, customerId: row!.id, driverId: cust[p.key]!.driverId, type, status, storageKey: key, mimeType: "image/jpeg",
              sizeBytes: String(docImages[type].length), submittedAt: submitted, reviewedAt: status === "UNDER_REVIEW" ? null : new Date(submitted.getTime() + DAY),
              reviewedBy: status === "UNDER_REVIEW" ? null : staff.operador, rejectionReason: reason, expiresAt: type === "CNH_FRONT" ? "2031-08-10" : null, history,
            });
            pendingUploads.push({ key, bytes: docImages[type], type: "image/jpeg" });
          }
        }
      }

      // Representantes, ofertas e carteira
      const [repCarlos, repPatricia] = await tx
        .insert(representatives)
        .values([
          { companyId, userId: uid("carlos"), displayName: "Carlos Mendes Viagens", document: cpf("153509460"), maxMarginCents: 8000, status: "ACTIVE", createdAt: at(-150) },
          { companyId, userId: uid("patricia"), displayName: "Patrícia Gomes Turismo", document: cpf("908172635"), maxMarginCents: 5000, status: "PENDING", createdAt: at(-3) },
        ])
        .returning();
      const listings: Record<string, string> = {};
      for (const [k, margin, active] of [["volvo", 6000, true], ["bmw", 8000, true], ["compass", 4000, true], ["corolla", 3500, true], ["kwid", 1500, false]] as const) {
        const [l] = await tx
          .insert(representativeListings)
          .values({ companyId, representativeId: repCarlos!.id, vehicleId: car[k]!.id, slug: `carlos-${k}`, marginCents: margin, active, createdAt: at(-between(20, 120)) })
          .returning();
        listings[k] = l!.id;
      }
      const [wallet] = await tx.insert(wallets).values({ companyId, representativeId: repCarlos!.id }).returning();
      await tx.insert(wallets).values({ companyId, representativeId: repPatricia!.id });

      // ── Operação: reservas, locações, pagamentos ───────────────────────────
      let seq = 0;
      const code = (prefix: string) => `${prefix}${String(now.getFullYear()).slice(2)}-${String(++seq).padStart(4, "0")}`;
      const walletMoves: { kind: "MARGIN" | "WITHDRAWAL"; amount: Money; status: "PENDING" | "AVAILABLE" | "WITHDRAWN"; reservationId?: string; rentalId?: string; when: Date; origin: string; destination: string; withdrawalRequestId?: string }[] = [];

      type Flow = {
        car: string; customer: string; start: Date; end: Date; kind: "closed" | "active" | "future" | "pending" | "cancelled";
        method?: "PIX" | "CREDIT_CARD"; listing?: string; late?: boolean; damage?: boolean; location?: string;
      };

      async function flow(f: Flow) {
        const v = car[f.car]!;
        const c = cust[f.customer]!;
        const days = daysBetween(f.start, f.end);
        const period = days >= 28 ? "MONTHLY" : days >= 7 ? "WEEKLY" : "DAILY";
        const base = period === "MONTHLY" ? Math.round((v.daily * 22 * days) / 30) : period === "WEEKLY" ? Math.round((v.daily * 6.3 * days) / 7) : v.daily * days;
        const margin = f.listing ? await marginOf(tx, f.listing) : 0;
        const price = base + margin * days;
        const created = new Date(Math.min(f.start.getTime() - between(2, 12) * DAY, now.getTime() - between(3, 30) * 3600_000));
        const resStatus = f.kind === "closed" || f.kind === "active" ? "CONVERTED" : f.kind === "future" ? "CONFIRMED" : f.kind === "pending" ? "PENDING_PAYMENT" : "CANCELLED";
        const [res] = await tx
          .insert(reservations)
          .values({
            companyId, code: code("R"), customerId: c.id, vehicleId: v.id, categoryId: undefined, representativeListingId: f.listing ?? null,
            pickupLocationId: paulista.id, returnLocationId: paulista.id, pickupAt: f.start, returnAt: f.end, period, priceCents: price,
            representativeMarginCents: margin * days, depositCents: v.deposit, totalCents: price, status: resStatus, createdAt: created, createdBy: c.userId ?? staff.operador,
            cancelledAt: f.kind === "cancelled" ? new Date(created.getTime() + DAY) : null,
            cancelReason: f.kind === "cancelled" ? "Cliente mudou a data da viagem." : null,
            expiresAt: f.kind === "pending" ? at(1, 18) : null,
          })
          .returning();
        await event(tx, v.id, "RESERVATION", created, `Reserva ${res!.code} para ${nameOf(f.customer)}`, "reservations", { refTable: "reservations", refId: res!.id });

        const method = f.method ?? (rand() > 0.45 ? "PIX" : "CREDIT_CARD");
        const paid = f.kind !== "pending" && f.kind !== "cancelled";
        const payStatus = f.kind === "pending" ? "PENDING" : f.kind === "cancelled" ? "REFUNDED" : "APPROVED";
        const approvedAt = new Date(created.getTime() + 2 * 3600_000);
        const [pay] = await tx
          .insert(payments)
          .values({
            companyId, customerId: c.id, reservationId: res!.id, purpose: "RESERVATION", method, status: payStatus, amountCents: price,
            installments: method === "CREDIT_CARD" && price > 150000 ? 3 : 1, provider: "mercadopago",
            providerPaymentId: `MP-${between(10000000, 99999999)}-${seq}`, idempotencyKey: randomUUID(),
            pixQrCode: method === "PIX" ? "00020126580014br.gov.bcb.pix0136demo-foccus-car-pix-sem-valor5204000053039865802BR" : null,
            expiresAt: f.kind === "pending" ? at(1, 18) : null, approvedAt: paid || f.kind === "cancelled" ? approvedAt : null, createdAt: created,
          })
          .returning();
        await tx.insert(paymentEvents).values([
          { companyId, paymentId: pay!.id, fromStatus: null, toStatus: "PENDING", source: "API", createdAt: created },
          ...(payStatus !== "PENDING" ? [{ companyId, paymentId: pay!.id, fromStatus: "PENDING" as const, toStatus: "APPROVED" as const, source: "WEBHOOK" as const, createdAt: approvedAt }] : []),
          ...(payStatus === "REFUNDED" ? [{ companyId, paymentId: pay!.id, fromStatus: "APPROVED" as const, toStatus: "REFUNDED" as const, source: "ADMIN" as const, createdAt: new Date(created.getTime() + DAY) }] : []),
        ]);
        if (paid)
          await ledger(tx, { direction: "INCOME", category: "RENTAL", amount: price, when: approvedAt, account: gateway!.id, vehicleId: v.id, customerId: c.id, reservationId: res!.id, paymentId: pay!.id, description: `Locação ${v.brand} ${v.model} · ${nameOf(f.customer)}` });
        if (paid) await ledger(tx, { direction: "EXPENSE", category: "FEE", amount: Math.round(price * (method === "PIX" ? 0.0099 : 0.0399)), when: approvedAt, account: gateway!.id, paymentId: pay!.id, description: `Taxa ${method === "PIX" ? "Pix" : "cartão"} Mercado Pago` });
        if (f.kind === "cancelled")
          await ledger(tx, { direction: "EXPENSE", category: "REFUND", amount: price, when: new Date(created.getTime() + DAY), account: gateway!.id, customerId: c.id, reservationId: res!.id, paymentId: pay!.id, description: `Estorno da reserva ${res!.code}` });

        const contractStatus = f.kind === "pending" ? "ISSUED" : f.kind === "cancelled" ? "CANCELLED" : "SIGNED";
        await tx.insert(contracts).values({
          companyId, number: code("C"), reservationId: res!.id, templateVersion: "2026.1", status: contractStatus,
          snapshot: { cliente: nameOf(f.customer), veiculo: `${v.brand} ${v.model} ${v.version}`, placa: v.plate, retirada: f.start.toISOString(), devolucao: f.end.toISOString(), valorCents: price, caucaoCents: v.deposit, kmPorDia: 200 },
          issuedAt: created, signedAt: contractStatus === "SIGNED" ? approvedAt : null,
          signature: contractStatus === "SIGNED" ? { provider: "foccus-click", ip: "189.40.10.20", userAgent: "Mozilla/5.0 (demo)" } : null,
        });

        if (f.listing) {
          const repAmount = margin * days;
          walletMoves.push({ kind: "MARGIN", amount: repAmount, status: f.kind === "closed" ? "AVAILABLE" : "PENDING", reservationId: res!.id, when: approvedAt, origin: `Reserva ${res!.code}`, destination: "Carteira" });
          if (paid) await ledger(tx, { direction: "EXPENSE", category: "REPRESENTATIVE_MARGIN", amount: repAmount, when: approvedAt, account: gateway!.id, reservationId: res!.id, description: `Margem do representante · reserva ${res!.code}` });
        }

        if (f.kind !== "closed" && f.kind !== "active") return { reservationId: res!.id };

        // Locação
        const kmOut = v.km;
        const driven = days * between(60, 190);
        const kmIn = f.kind === "closed" ? kmOut + driven : null;
        const actualReturn = f.kind === "closed" ? (f.late ? new Date(f.end.getTime() + 2 * DAY) : f.end) : null;
        const [rent] = await tx
          .insert(rentals)
          .values({
            companyId, code: code("L"), reservationId: res!.id, customerId: c.id, mainDriverId: c.driverId!, vehicleId: v.id, startAt: f.start,
            expectedReturnAt: f.end, actualReturnAt: actualReturn, period, amountCents: price, depositCents: v.deposit, kmOut, kmIn, kmAllowance: days * 200,
            fuelOut: "FULL", fuelIn: f.kind === "closed" ? (f.damage ? "HALF" : "FULL") : null, status: f.kind === "closed" ? "CLOSED" : "ACTIVE",
            createdBy: staff.operador, createdAt: f.start,
          })
          .returning();
        await tx.update(payments).set({ rentalId: rent!.id }).where(eq(payments.id, pay!.id));
        await tx.insert(rentalDrivers).values({ companyId, rentalId: rent!.id, driverId: c.driverId!, isMain: true, authorizedFrom: f.start, authorizedUntil: f.end, authorizedBy: staff.operador });
        if (f.listing) walletMoves[walletMoves.length - 1]!.rentalId = rent!.id;

        // Caução
        const [depPay] = await tx
          .insert(payments)
          .values({ companyId, customerId: c.id, reservationId: res!.id, rentalId: rent!.id, purpose: "DEPOSIT", method: "CREDIT_CARD", status: "APPROVED", amountCents: v.deposit, provider: "mercadopago", providerPaymentId: `MP-${between(10000000, 99999999)}-D${seq}`, idempotencyKey: randomUUID(), approvedAt: f.start, createdAt: f.start })
          .returning();
        const retained = f.damage ? 85000 : 0;
        const [dep] = await tx
          .insert(deposits)
          .values({ companyId, rentalId: rent!.id, reservationId: res!.id, customerId: c.id, amountCents: v.deposit, retainedCents: retained, status: f.kind === "active" ? "HELD" : retained ? "PARTIALLY_RETAINED" : "RELEASED", paymentId: depPay!.id, createdAt: f.start })
          .returning();
        await tx.insert(depositMovements).values([
          { companyId, depositId: dep!.id, kind: "HOLD", amountCents: v.deposit, reason: "Pré-autorização no cartão na retirada", createdAt: f.start, createdBy: staff.operador },
          ...(f.kind === "closed" && retained ? [{ companyId, depositId: dep!.id, kind: "RETAIN" as const, amountCents: retained, reason: "Avaria no para-choque traseiro", createdAt: actualReturn!, createdBy: staff.gerente }] : []),
          ...(f.kind === "closed" ? [{ companyId, depositId: dep!.id, kind: "RELEASE" as const, amountCents: v.deposit - retained, reason: "Devolução concluída", createdAt: actualReturn!, createdBy: staff.financeiro }] : []),
        ]);

        // Checklist de saída
        const out = await checklist(tx, { rentalId: rent!.id, vehicleId: v.id, type: "CHECKOUT", when: f.start, km: kmOut, fuel: "FULL", by: staff.operador });
        await event(tx, v.id, "CHECKOUT", f.start, `Checklist de saída · ${nameOf(f.customer)}`, "checklists", { km: kmOut, refTable: "checklists", refId: out });
        await event(tx, v.id, "RENTAL_START", f.start, `Início da locação ${rent!.code}`, "rentals", { km: kmOut, refTable: "rentals", refId: rent!.id, amountCents: price });

        if (f.kind === "closed") {
          const back = await checklist(tx, { rentalId: rent!.id, vehicleId: v.id, type: "RETURN", when: actualReturn!, km: kmIn!, fuel: f.damage ? "HALF" : "FULL", by: staff.operador, damageItem: f.damage ? "para_choques" : undefined });
          await event(tx, v.id, "RETURN", actualReturn!, `Checklist de devolução · ${nameOf(f.customer)}`, "checklists", { km: kmIn!, refTable: "checklists", refId: back });
          await event(tx, v.id, "RENTAL_END", actualReturn!, `Fim da locação ${rent!.code} · ${kmIn! - kmOut} km rodados`, "rentals", { km: kmIn!, refTable: "rentals", refId: rent!.id });
          v.km = kmIn!;
          if (f.damage) {
            const [dmg] = await tx
              .insert(damages)
              .values({ companyId, vehicleId: v.id, rentalId: rent!.id, detectedInChecklistId: back, location: "Para-choque traseiro", description: "Amassado com risco de 12 cm no lado esquerdo.", severity: "MEDIUM", estimatedCostCents: 85000, responsibleCustomerId: c.id, repairedAt: new Date(actualReturn!.getTime() + 4 * DAY), createdBy: staff.operador })
              .returning();
            await event(tx, v.id, "DAMAGE", actualReturn!, "Avaria nova: para-choque traseiro (média)", "checklists", { refTable: "damages", refId: dmg!.id, amountCents: 85000 });
            await tx.insert(rentalCharges).values([
              { companyId, rentalId: rent!.id, category: "DAMAGE", description: "Reparo do para-choque traseiro (retido da caução)", amountCents: 85000, status: "PAID", createdBy: staff.gerente },
              { companyId, rentalId: rent!.id, category: "FUEL", description: "Combustível: devolvido com meio tanque", amountCents: 18000, status: "OPEN", createdBy: staff.operador },
              { companyId, rentalId: rent!.id, category: "EXTRA_DAY", description: "2 diárias de atraso na devolução", amountCents: v.daily * 2, status: "BILLED", createdBy: staff.operador },
            ]);
            await ledger(tx, { direction: "INCOME", category: "DAMAGE", amount: 85000, when: actualReturn!, account: holding!.id, vehicleId: v.id, customerId: c.id, rentalId: rent!.id, description: "Avaria retida da caução" });
          }
          if (rand() > 0.35)
            await tx.insert(reviews).values({ companyId, rentalId: rent!.id, direction: "CUSTOMER_TO_RENTAL", rating: f.damage ? 4 : between(4, 5), criteria: { veiculo: 5, atendimento: between(4, 5), limpeza: between(4, 5) }, comment: pick(["Carro impecável e retirada rápida.", "Atendimento excelente, voltarei a alugar.", "Tudo certo, só a fila da retirada que demorou um pouco.", "Veículo novo e muito econômico."]), authorUserId: c.userId ?? null });
        }
        return { reservationId: res!.id, rentalId: rent!.id };
      }

      // Histórico: locações encerradas nos últimos meses, sem sobreposição por veículo.
      const regulars = ["mariana", "lucas", "juliana", "pedro", "fernanda", "gabriel", "roberto", "aline", "marcos", "carlos", "diego"];
      const historyCars = FLEET.filter((c) => c.key !== "strada");
      let who = 0;
      for (const c of historyCars) {
        let start = at(-165 + between(0, 12));
        const stop = at(c.status === "RENTED" || c.key === "compass" || c.key === "hilux" || c.key === "polo" ? -14 : -3);
        while (true) {
          const len = between(2, 9);
          const end = new Date(start.getTime() + len * DAY);
          if (end >= stop) break;
          const customer = regulars[who++ % regulars.length]!;
          const listing = c.key in listings && rand() > 0.55 && listings[c.key] ? listings[c.key] : undefined;
          await flow({ car: c.key, customer, start, end, kind: "closed", listing, damage: c.key === "creta" && customer === "lucas" && !damagedOnce ? (damagedOnce = true) : false, late: false });
          start = new Date(end.getTime() + between(3, 14) * DAY);
        }
      }

      // Situação de agora
      await flow({ car: "corolla", customer: "mariana", start: at(-3, 9), end: at(4, 18), kind: "active", method: "CREDIT_CARD" });
      await flow({ car: "creta", customer: "lucas", start: at(-9, 9), end: at(-1, 18), kind: "active", method: "PIX", late: true });
      await flow({ car: "volvo", customer: "fernanda", start: at(-2, 10), end: at(5, 10), kind: "active", listing: listings.volvo, method: "CREDIT_CARD" });
      await flow({ car: "compass", customer: "mariana", start: at(8, 10), end: at(12, 18), kind: "future", method: "PIX" });
      await flow({ car: "hilux", customer: "juliana", start: at(1, 9), end: at(6, 18), kind: "future", method: "CREDIT_CARD" });
      await flow({ car: "bmw", customer: "gabriel", start: at(15, 10), end: at(18, 10), kind: "future", listing: listings.bmw, method: "CREDIT_CARD" });
      await flow({ car: "polo", customer: "pedro", start: at(5, 9), end: at(9, 18), kind: "pending", method: "PIX" });
      await flow({ car: "seal", customer: "gabriel", start: at(20, 9), end: at(23, 18), kind: "cancelled", method: "CREDIT_CARD" });

      // Quilometragem final
      for (const c of Object.values(car)) await tx.update(vehicles).set({ currentKm: c.km }).where(eq(vehicles.id, c.id));

      // Carteira do representante
      const [paidWd, openWd] = await tx
        .insert(withdrawalRequests)
        .values([
          { companyId, walletId: wallet!.id, amountCents: 60000, destination: "PIX", destinationDetailsMasked: "Pix ***.509.460-**", status: "PAID", reviewedBy: staff.financeiro, reviewedAt: at(-25), paidAt: at(-24), createdAt: at(-27), createdBy: uid("carlos") },
          { companyId, walletId: wallet!.id, amountCents: 30000, destination: "BANK", destinationDetailsMasked: "Itaú ag. 0001 c/c ***45-6", status: "REQUESTED", createdAt: at(-1), createdBy: uid("carlos") },
        ])
        .returning();
      walletMoves.push({ kind: "WITHDRAWAL", amount: -60000, status: "WITHDRAWN", when: at(-24), origin: "Carteira", destination: "Pix ***.509.460-**", withdrawalRequestId: paidWd!.id });
      walletMoves.push({ kind: "WITHDRAWAL", amount: -30000, status: "PENDING", when: at(-1), origin: "Carteira", destination: "Itaú ag. 0001 c/c ***45-6", withdrawalRequestId: openWd!.id });
      let available = 0, pending = 0, earned = 0, withdrawn = 0;
      for (const m of walletMoves) {
        await tx.insert(walletTransactions).values({ companyId, walletId: wallet!.id, kind: m.kind, amountCents: m.amount, status: m.status, origin: m.origin, destination: m.destination, reservationId: m.reservationId, rentalId: m.rentalId, withdrawalRequestId: m.withdrawalRequestId, availableAt: m.status === "AVAILABLE" ? m.when : null, createdAt: m.when });
        if (m.kind === "MARGIN") {
          earned += m.amount;
          if (m.status === "AVAILABLE") available += m.amount;
          else pending += m.amount;
        } else if (m.status === "WITHDRAWN") {
          withdrawn += -m.amount;
          available += m.amount;
        } else available += m.amount;
      }
      await tx.update(wallets).set({ availableCents: available, pendingCents: pending, totalEarnedCents: earned, totalWithdrawnCents: withdrawn }).where(eq(wallets.id, wallet!.id));
      await ledger(tx, { direction: "EXPENSE", category: "REPRESENTATIVE_MARGIN", amount: 60000, when: at(-24), account: cash!.id, description: "Saque do representante Carlos Mendes (Pix)", status: "CONFIRMED" });

      // Manutenção
      const maint = [
        { car: "onix", type: "BRAKES" as const, status: "IN_PROGRESS" as const, when: at(-1), service: "Troca de pastilhas e discos dianteiros", parts: 98000, labor: 32000, workshop: "Auto Center Paulista", nextKm: null },
        { car: "civic", type: "REVIEW" as const, status: "SCHEDULED" as const, when: at(6), service: "Revisão dos 40.000 km", parts: 0, labor: 0, workshop: "Concessionária Honda Moema", nextKm: 40000 },
        { car: "corolla", type: "OIL" as const, status: "DONE" as const, when: at(-20), service: "Troca de óleo e filtros", parts: 42000, labor: 12000, workshop: "Toyota Paulista", nextKm: 18000 },
        { car: "compass", type: "TIRES" as const, status: "DONE" as const, when: at(-45), service: "Troca dos 4 pneus e alinhamento", parts: 380000, labor: 18000, workshop: "Pneus Center", nextKm: null },
        { car: "creta", type: "BODYWORK" as const, status: "DONE" as const, when: at(-60), service: "Reparo do para-choque traseiro", parts: 45000, labor: 40000, workshop: "Funilaria Ipiranga", nextKm: null },
        { car: "kwid", type: "PREVENTIVE" as const, status: "DONE" as const, when: at(-90), service: "Revisão preventiva 40.000 km", parts: 51000, labor: 25000, workshop: "Renault Campinas", nextKm: 50000 },
        { car: "hilux", type: "OIL" as const, status: "DONE" as const, when: at(-33), service: "Troca de óleo diesel e filtro de combustível", parts: 69000, labor: 15000, workshop: "Toyota Congonhas", nextKm: 35000 },
        { car: "bmw", type: "AIR_CONDITIONING" as const, status: "DONE" as const, when: at(-12), service: "Higienização do ar-condicionado", parts: 9000, labor: 12000, workshop: "BMW Ibirapuera", nextKm: null },
        { car: "pulse", type: "OTHER" as const, status: "DONE" as const, when: at(0), service: "Lavagem completa e higienização interna", parts: 0, labor: 12000, workshop: "Lava-rápido da loja", nextKm: null },
      ];
      for (const m of maint) {
        const v = car[m.car]!;
        const total = m.parts + m.labor;
        const [row] = await tx
          .insert(maintenance)
          .values({ companyId, vehicleId: v.id, type: m.type, status: m.status, performedAt: m.status === "SCHEDULED" ? null : m.when, km: v.km, workshop: m.workshop, service: m.service, partsCents: m.parts, laborCents: m.labor, totalCents: total, nextDate: m.type === "OIL" || m.type === "PREVENTIVE" ? dateOnly(new Date(m.when.getTime() + 180 * DAY)) : null, nextKm: m.nextKm, createdBy: staff.operador, createdAt: new Date(Math.min(m.when.getTime(), now.getTime())) })
          .returning();
        if (m.parts) await tx.insert(maintenanceItems).values({ companyId, maintenanceId: row!.id, kind: "PART", description: m.service, quantity: 1, unitCents: m.parts });
        if (m.labor) await tx.insert(maintenanceItems).values({ companyId, maintenanceId: row!.id, kind: "LABOR", description: "Mão de obra", quantity: 1, unitCents: m.labor });
        if (m.status !== "SCHEDULED") {
          await event(tx, v.id, m.type === "OIL" ? "OIL" : m.type === "TIRES" ? "TIRES" : m.type === "BODYWORK" ? "REPAIR" : "MAINTENANCE", m.when, `${m.service} · ${m.workshop}`, "maintenance", { km: v.km, amountCents: total, refTable: "maintenance", refId: row!.id });
          if (total && m.status === "DONE") await ledger(tx, { direction: "EXPENSE", category: "MAINTENANCE", amount: total, when: m.when, account: cash!.id, vehicleId: v.id, description: `${m.service} · ${v.brand} ${v.model}` });
        }
      }
      await tx.insert(damages).values({ companyId, vehicleId: car.onix!.id, isPreExisting: true, location: "Porta dianteira direita", description: "Risco leve de 5 cm (já registrado na entrada).", severity: "LOW", estimatedCostCents: 25000, createdBy: staff.operador });

      // Multas
      const lucasRental = (await tx.select({ id: rentals.id }).from(rentals).where(eq(rentals.customerId, cust.lucas!.id)).limit(1))[0];
      await tx.insert(fines).values([
        { companyId, vehicleId: car.creta!.id, rentalId: lucasRental?.id, driverId: cust.lucas!.driverId, infractionAt: at(-40, 16), place: "Marginal Tietê, km 12", infractionCode: "745-50", description: "Transitar em velocidade superior à máxima permitida em até 20%", amountCents: 13016, status: "CHARGED", responsibility: "CUSTOMER", createdBy: staff.operador },
        { companyId, vehicleId: car.compass!.id, infractionAt: at(-8, 11), place: "Av. Brigadeiro Faria Lima, 2000", infractionCode: "518-51", description: "Estacionar em local proibido", amountCents: 19523, status: "RECEIVED", responsibility: "UNDEFINED", createdBy: staff.operador },
        { companyId, vehicleId: car.civic!.id, driverId: cust.gabriel!.driverId, infractionAt: at(-70, 9), place: "Rod. dos Bandeirantes, km 48", infractionCode: "605-03", description: "Avançar o sinal vermelho do semáforo", amountCents: 29347, status: "PAID", responsibility: "CUSTOMER", paidAt: at(-50), createdBy: staff.operador },
      ]);
      await event(tx, car.compass!.id, "FINE", at(-8, 11), "Multa recebida: estacionar em local proibido (R$ 195,23)", "fines", {});
      await ledger(tx, { direction: "INCOME", category: "FINE", amount: 29347, when: at(-50), account: gateway!.id, vehicleId: car.civic!.id, customerId: cust.gabriel!.id, description: "Repasse de multa ao cliente" });

      // Ocorrências
      await tx.insert(occurrences).values([
        { companyId, vehicleId: car.onix!.id, kind: "BREAKDOWN", occurredAt: at(-2, 8), place: "Av. Rebouças, 1200", description: "Barulho ao frear relatado pelo cliente; veículo recolhido para a oficina.", costCents: 130000, responsibleUserId: staff.operador, status: "IN_PROGRESS", createdBy: staff.operador },
        { companyId, vehicleId: car.creta!.id, customerId: cust.lucas!.id, driverId: cust.lucas!.driverId, kind: "COLLISION", occurredAt: at(-64, 19), place: "Estacionamento do Shopping Ibirapuera", description: "Colisão leve em manobra, para-choque traseiro amassado. Sem feridos.", costCents: 85000, responsibleUserId: staff.gerente, status: "CLOSED", createdBy: staff.operador },
        { companyId, vehicleId: car.strada!.id, kind: "THEFT_SUSPECTED", occurredAt: at(0, 3), place: "Rod. Anchieta, km 40", description: "Veículo saiu da área permitida de madrugada, fora de locação. Bloqueio remoto confirmado.", responsibleUserId: staff.gerente, status: "OPEN", createdBy: staff.gerente },
      ]);

      // Rastreamento e Foccus Security
      const [fence] = await tx
        .insert(geofences)
        .values({ companyId, name: "Grande São Paulo e Campinas", kind: "ALLOWED", alertOnExit: true, geometry: { type: "Polygon", coordinates: [[[-47.3, -22.7], [-46.2, -22.7], [-46.2, -23.9], [-47.3, -23.9], [-47.3, -22.7]]] } })
        .returning();
      const device: Record<string, string> = {};
      for (const c of FLEET) {
        const [lat, lng] = POSITIONS[c.key]!;
        const lost = c.key === "kwid";
        const [d] = await tx
          .insert(gpsDevices)
          .values({ companyId, vehicleId: car[c.key]!.id, provider: "demo-tracker", externalId: `TRK-${c.plate}`, imei: `35${between(1000000000000, 9999999999999)}`, model: "Rastreador 4G com bloqueio", supportsRemoteBlock: true, supportsIgnition: true, lastCommunicationAt: lost ? at(-2, 14) : new Date(now.getTime() - between(1, 9) * 60_000) })
          .returning();
        device[c.key] = d!.id;
        const moving = c.status === "RENTED";
        const trail = moving ? 12 : 1;
        const pts = [];
        for (let i = trail - 1; i >= 0; i--)
          pts.push({ companyId, deviceId: d!.id, vehicleId: car[c.key]!.id, recordedAt: new Date((lost ? at(-2, 14) : now).getTime() - i * 5 * 60_000), latitude: lat + (moving ? i * 0.0021 : 0), longitude: lng + (moving ? i * 0.0017 : 0), speedKmh: moving && i > 0 ? between(25, 85) : 0, heading: moving ? 215 : 0, ignition: moving && i > 0 });
        await tx.insert(gpsPositions).values(pts);
      }
      const [exitAlert] = await tx
        .insert(securityAlerts)
        .values([
          { companyId, vehicleId: car.strada!.id, deviceId: device.strada, geofenceId: fence!.id, type: "GEOFENCE_EXIT", status: "ANALYZING", severity: "CRITICAL", occurredAt: at(0, 3), latitude: -24.0058, longitude: -46.4028, assignedTo: staff.gerente },
          { companyId, vehicleId: car.kwid!.id, deviceId: device.kwid, type: "COMMUNICATION_LOST", status: "NEW", severity: "MEDIUM", occurredAt: at(-2, 14), latitude: -22.9056, longitude: -47.0608 },
          { companyId, vehicleId: car.pulse!.id, deviceId: device.pulse, type: "OFF_HOURS_MOVEMENT", status: "RESOLVED", severity: "LOW", occurredAt: at(-6, 23), assignedTo: staff.operador, resolvedAt: at(-5, 9), resolution: "Manobrista levando o carro para a lavagem. Confirmado com a loja." },
          { companyId, vehicleId: car.creta!.id, deviceId: device.creta, type: "IGNITION", status: "IGNORED", severity: "LOW", occurredAt: at(-1, 6), resolution: "Cliente em locação ativa." },
        ])
        .returning();
      await tx.insert(telematicsCommands).values({ companyId, vehicleId: car.strada!.id, deviceId: device.strada!, command: "BLOCK", status: "CONFIRMED", reason: "Saída da área permitida de madrugada, sem locação ativa.", requestedBy: staff.gerente, confirmedBy: staff.admin, securityAlertId: exitAlert!.id, vehicleStateAtRequest: { speedKmh: 0, ignition: false }, providerRequestId: "CMD-DEMO-0001", providerResponse: { result: "BLOCKED" }, sentAt: at(0, 3), resultAt: at(0, 3) });
      await event(tx, car.strada!.id, "BLOCK", at(0, 3), "Bloqueio remoto confirmado pelo rastreador (veículo parado)", "gps", {});

      // Despesas fixas mensais (para os gráficos do financeiro)
      for (let m = 5; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 5, 12);
        if (d > now) continue;
        await ledger(tx, { direction: "EXPENSE", category: "INSURANCE", amount: 598000, when: d, account: cash!.id, description: "Seguro da frota (parcela mensal)" });
        await ledger(tx, { direction: "EXPENSE", category: "OPERATION", amount: 780000, when: new Date(d.getTime() + 5 * DAY), account: cash!.id, description: "Folha da equipe e aluguel das lojas" });
        await ledger(tx, { direction: "EXPENSE", category: "OPERATION", amount: 89000, when: new Date(d.getTime() + 10 * DAY), account: cash!.id, description: "Rastreamento, sistemas e internet" });
      }
      await ledger(tx, { direction: "EXPENSE", category: "DOCUMENTATION", amount: 1854000, when: at(-250), account: cash!.id, description: "IPVA 2026 da frota (cota única com desconto)" });
      await ledger(tx, { direction: "INCOME", category: "EXTRA_DAY", amount: car.creta!.daily * 2, when: at(1), account: gateway!.id, customerId: cust.lucas!.id, description: "Diárias extras a receber · atraso na devolução", status: "PENDING" });

      // Favoritos e notificações
      await tx.insert(favorites).values([{ companyId, vehicleId: car.bmw!.id, userId: uid("mariana") }, { companyId, vehicleId: car.seal!.id, userId: uid("mariana") }]);
      const note = (userId: string, topic: string, title: string, body: string, link: string, daysAgo: number, read: boolean) => ({ companyId, userId, topic, title, body, link, channel: "IN_APP" as const, status: read ? ("READ" as const) : ("DELIVERED" as const), sentAt: at(-daysAgo), readAt: read ? at(-daysAgo, 12) : null, createdAt: at(-daysAgo) });
      await tx.insert(notifications).values([
        note(uid("mariana"), "reservation", "Reserva confirmada", "Sua reserva do Jeep Compass foi confirmada. Retirada na Loja Paulista.", "/conta/reservas", 1, false),
        note(uid("mariana"), "rental", "Boa viagem!", "Sua locação do Toyota Corolla começou. Devolução prevista em 4 dias.", "/conta/locacoes", 3, true),
        note(uid("mariana"), "account", "Cadastro aprovado", "Seu cadastro foi aprovado. Você já pode reservar veículos.", "/conta", 40, true),
        note(uid("beatriz"), "documents", "Documento recusado", "Sua selfie foi recusada: a foto ficou escura. Envie uma nova.", "/cadastro", 2, false),
        note(uid("carlos"), "wallet", "Nova venda!", "Fernanda Souza reservou o Volvo EX30 pela sua oferta.", "/representante/carteira", 2, false),
        note(uid("carlos"), "wallet", "Saque pago", "Seu saque de R$ 600,00 via Pix foi pago.", "/representante/saques", 24, true),
        note(staff.admin, "security", "Alerta crítico", "Fiat Strada saiu da área permitida às 03:00. Bloqueio confirmado.", "/admin/seguranca", 0, false),
        note(staff.admin, "customers", "Cadastros aguardando análise", "2 clientes enviaram documentos para análise.", "/admin/cadastros", 1, false),
        note(staff.admin, "fleet", "Documento vencendo", "CRLV do Renault Kwid vence em 12 dias.", "/admin/documentos", 1, true),
      ]);

      // Auditoria (amostra do que o sistema registra)
      const log = (actor: string, action: string, entity: string, entityId: string, daysAgo: number, oldValue: unknown, newValue: unknown) => ({ companyId, actorUserId: actor, action, entity, entityId, oldValue, newValue, origin: "web", ip: "189.40.10.20", userAgent: "Mozilla/5.0 (demo)", createdAt: at(-daysAgo, 11) });
      await tx.insert(auditLogs).values([
        log(staff.operador, "customer.account.approve", "users", uid("mariana"), 40, { status: "UNDER_REVIEW" }, { status: "ACTIVE" }),
        log(staff.operador, "customer.document.rejected", "customer_documents", cust.beatriz!.id, 2, { status: "UNDER_REVIEW" }, { status: "REJECTED", reason: "Selfie escura" }),
        log(staff.gerente, "customer.account.block", "users", uid("diego"), 15, { status: "ACTIVE" }, { status: "BLOCKED" }),
        log(staff.admin, "vehicle.update.price", "vehicles", car.bmw!.id, 20, { dailyRateCents: 49900 }, { dailyRateCents: 54900 }),
        log(staff.gerente, "telematics.block", "vehicles", car.strada!.id, 0, { blocked: false }, { blocked: true }),
        log(staff.admin, "users.role.grant", "users", staff.financeiro, 90, null, { role: "FINANCEIRO" }),
        log(staff.financeiro, "withdrawal.pay", "withdrawal_requests", paidWd!.id, 24, { status: "APPROVED" }, { status: "PAID" }),
        log(staff.operador, "vehicle.status", "vehicles", car.onix!.id, 1, { status: "AVAILABLE" }, { status: "MAINTENANCE" }),
      ]);
    });

    // Arquivos dos documentos (fora da transação: storage externo).
    for (const u of pendingUploads) await storage.put(u.key, new Uint8Array(u.bytes), u.type);

    console.log(`Demonstração instalada na empresa ${company.name}. Senha dos usuários de teste: ${DEMO_PASSWORD}`);
    for (const l of DEMO_LOGINS) console.log(`  ${l.email.padEnd(40)} ${l.roles.join(" + ")} (${l.status})`);
    return { created: true };
  } finally {
    await db.$client.end();
  }
}

// ── Auxiliares ─────────────────────────────────────────────────────────────

let damagedOnce = false;
let companyIdForHelpers = "";

function readAsset(name: string) {
  return readFileSync(fileURLToPath(new URL(`./assets/${name}`, import.meta.url)));
}

const CAR_COLORS: [RegExp, string][] = [
  [/grafite|chumbo/i, "grafite"], [/prata|cinza/i, "prata"], [/branc/i, "branco"], [/azul/i, "azul"], [/vermelh/i, "vermelho"],
  [/dourad|champanhe|bege/i, "dourado"], [/verde/i, "verde"], [/laranja/i, "laranja"], [/pret/i, "preto"],
];

function carImage(color: string) {
  const name = CAR_COLORS.find(([re]) => re.test(color))?.[1] ?? "preto";
  return readFileSync(fileURLToPath(new URL(`../../../../apps/web/public/brand/cars/${name}.webp`, import.meta.url)));
}

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]!;
}

function nameOf(key: string) {
  return PEOPLE.find((p) => p.key === key)?.name ?? key;
}

async function marginOf(tx: Tx, listingId: string) {
  const [l] = await tx.select({ m: representativeListings.marginCents }).from(representativeListings).where(eq(representativeListings.id, listingId));
  return l?.m ?? 0;
}

async function companyOf(_tx: Tx) {
  return companyIdForHelpers;
}

async function event(
  tx: Tx, vehicleId: string, type: (typeof vehicleEvents.$inferInsert)["type"], occurredAt: Date, description: string, source: string,
  extra: { km?: number; amountCents?: number; refTable?: string; refId?: string; actor?: string },
) {
  await tx.insert(vehicleEvents).values({ companyId: await companyOf(tx), vehicleId, type, occurredAt, description, source, km: extra.km, amountCents: extra.amountCents, refTable: extra.refTable, refId: extra.refId, actorUserId: extra.actor, createdAt: occurredAt });
}

async function ledger(
  tx: Tx,
  e: {
    direction: "INCOME" | "EXPENSE"; category: (typeof financialTransactions.$inferInsert)["category"]; amount: Money; when: Date; account?: string;
    vehicleId?: string; customerId?: string; reservationId?: string; rentalId?: string; paymentId?: string; description: string; status?: "PENDING" | "CONFIRMED";
  },
) {
  const status = e.status ?? (e.when > now ? "PENDING" : "CONFIRMED");
  await tx.insert(financialTransactions).values({
    companyId: await companyOf(tx), direction: e.direction, category: e.category, status, amountCents: e.amount, competenceDate: dateOnly(e.when),
    settledAt: status === "CONFIRMED" ? e.when : null, financialAccountId: e.account, vehicleId: e.vehicleId, customerId: e.customerId,
    reservationId: e.reservationId, rentalId: e.rentalId, paymentId: e.paymentId, description: e.description, createdAt: e.when,
  });
}

async function checklist(
  tx: Tx,
  c: { rentalId: string; vehicleId: string; type: "CHECKOUT" | "RETURN"; when: Date; km: number; fuel: "FULL" | "HALF"; by: string; damageItem?: string },
) {
  const companyId = await companyOf(tx);
  const [row] = await tx
    .insert(checklists)
    .values({ companyId, rentalId: c.rentalId, vehicleId: c.vehicleId, type: c.type, performedAt: c.when, performedBy: c.by, km: c.km, fuel: c.fuel, generalCondition: c.damageItem ? "Avaria nova no para-choque traseiro." : "Veículo limpo e sem avarias novas.", completedAt: c.when, clientMutationId: randomUUID(), createdAt: c.when })
    .returning({ id: checklists.id });
  await tx.insert(checklistItems).values(
    CHECKLIST_ITEMS.map((item) => ({ companyId, checklistId: row!.id, item, result: item === c.damageItem ? ("DAMAGE" as const) : ("OK" as const), note: item === c.damageItem ? "Amassado de 12 cm" : null })),
  );
  return row!.id;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
