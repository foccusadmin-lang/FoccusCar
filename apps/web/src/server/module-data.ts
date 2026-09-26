import "server-only";
import type { AccessContext } from "@foccus/core";
import { maskCpf } from "@foccus/core";
import { withTenant, type Tx } from "@foccus/db";
import { sql, type SQL } from "drizzle-orm";
import type { Tone } from "@/components/ui/Badge";
import { ACCOUNT_STATUS_LABEL, formatCents, formatDate, VEHICLE_STATUS_LABEL } from "@/lib/format";
import type { ModuleKey } from "@/lib/modules";
import { STAFF_NAV } from "@/lib/navigation";
import { vehicleImage } from "@/lib/vehicle-image";
import { getAccess } from "./auth";
import { db } from "./db";

/**
 * Consulta dos módulos que ainda não têm tela própria: mostra os registros reais da empresa
 * (somente leitura) no formato da tela-esqueleto. Quando o módulo for implementado na sua etapa,
 * a página deixa de usar isto. Tudo roda com o tenant fixado (RLS) e respeita o perfil:
 * cliente vê só o que é dele, representante só a própria carteira, equipe conforme a permissão do menu.
 */

export type Cell = string | { text: string; tone?: Tone; sub?: string; href?: string };
export interface ModuleData {
  stats?: { label: string; value: string; hint?: string; gold?: boolean }[];
  bars?: { title: string; items: { label: string; value: number; display: string }[] };
  table?: { title?: string; columns: string[]; rows: Cell[][] };
  cards?: { title: string; subtitle?: string; image?: string; badge?: { text: string; tone: Tone }; lines: string[]; href?: string }[];
  list?: { title: string; subtitle?: string; badge?: { text: string; tone: Tone }; href?: string }[];
  map?: { points: { label: string; lat: number; lng: number; tone: Tone; status: string; seen: string }[] };
  empty?: string;
}

type Row = Record<string, unknown>;
const q = async <T extends Row = Row>(tx: Tx, query: SQL) => (await tx.execute(query)) as unknown as T[];
const n = (v: unknown) => Number(v ?? 0);
const d = (v: unknown) => (v ? formatDate(v as Date) : "—");
const money = (v: unknown) => formatCents(n(v));
const dt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dateTime = (v: unknown) => (v ? dt.format(new Date(v as string)) : "—");
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

const S = (map: Record<string, [string, Tone]>) => (status: unknown) => {
  const [text, tone] = map[String(status)] ?? [String(status), "neutral"];
  return { text, tone };
};
const reservationStatus = S({ DRAFT: ["Rascunho", "neutral"], PENDING_PAYMENT: ["Aguardando pagamento", "warning"], CONFIRMED: ["Confirmada", "success"], CANCELLED: ["Cancelada", "danger"], EXPIRED: ["Expirada", "neutral"], CONVERTED: ["Virou locação", "info"] });
const rentalStatus = S({ SCHEDULED: ["Agendada", "info"], CHECKOUT_IN_PROGRESS: ["Em retirada", "warning"], ACTIVE: ["Em andamento", "gold"], RETURN_IN_PROGRESS: ["Em devolução", "warning"], PENDING_SETTLEMENT: ["Acerto pendente", "warning"], CLOSED: ["Encerrada", "success"], CANCELLED: ["Cancelada", "danger"] });
const paymentStatus = S({ PENDING: ["Pendente", "warning"], PROCESSING: ["Processando", "info"], APPROVED: ["Aprovado", "success"], REJECTED: ["Recusado", "danger"], CANCELLED: ["Cancelado", "neutral"], EXPIRED: ["Expirado", "neutral"], REFUNDED: ["Estornado", "info"], PARTIALLY_REFUNDED: ["Estorno parcial", "info"], CHARGEBACK: ["Contestação", "danger"], FAILED: ["Falhou", "danger"] });
const documentStatus = S({ PENDING: ["Pendente", "warning"], UNDER_REVIEW: ["Em análise", "info"], APPROVED: ["Aprovado", "success"], REJECTED: ["Recusado", "danger"], EXPIRED: ["Vencido", "danger"] });
const contractStatus = S({ DRAFT: ["Rascunho", "neutral"], ISSUED: ["Aguardando assinatura", "warning"], SIGNED: ["Assinado", "success"], CANCELLED: ["Cancelado", "neutral"] });
const maintenanceStatus = S({ SCHEDULED: ["Agendada", "info"], IN_PROGRESS: ["Em andamento", "warning"], DONE: ["Concluída", "success"], CANCELLED: ["Cancelada", "neutral"] });
const fineStatus = S({ RECEIVED: ["Recebida", "warning"], DRIVER_IDENTIFIED: ["Condutor indicado", "info"], CHARGED: ["Cobrada do cliente", "gold"], PAID: ["Paga", "success"], CONTESTED: ["Em recurso", "info"], CANCELLED: ["Cancelada", "neutral"] });
const occurrenceStatus = S({ OPEN: ["Aberta", "danger"], IN_PROGRESS: ["Em andamento", "warning"], RESOLVED: ["Resolvida", "success"], CLOSED: ["Encerrada", "neutral"] });
const alertStatus = S({ NEW: ["Novo", "danger"], ANALYZING: ["Em análise", "warning"], RESOLVED: ["Resolvido", "success"], IGNORED: ["Ignorado", "neutral"] });
const withdrawalStatus = S({ REQUESTED: ["Solicitado", "warning"], REVIEW: ["Em análise", "info"], APPROVED: ["Aprovado", "info"], PROCESSING: ["Processando", "info"], PAID: ["Pago", "success"], REJECTED: ["Recusado", "danger"] });
const walletStatus = S({ PENDING: ["Pendente", "warning"], AVAILABLE: ["Disponível", "success"], WITHDRAWN: ["Sacado", "info"], REVERSED: ["Estornado", "danger"] });
const accountStatus = (s: unknown) => ({ text: ACCOUNT_STATUS_LABEL[String(s)] ?? String(s), tone: (({ ACTIVE: "success", UNDER_REVIEW: "info", BLOCKED: "danger", SUSPENDED: "danger" }) as Record<string, Tone>)[String(s)] ?? "warning" });
const vehicleTone: Record<string, Tone> = { AVAILABLE: "success", RESERVED: "info", RENTED: "gold", MAINTENANCE: "warning", CLEANING: "info", INSPECTION: "info", BLOCKED: "danger", INACTIVE: "neutral" };
const METHOD: Record<string, string> = { PIX: "Pix", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito", CHECKOUT_LINK: "Link de pagamento" };
const PURPOSE: Record<string, string> = { RESERVATION: "Reserva", RENTAL: "Locação", DEPOSIT: "Caução", EXTRA_CHARGES: "Encargos", FINE: "Multa" };
const DOC_LABEL: Record<string, string> = { CNH_FRONT: "CNH (frente)", CNH_BACK: "CNH (verso)", RG: "RG", PROOF_OF_ADDRESS: "Comprovante de residência", SELFIE: "Selfie", OTHER: "Outro documento" };
const ALERT_LABEL: Record<string, string> = { GEOFENCE_EXIT: "Saiu da área permitida", GEOFENCE_ENTRY_FORBIDDEN: "Entrou em área proibida", COMMUNICATION_LOST: "Sem comunicação", UNEXPECTED_MOVEMENT: "Movimento inesperado", IGNITION: "Ignição ligada", OFF_HOURS_MOVEMENT: "Movimento fora do horário", TAMPER: "Violação do rastreador" };
const OCCURRENCE_LABEL: Record<string, string> = { BREAKDOWN: "Pane", COLLISION: "Colisão", THEFT_SUSPECTED: "Suspeita de furto", THEFT: "Furto", ACCIDENT: "Acidente" };
const CATEGORY_LABEL: Record<string, string> = { RENTAL: "Locações", DEPOSIT: "Cauções", FUEL: "Combustível", DAMAGE: "Avarias", EXTRA_KM: "KM extra", FINE: "Multas", EXTRA_DAY: "Diárias extras", LATE_FEE: "Atraso", CLEANING: "Limpeza", LOST_ITEM: "Itens perdidos", FEE: "Taxas do gateway", MAINTENANCE: "Manutenção", INSURANCE: "Seguro", DOCUMENTATION: "Documentação", OPERATION: "Operação", REPRESENTATIVE_MARGIN: "Representantes", REFUND: "Estornos", ADJUSTMENT: "Ajustes", OTHER: "Outros" };
const car = (r: Row) => `${r.brand} ${r.model}`;
const period = (r: Row, a = "pickup_at", b = "return_at") => `${d(r[a])} a ${d(r[b])}`;

/** Últimos 6 meses de um valor agregado por mês (para o gráfico de barras). */
function lastMonths(rows: Row[], key = "total") {
  const out: { label: string; value: number; display: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = m.toISOString().slice(0, 7);
    const v = n(rows.find((r) => r.ym === ym)?.[key]);
    out.push({ label: monthFmt.format(m).replace(".", ""), value: v, display: formatCents(v) });
  }
  return out;
}

/** Permissão que a equipe precisa para ver o módulo (a mesma do item de menu). */
function staffPermission(key: ModuleKey) {
  const href = `/${key}`;
  return STAFF_NAV.groups.flatMap((g) => g.items).find((i) => i.href === href)?.permission;
}

export async function getModuleData(key: ModuleKey): Promise<ModuleData | "denied" | null> {
  const ctx = await getAccess();
  if (!ctx) return null;
  if (key.startsWith("admin")) {
    const perm = staffPermission(key);
    if (perm && !ctx.permissions.has(perm)) return "denied";
  }
  const loader = LOADERS[key];
  if (!loader) return null;
  return withTenant(db, { companyId: ctx.companyId, userId: ctx.userId }, (tx) => loader(tx, ctx));
}

type Loader = (tx: Tx, ctx: AccessContext) => Promise<ModuleData>;

async function myCustomerId(tx: Tx, ctx: AccessContext) {
  const [c] = await q<{ id: string }>(tx, sql`select id from customers where user_id = ${ctx.userId} and deleted_at is null limit 1`);
  return c?.id ?? "00000000-0000-0000-0000-000000000000";
}
async function myRep(tx: Tx, ctx: AccessContext) {
  const [r] = await q<{ id: string; wallet_id: string; display_name: string; document: string; max_margin_cents: number; status: string; created_at: Date }>(
    tx, sql`select r.*, w.id as wallet_id from representatives r left join wallets w on w.representative_id = r.id where r.user_id = ${ctx.userId} and r.deleted_at is null limit 1`);
  return r;
}
const NONE = "00000000-0000-0000-0000-000000000000";

const LOADERS: Partial<Record<ModuleKey, Loader>> = {
  // ── Cliente ──────────────────────────────────────────────
  "conta/reservas": async (tx, ctx) => {
    const cid = await myCustomerId(tx, ctx);
    const rows = await q(tx, sql`select r.*, v.brand, v.model, v.color, l.name as loc from reservations r join vehicles v on v.id = r.vehicle_id left join locations l on l.id = r.pickup_location_id where r.customer_id = ${cid} and r.deleted_at is null order by r.pickup_at desc limit 30`);
    return {
      empty: "Você ainda não tem reservas.",
      cards: rows.map((r) => ({ title: car(r), subtitle: `Reserva ${r.code}`, image: vehicleImage(null, r.color as string), badge: reservationStatus(r.status), lines: [`Retirada ${dateTime(r.pickup_at)} · ${r.loc ?? ""}`, `Devolução ${dateTime(r.return_at)}`, `Total ${money(r.total_cents)} · caução ${money(r.deposit_cents)}`] })),
    };
  },
  "conta/locacoes": async (tx, ctx) => {
    const cid = await myCustomerId(tx, ctx);
    const rows = await q(tx, sql`select r.*, v.brand, v.model, v.color, v.plate from rentals r join vehicles v on v.id = r.vehicle_id where r.customer_id = ${cid} and r.deleted_at is null order by r.start_at desc limit 30`);
    return {
      empty: "Você ainda não tem locações.",
      cards: rows.map((r) => ({ title: car(r), subtitle: `Locação ${r.code} · placa ${r.plate}`, image: vehicleImage(null, r.color as string), badge: rentalStatus(r.status), lines: [period(r, "start_at", "expected_return_at"), r.km_in ? `${n(r.km_in) - n(r.km_out)} km rodados` : `Saiu com ${n(r.km_out).toLocaleString("pt-BR")} km`, `Valor ${money(r.amount_cents)}`] })),
    };
  },
  "conta/pagamentos": async (tx, ctx) => {
    const cid = await myCustomerId(tx, ctx);
    const rows = await q(tx, sql`select p.*, r.code from payments p left join reservations r on r.id = p.reservation_id where p.customer_id = ${cid} order by p.created_at desc limit 50`);
    return { empty: "Nenhum pagamento ainda.", table: { columns: ["Data", "Referência", "Método", "Valor", "Status"], rows: rows.map((p) => [d(p.created_at), `${PURPOSE[String(p.purpose)] ?? p.purpose} ${p.code ?? ""}`, METHOD[String(p.method)] ?? String(p.method), money(p.amount_cents), paymentStatus(p.status)]) } };
  },
  "conta/documentos": async (tx, ctx) => {
    const cid = await myCustomerId(tx, ctx);
    const rows = await q(tx, sql`select distinct on (type) * from customer_documents where customer_id = ${cid} and deleted_at is null order by type, submitted_at desc`);
    return { empty: "Nenhum documento enviado ainda.", list: rows.map((r) => ({ title: DOC_LABEL[String(r.type)] ?? String(r.type), subtitle: r.rejection_reason ? `Motivo: ${r.rejection_reason}` : `Enviado em ${d(r.submitted_at)}`, badge: documentStatus(r.status) })) };
  },
  "conta/contratos": async (tx, ctx) => {
    const cid = await myCustomerId(tx, ctx);
    const rows = await q(tx, sql`select c.*, v.brand, v.model from contracts c join reservations r on r.id = c.reservation_id join vehicles v on v.id = r.vehicle_id where r.customer_id = ${cid} order by c.issued_at desc limit 30`);
    return { empty: "Nenhum contrato ainda.", list: rows.map((c) => ({ title: `Contrato ${c.number} · ${car(c)}`, subtitle: c.signed_at ? `Assinado em ${d(c.signed_at)}` : `Emitido em ${d(c.issued_at)}`, badge: contractStatus(c.status) })) };
  },
  "conta/notificacoes": async (tx, ctx) => {
    const rows = await q(tx, sql`select * from notifications where user_id = ${ctx.userId} order by created_at desc limit 50`);
    return { empty: "Nenhuma notificação.", list: rows.map((r) => ({ title: String(r.title), subtitle: `${r.body} · ${dateTime(r.created_at)}`, badge: r.read_at ? { text: "Lida", tone: "neutral" as Tone } : { text: "Nova", tone: "gold" as Tone }, href: (r.link as string) ?? undefined })) };
  },

  // ── Representante ────────────────────────────────────────
  representante: async (tx, ctx) => {
    const rep = await myRep(tx, ctx);
    const id = rep?.id ?? NONE;
    const [s] = await q(tx, sql`select count(*) filter (where r.created_at >= date_trunc('month', now())) as month, count(*) as total, coalesce(sum(r.representative_margin_cents) filter (where r.status <> 'CANCELLED'), 0) as earned from reservations r join representative_listings l on l.id = r.representative_listing_id where l.representative_id = ${id}`);
    const [w] = await q(tx, sql`select * from wallets where representative_id = ${id}`);
    const months = await q(tx, sql`select to_char(r.created_at, 'YYYY-MM') as ym, sum(r.representative_margin_cents) as total from reservations r join representative_listings l on l.id = r.representative_listing_id where l.representative_id = ${id} and r.status <> 'CANCELLED' group by 1`);
    return {
      stats: [{ label: "Vendas no mês", value: String(n(s?.month)) }, { label: "Reservas no total", value: String(n(s?.total)) }, { label: "Ganhos", value: money(s?.earned) }, { label: "Saldo disponível", value: money(w?.available_cents), gold: true }],
      bars: { title: "Ganhos por mês", items: lastMonths(months) },
    };
  },
  "representante/veiculos": async (tx) => {
    const rows = await q(tx, sql`select v.*, c.name as category from vehicles v left join vehicle_categories c on c.id = v.category_id where v.showcase_visible and v.deleted_at is null order by v.daily_rate_cents desc`);
    return { cards: rows.map((v) => ({ title: `${car(v)} ${v.version ?? ""}`, subtitle: `${v.category ?? ""} · ${v.model_year}`, image: vehicleImage(null, v.color as string), badge: { text: VEHICLE_STATUS_LABEL[String(v.status)] ?? String(v.status), tone: vehicleTone[String(v.status)] ?? "neutral" }, lines: [`Diária oficial ${money(v.daily_rate_cents)}`, `Semanal ${money(v.weekly_rate_cents)} · mensal ${money(v.monthly_rate_cents)}`], href: `/veiculos/${v.id}` })) };
  },
  "representante/ofertas": async (tx, ctx) => {
    const rep = await myRep(tx, ctx);
    const rows = await q(tx, sql`select l.*, v.brand, v.model, v.daily_rate_cents from representative_listings l join vehicles v on v.id = l.vehicle_id where l.representative_id = ${rep?.id ?? NONE} and l.deleted_at is null order by l.created_at desc`);
    return { empty: "Você ainda não publicou ofertas.", table: { columns: ["Veículo", "Preço oficial", "Margem", "Preço cliente", "Status"], rows: rows.map((l) => [{ text: car(l), sub: `/${l.slug}` }, money(l.daily_rate_cents), money(l.margin_cents), money(n(l.daily_rate_cents) + n(l.margin_cents)), l.active ? { text: "Ativa", tone: "success" } : { text: "Pausada", tone: "neutral" }]) } };
  },
  "representante/clientes": async (tx, ctx) => {
    const rep = await myRep(tx, ctx);
    const rows = await q(tx, sql`select c.full_name, count(distinct r.id) as res, count(distinct rt.id) as rent, max(r.created_at) as last from reservations r join representative_listings l on l.id = r.representative_listing_id join customers c on c.id = r.customer_id left join rentals rt on rt.reservation_id = r.id where l.representative_id = ${rep?.id ?? NONE} group by c.full_name order by last desc`);
    return { empty: "Nenhum cliente comprou pelas suas ofertas ainda.", table: { columns: ["Cliente", "Reservas", "Locações", "Última compra"], rows: rows.map((r) => [String(r.full_name), String(n(r.res)), String(n(r.rent)), d(r.last)]) } };
  },
  "representante/reservas": async (tx, ctx) => {
    const rep = await myRep(tx, ctx);
    const rows = await q(tx, sql`select r.*, c.full_name, v.brand, v.model from reservations r join representative_listings l on l.id = r.representative_listing_id join customers c on c.id = r.customer_id join vehicles v on v.id = r.vehicle_id where l.representative_id = ${rep?.id ?? NONE} order by r.pickup_at desc limit 50`);
    return { empty: "Nenhuma reserva pelas suas ofertas ainda.", table: { columns: ["Reserva", "Cliente", "Veículo", "Período", "Sua margem", "Status"], rows: rows.map((r) => [String(r.code), String(r.full_name), car(r), period(r), money(r.representative_margin_cents), reservationStatus(r.status)]) } };
  },
  "representante/locacoes": async (tx, ctx) => {
    const rep = await myRep(tx, ctx);
    const rows = await q(tx, sql`select rt.*, c.full_name, v.brand, v.model from rentals rt join reservations r on r.id = rt.reservation_id join representative_listings l on l.id = r.representative_listing_id join customers c on c.id = rt.customer_id join vehicles v on v.id = rt.vehicle_id where l.representative_id = ${rep?.id ?? NONE} order by rt.start_at desc limit 50`);
    return { empty: "Nenhuma locação pelas suas ofertas ainda.", table: { columns: ["Locação", "Cliente", "Veículo", "Período", "Status"], rows: rows.map((r) => [String(r.code), String(r.full_name), car(r), period(r, "start_at", "expected_return_at"), rentalStatus(r.status)]) } };
  },
  "representante/ganhos": async (tx, ctx) => walletView(tx, ctx, "ganhos"),
  "representante/carteira": async (tx, ctx) => walletView(tx, ctx, "carteira"),
  "representante/saques": async (tx, ctx) => {
    const rep = await myRep(tx, ctx);
    const rows = await q(tx, sql`select * from withdrawal_requests where wallet_id = ${rep?.wallet_id ?? NONE} order by created_at desc`);
    return { empty: "Nenhum saque solicitado.", table: { columns: ["Solicitado em", "Valor", "Conta", "Status"], rows: rows.map((w) => [d(w.created_at), money(w.amount_cents), String(w.destination_details_masked ?? w.destination), withdrawalStatus(w.status)]) } };
  },
  "representante/perfil": async (tx, ctx) => {
    const rep = await myRep(tx, ctx);
    if (!rep) return { empty: "Cadastro de representante não encontrado." };
    return {
      list: [
        { title: rep.display_name, subtitle: "Nome de exibição nas ofertas" },
        { title: maskCpf(rep.document ?? ""), subtitle: "Documento (mascarado)" },
        { title: formatCents(n(rep.max_margin_cents)), subtitle: "Margem máxima permitida por diária" },
        { title: `Representante desde ${d(rep.created_at)}`, subtitle: "Programa de representantes Foccus Car", badge: rep.status === "ACTIVE" ? { text: "Ativo", tone: "success" } : { text: rep.status === "PENDING" ? "Em aprovação" : "Suspenso", tone: "warning" } },
      ],
    };
  },

  // ── Equipe ───────────────────────────────────────────────
  "admin/clientes": async (tx) => {
    const rows = await q(tx, sql`select c.*, u.status, (select count(*) from rentals r where r.customer_id = c.id) as rentals, (select coalesce(sum(amount_cents), 0) from payments p where p.customer_id = c.id and p.status = 'APPROVED' and p.purpose <> 'DEPOSIT') as spent from customers c left join users u on u.id = c.user_id where c.deleted_at is null order by spent desc`);
    return { table: { columns: ["Cliente", "CPF", "Cidade", "Situação", "Locações", "Total gasto"], rows: rows.map((c) => [{ text: String(c.full_name), sub: String(c.email ?? "") }, maskCpf(String(c.cpf ?? "")), `${c.city ?? "—"}${c.state ? `/${c.state}` : ""}`, c.status ? accountStatus(c.status) : { text: "Balcão (sem login)", tone: "neutral" }, String(n(c.rentals)), money(c.spent)]) } };
  },
  "admin/reservas": async (tx) => {
    const rows = await q(tx, sql`select r.*, c.full_name, v.brand, v.model, v.plate from reservations r join customers c on c.id = r.customer_id join vehicles v on v.id = r.vehicle_id where r.deleted_at is null order by (r.status in ('PENDING_PAYMENT','CONFIRMED')) desc, r.pickup_at desc limit 80`);
    const [s] = await q(tx, sql`select count(*) filter (where status = 'CONFIRMED') as confirmed, count(*) filter (where status = 'PENDING_PAYMENT') as pending, count(*) filter (where status = 'CANCELLED') as cancelled, count(*) filter (where created_at >= date_trunc('month', now())) as month from reservations`);
    return {
      stats: [{ label: "Confirmadas", value: String(n(s?.confirmed)) }, { label: "Aguardando pagamento", value: String(n(s?.pending)) }, { label: "Canceladas", value: String(n(s?.cancelled)) }, { label: "Criadas no mês", value: String(n(s?.month)) }],
      table: { columns: ["Reserva", "Cliente", "Veículo", "Retirada", "Devolução", "Total", "Status"], rows: rows.map((r) => [String(r.code), String(r.full_name), { text: car(r), sub: String(r.plate) }, dateTime(r.pickup_at), dateTime(r.return_at), money(r.total_cents), reservationStatus(r.status)]) },
    };
  },
  "admin/locacoes": async (tx) => {
    const rows = await q(tx, sql`select r.*, c.full_name, v.brand, v.model, v.plate, (r.status = 'ACTIVE' and r.expected_return_at < now()) as late from rentals r join customers c on c.id = r.customer_id join vehicles v on v.id = r.vehicle_id where r.deleted_at is null order by (r.status = 'ACTIVE') desc, r.start_at desc limit 80`);
    const [s] = await q(tx, sql`select count(*) filter (where status = 'ACTIVE') as active, count(*) filter (where status = 'ACTIVE' and expected_return_at < now()) as late, count(*) filter (where status = 'CLOSED' and actual_return_at >= date_trunc('month', now())) as closed, count(*) filter (where status = 'ACTIVE' and expected_return_at::date = now()::date) as today from rentals`);
    return {
      stats: [{ label: "Em andamento", value: String(n(s?.active)) }, { label: "Atrasadas", value: String(n(s?.late)) }, { label: "Devolvem hoje", value: String(n(s?.today)) }, { label: "Encerradas no mês", value: String(n(s?.closed)) }],
      table: { columns: ["Locação", "Condutor", "Veículo", "Início", "Retorno previsto", "Status"], rows: rows.map((r) => [String(r.code), String(r.full_name), { text: car(r), sub: String(r.plate) }, dateTime(r.start_at), dateTime(r.expected_return_at), r.late ? { text: "Atrasada", tone: "danger" } : rentalStatus(r.status)]) },
    };
  },
  "admin/checklists": async (tx) => {
    const rows = await q(tx, sql`select ch.*, v.brand, v.model, v.plate, u.name as by, (select count(*) from checklist_items i where i.checklist_id = ch.id and i.result = 'DAMAGE') as damages from checklists ch join vehicles v on v.id = ch.vehicle_id left join users u on u.id = ch.performed_by order by ch.performed_at desc limit 40`);
    return { list: rows.map((c) => ({ title: `${c.type === "CHECKOUT" ? "Saída" : c.type === "RETURN" ? "Devolução" : "Inspeção"} · ${car(c)} (${c.plate})`, subtitle: `${dateTime(c.performed_at)} · ${n(c.km).toLocaleString("pt-BR")} km · por ${c.by ?? "—"} · 23 itens conferidos`, badge: n(c.damages) ? { text: `${n(c.damages)} avaria`, tone: "danger" as Tone } : { text: "Sem avarias", tone: "success" as Tone } })) };
  },
  "admin/manutencao": async (tx) => {
    const rows = await q(tx, sql`select m.*, v.brand, v.model, v.plate from maintenance m join vehicles v on v.id = m.vehicle_id where m.deleted_at is null order by coalesce(m.performed_at, m.created_at) desc`);
    const [s] = await q(tx, sql`select count(*) filter (where status = 'IN_PROGRESS') as doing, count(*) filter (where status = 'SCHEDULED') as scheduled, coalesce(sum(total_cents) filter (where status = 'DONE' and performed_at >= now() - interval '90 days'), 0) as cost from maintenance`);
    return {
      stats: [{ label: "Em andamento", value: String(n(s?.doing)) }, { label: "Agendadas", value: String(n(s?.scheduled)) }, { label: "Custo em 90 dias", value: money(s?.cost) }],
      table: { columns: ["Veículo", "Serviço", "Data", "KM", "Valor", "Situação"], rows: rows.map((m) => [{ text: car(m), sub: String(m.plate) }, { text: String(m.service), sub: String(m.workshop ?? "") }, d(m.performed_at ?? m.created_at), n(m.km).toLocaleString("pt-BR"), money(m.total_cents), maintenanceStatus(m.status)]) },
    };
  },
  "admin/seguranca": async (tx) => {
    const rows = await q(tx, sql`select a.*, v.brand, v.model, v.plate, (select status from telematics_commands t where t.security_alert_id = a.id order by created_at desc limit 1) as command from security_alerts a join vehicles v on v.id = a.vehicle_id order by (a.status in ('NEW','ANALYZING')) desc, a.occurred_at desc`);
    return { list: rows.map((a) => ({ title: `${ALERT_LABEL[String(a.type)] ?? a.type} · ${car(a)} (${a.plate})`, subtitle: `${dateTime(a.occurred_at)} · gravidade ${String(a.severity).toLowerCase()}${a.command === "CONFIRMED" ? " · bloqueio remoto confirmado" : ""}${a.resolution ? ` · ${a.resolution}` : ""}`, badge: alertStatus(a.status) })) };
  },
  "admin/ocorrencias": async (tx) => {
    const rows = await q(tx, sql`select o.*, v.brand, v.model, v.plate, c.full_name from occurrences o join vehicles v on v.id = o.vehicle_id left join customers c on c.id = o.customer_id where o.deleted_at is null order by o.occurred_at desc`);
    return { table: { columns: ["Data", "Tipo", "Veículo", "Cliente", "Descrição", "Status"], rows: rows.map((o) => [dateTime(o.occurred_at), OCCURRENCE_LABEL[String(o.kind)] ?? String(o.kind), { text: car(o), sub: String(o.plate) }, String(o.full_name ?? "—"), String(o.description), occurrenceStatus(o.status)]) } };
  },
  "admin/multas": async (tx) => {
    const rows = await q(tx, sql`select f.*, v.brand, v.model, v.plate, dr.full_name from fines f join vehicles v on v.id = f.vehicle_id left join drivers dr on dr.id = f.driver_id where f.deleted_at is null order by f.infraction_at desc`);
    return { table: { columns: ["Data", "Veículo", "Condutor", "Infração", "Valor", "Status"], rows: rows.map((f) => [d(f.infraction_at), { text: car(f), sub: String(f.plate) }, String(f.full_name ?? "A identificar"), { text: String(f.description), sub: String(f.place ?? "") }, money(f.amount_cents), fineStatus(f.status)]) } };
  },
  "admin/financeiro": async (tx) => {
    const [s] = await q(tx, sql`select coalesce(sum(amount_cents) filter (where direction = 'INCOME'), 0) as income, coalesce(sum(amount_cents) filter (where direction = 'EXPENSE'), 0) as expense from financial_transactions where status = 'CONFIRMED' and competence_date >= date_trunc('month', now())`);
    const [recv] = await q(tx, sql`select coalesce(sum(amount_cents), 0) as v from payments where status = 'PENDING'`);
    const [charges] = await q(tx, sql`select coalesce(sum(amount_cents), 0) as v from rental_charges where status in ('OPEN','BILLED')`);
    const months = await q(tx, sql`select to_char(competence_date, 'YYYY-MM') as ym, sum(case when direction = 'INCOME' then amount_cents else -amount_cents end) as total from financial_transactions where status = 'CONFIRMED' group by 1`);
    const rows = await q(tx, sql`select * from financial_transactions order by competence_date desc, created_at desc limit 40`);
    return {
      stats: [{ label: "Receita do mês", value: money(s?.income), gold: true }, { label: "Despesas do mês", value: money(s?.expense) }, { label: "Resultado do mês", value: money(n(s?.income) - n(s?.expense)) }, { label: "A receber", value: money(n(recv?.v) + n(charges?.v)), hint: "Pagamentos pendentes e encargos" }],
      bars: { title: "Resultado por mês (receitas menos despesas)", items: lastMonths(months) },
      table: { title: "Lançamentos recentes", columns: ["Data", "Descrição", "Categoria", "Valor", "Situação"], rows: rows.map((t) => [d(t.competence_date), String(t.description), CATEGORY_LABEL[String(t.category)] ?? String(t.category), { text: `${t.direction === "INCOME" ? "+" : "−"} ${money(t.amount_cents)}`, tone: t.direction === "INCOME" ? "success" : "danger" }, t.status === "CONFIRMED" ? { text: "Confirmado", tone: "success" } : { text: "Previsto", tone: "warning" }]) },
    };
  },
  "admin/representantes": async (tx) => {
    const rows = await q(tx, sql`select r.*, w.available_cents, (select count(*) from representative_listings l where l.representative_id = r.id and l.active) as listings, (select count(*) from reservations x join representative_listings l on l.id = x.representative_listing_id where l.representative_id = r.id and x.status <> 'CANCELLED') as sales from representatives r left join wallets w on w.representative_id = r.id where r.deleted_at is null order by sales desc`);
    return { table: { columns: ["Representante", "Ofertas ativas", "Vendas", "Saldo", "Status"], rows: rows.map((r) => [String(r.display_name), String(n(r.listings)), String(n(r.sales)), money(r.available_cents), r.status === "ACTIVE" ? { text: "Ativo", tone: "success" } : r.status === "PENDING" ? { text: "Aguardando aprovação", tone: "warning" } : { text: "Suspenso", tone: "danger" }]) } };
  },
  "admin/monitoramento": async (tx) => {
    const rows = await q(tx, sql`select distinct on (v.id) v.brand, v.model, v.plate, v.status, p.latitude, p.longitude, p.recorded_at, p.speed_kmh from vehicles v join gps_positions p on p.vehicle_id = v.id where v.deleted_at is null order by v.id, p.recorded_at desc`);
    const stale = (r: Row) => Date.now() - new Date(r.recorded_at as string).getTime() > 6 * 3600_000;
    return {
      map: { points: rows.map((r) => ({ label: `${car(r)} · ${r.plate}`, lat: n(r.latitude), lng: n(r.longitude), tone: stale(r) ? "danger" : vehicleTone[String(r.status)] ?? "neutral", status: stale(r) ? "Sem comunicação" : (VEHICLE_STATUS_LABEL[String(r.status)] ?? String(r.status)), seen: `${dateTime(r.recorded_at)}${n(r.speed_kmh) ? ` · ${n(r.speed_kmh)} km/h` : ""}` })) },
    };
  },
  "admin/relatorios": async (tx) => {
    const [fleet] = await q(tx, sql`select count(*) as total, count(*) filter (where status = 'RENTED') as rented, coalesce(sum(current_km), 0) as km from vehicles where deleted_at is null and status <> 'INACTIVE'`);
    const [occ] = await q(tx, sql`select coalesce(sum(extract(epoch from (coalesce(actual_return_at, least(now(), expected_return_at)) - greatest(start_at, now() - interval '30 days')))) / 86400, 0) as days from rentals where status in ('ACTIVE','CLOSED') and coalesce(actual_return_at, now()) > now() - interval '30 days'`);
    const [fin] = await q(tx, sql`select coalesce(sum(amount_cents) filter (where direction = 'INCOME'), 0) as income, coalesce(sum(amount_cents) filter (where direction = 'EXPENSE'), 0) as expense from financial_transactions where status = 'CONFIRMED' and competence_date >= now() - interval '90 days'`);
    const [cli] = await q(tx, sql`select count(*) filter (where created_at >= now() - interval '30 days') as new, count(*) filter (where (select count(*) from rentals r where r.customer_id = c.id) > 1) as recurring from customers c`);
    const top = await q(tx, sql`select v.brand, v.model, coalesce(sum(t.amount_cents) filter (where t.direction = 'INCOME'), 0) - coalesce(sum(t.amount_cents) filter (where t.direction = 'EXPENSE'), 0) as profit from vehicles v left join financial_transactions t on t.vehicle_id = v.id and t.status = 'CONFIRMED' group by v.id order by profit desc limit 3`);
    const rate = n(fleet?.total) ? Math.round((n(occ?.days) / (n(fleet?.total) * 30)) * 100) : 0;
    return {
      cards: [
        { title: "Utilização da frota", subtitle: "Últimos 30 dias", lines: [`Ocupação de ${rate}%`, `${n(fleet?.rented)} de ${n(fleet?.total)} veículos alugados agora`, `${n(fleet?.km).toLocaleString("pt-BR")} km somados na frota`] },
        { title: "Financeiro", subtitle: "Últimos 90 dias", lines: [`Receitas ${money(fin?.income)}`, `Despesas ${money(fin?.expense)}`, `Lucro operacional ${money(n(fin?.income) - n(fin?.expense))}`] },
        { title: "Clientes", subtitle: "Base atual", lines: [`${n(cli?.new)} novos nos últimos 30 dias`, `${n(cli?.recurring)} clientes recorrentes`] },
        { title: "Veículos mais rentáveis", subtitle: "Receita menos custos", lines: top.map((t) => `${car(t)}: ${money(t.profit)}`) },
      ],
    };
  },
};

async function walletView(tx: Tx, ctx: AccessContext, view: "ganhos" | "carteira"): Promise<ModuleData> {
  const rep = await myRep(tx, ctx);
  const [w] = await q(tx, sql`select * from wallets where id = ${rep?.wallet_id ?? NONE}`);
  const rows = await q(tx, sql`select * from wallet_transactions where wallet_id = ${rep?.wallet_id ?? NONE} ${view === "ganhos" ? sql`and kind = 'MARGIN'` : sql``} order by created_at desc limit 60`);
  const stats =
    view === "ganhos"
      ? [{ label: "Total gerado", value: money(w?.total_earned_cents), gold: true }, { label: "Pendente", value: money(w?.pending_cents), hint: "Libera após a devolução" }, { label: "Liberado", value: money(n(w?.total_earned_cents) - n(w?.pending_cents)) }, { label: "Sacado", value: money(w?.total_withdrawn_cents) }]
      : [{ label: "Saldo disponível", value: money(w?.available_cents), gold: true }, { label: "Saldo pendente", value: money(w?.pending_cents) }, { label: "Total gerado", value: money(w?.total_earned_cents) }, { label: "Total sacado", value: money(w?.total_withdrawn_cents) }, { label: "Total investido", value: money(w?.total_invested_cents) }];
  return {
    stats,
    table: { title: "Movimentações", columns: ["Data", "ID", "Origem", "Destino", "Valor", "Status"], rows: rows.map((t) => [d(t.created_at), String(t.id).slice(0, 8), String(t.origin), String(t.destination), { text: money(t.amount_cents), tone: n(t.amount_cents) >= 0 ? "success" : "neutral" }, walletStatus(t.status)]) },
  };
}
