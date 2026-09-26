import Image from "next/image";
import { VehicleCard } from "@/components/VehicleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { FUEL_LABEL, TRANSMISSION_LABEL } from "@/lib/format";
import { getCurrentCompany } from "@/server/auth";
import { listShowcase, showcaseFiltersSchema } from "@/server/services/showcase";

export const dynamic = "force-dynamic";

export default async function ShowcasePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const raw = await searchParams;
  const parsed = showcaseFiltersSchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, v]) => v)));
  const filters = parsed.success ? parsed.data : showcaseFiltersSchema.parse({});
  const company = await getCurrentCompany();

  if (!company)
    return (
      <div className="container" style={{ paddingBlock: "48px" }}>
        <EmptyState title="Locadora não configurada" description="Este endereço ainda não está vinculado a nenhuma locadora. Verifique a configuração do domínio." />
      </div>
    );

  const { items, categories, hasMore, page } = await listShowcase(company.id, filters);
  const qs = (patch: Record<string, string | number>) =>
    "?" + new URLSearchParams({ ...(Object.fromEntries(Object.entries(raw).filter(([, v]) => v)) as Record<string, string>), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) }).toString();

  return (
    <div className="container">
      <section className="hero">
        <div className="stack" style={{ gap: 18 }}>
          <span className="eyebrow">Locadora de veículos</span>
          <h1 className="display">
            <span className="gold-text">Seu próximo carro</span> <span className="silver-text">está aqui.</span>
          </h1>
          <p className="muted" style={{ fontSize: 18, margin: 0, maxWidth: 520 }}>
            Frota selecionada, reserva online e acompanhamento completo da sua locação. Diárias, semanais, quinzenais e mensais.
          </p>
          <div className="row">
            <ButtonLink href="#frota" size="lg">Ver veículos</ButtonLink>
            <ButtonLink href="/entrar" variant="secondary" size="lg">Criar conta</ButtonLink>
          </div>
        </div>
        <Image src="/brand/foccus-car-logo.webp" alt="Foccus Car — Locadora de Veículos" width={1200} height={750} priority sizes="(max-width: 900px) 100vw, 50vw" />
      </section>

      <section id="frota" className="stack" style={{ gap: 20, scrollMarginTop: 80 }}>
        <div className="gold-rule">Nossa frota</div>

        <form className="card card-pad filters" method="get" action="/#frota" aria-label="Filtrar veículos">
          <div className="field">
            <label htmlFor="categoria">Categoria</label>
            <select id="categoria" name="categoria" className="select" defaultValue={filters.categoria ?? ""}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cambio">Câmbio</label>
            <select id="cambio" name="cambio" className="select" defaultValue={filters.cambio ?? ""}>
              <option value="">Todos</option>
              {Object.entries(TRANSMISSION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="combustivel">Combustível</label>
            <select id="combustivel" name="combustivel" className="select" defaultValue={filters.combustivel ?? ""}>
              <option value="">Todos</option>
              {Object.entries(FUEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="precoMax">Diária até (R$)</label>
            <input id="precoMax" name="precoMax" className="input" inputMode="numeric" pattern="[0-9]*" defaultValue={filters.precoMax ?? ""} placeholder="Sem limite" />
          </div>
          <div className="field">
            <label htmlFor="ordem">Ordenar por</label>
            <select id="ordem" name="ordem" className="select" defaultValue={filters.ordem}>
              <option value="destaque">Destaque</option>
              <option value="preco">Menor preço</option>
              <option value="novos">Mais novos</option>
              <option value="disponibilidade">Disponibilidade</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit">Filtrar</button>
        </form>

        {items.length ? (
          <div className="vehicle-grid">{items.map((v) => <VehicleCard key={v.id} v={v} />)}</div>
        ) : (
          <EmptyState
            title="Nenhum veículo encontrado"
            description="Não há veículos com esses filtros agora. Ajuste os filtros ou veja toda a frota."
            action={<ButtonLink href="/#frota" variant="secondary">Ver toda a frota</ButtonLink>}
          />
        )}

        {(page > 1 || hasMore) && (
          <nav className="row" style={{ justifyContent: "center" }} aria-label="Paginação">
            {page > 1 && <ButtonLink href={qs({ pagina: page - 1 }) + "#frota"} variant="secondary">Anterior</ButtonLink>}
            {hasMore && <ButtonLink href={qs({ pagina: page + 1 }) + "#frota"} variant="secondary">Próxima</ButtonLink>}
          </nav>
        )}
      </section>
    </div>
  );
}
