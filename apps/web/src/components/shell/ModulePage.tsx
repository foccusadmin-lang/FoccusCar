import type { Metadata } from "next";
import "./shell.css";
import type { ReactNode } from "react";
import { MODULES, STAGES, type ModuleInfo, type ModuleKey } from "@/lib/modules";
import { Badge } from "../ui/Badge";
import { ButtonLink } from "../ui/Button";
import { Icon } from "./Icon";

export function moduleMetadata(key: ModuleKey): Metadata {
  return { title: MODULES[key].title };
}

/** Cabeçalho padrão das telas internas: contexto, título, descrição e ação principal. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p className="muted" style={{ margin: 0 }}>{description}</p>}
      </div>
      {actions && <div className="row page-actions">{actions}</div>}
    </header>
  );
}

/** Tela-esqueleto de um módulo ainda não implementado: formato da tela + o que ela terá. */
export function ModulePage({ id }: { id: ModuleKey }) {
  const m: ModuleInfo = MODULES[id];
  return (
    <div className="page">
      <PageHeader
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.description}
        actions={
          <>
            {m.link && <ButtonLink href={m.link.href} variant="secondary">{m.link.label}</ButtonLink>}
            {m.action && (
              <button type="button" className="btn btn-primary" disabled title="Disponível quando o módulo for liberado">
                <Icon name="plus" size={18} />
                {m.action}
              </button>
            )}
          </>
        }
      />

      <div className="module-notice card">
        <Icon name="lock" />
        <div className="stack" style={{ gap: 2 }}>
          <strong>Módulo em construção</strong>
          <span className="muted">
            {m.stage ? <>Chega na etapa {m.stage} do plano: {STAGES[m.stage]}.</> : "Esta tela evolui junto com os módulos relacionados."}
          </span>
        </div>
        {m.stage && <Badge tone="gold" plain>Etapa {m.stage}</Badge>}
      </div>

      <Preview m={m} />

      <section className="card card-pad stack" style={{ gap: 12 }} aria-labelledby={`feat-${id}`}>
        <h2 id={`feat-${id}`} style={{ fontSize: 18 }}>O que vai ter aqui</h2>
        <ul className="feature-list">
          {m.features.map((f) => <li key={f}>{f}</li>)}
        </ul>
      </section>
    </div>
  );
}

function Ghost({ w = "100%", h = 14 }: { w?: number | string; h?: number }) {
  return <span className="ghost" style={{ width: w, height: h }} aria-hidden />;
}

function Preview({ m }: { m: ModuleInfo }) {
  switch (m.preview) {
    case "dashboard":
      return (
        <div className="stat-grid" aria-label="Indicadores (sem dados ainda)">
          {(m.stats ?? []).map((s) => (
            <div key={s} className="card stat">
              <span className="muted">{s}</span>
              <strong>—</strong>
            </div>
          ))}
          <div className="card stat-wide">
            <span className="muted" style={{ fontSize: 13 }}>Gráfico ilustrativo, sem dados ainda</span>
            <div className="chart-ghost" aria-hidden>{[40, 65, 50, 80, 60, 90, 70].map((v, i) => <span key={i} style={{ height: `${v}%` }} />)}</div>
          </div>
        </div>
      );
    case "table":
      return (
        <div className="card table-ghost" aria-label="Lista (sem registros ainda)">
          <div className="table-toolbar">
            <div className="input search-ghost"><Icon name="search" size={18} /><span className="muted">Buscar</span></div>
            <span className="badge plain">Filtros</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr>{(m.columns ?? []).map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
              <tbody>
                {[0, 1, 2].map((r) => (
                  <tr key={r}>{(m.columns ?? []).map((c, i) => <td key={c}><Ghost w={i === 0 ? "80%" : "60%"} /></td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted table-empty">Nenhum registro ainda.</p>
        </div>
      );
    case "cards":
      return (
        <div className="ghost-cards" aria-label="Cartões (sem registros ainda)">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card ghost-card" aria-hidden>
              <span className="ghost" style={{ aspectRatio: "16 / 9", width: "100%" }} />
              <Ghost w="70%" h={16} />
              <Ghost w="45%" />
            </div>
          ))}
        </div>
      );
    case "map":
      return (
        <div className="map-ghost card" aria-label="Mapa (sem rastreadores conectados)">
          <div className="map-area"><Icon name="map" size={40} /><span className="muted">Mapa da frota</span></div>
          <div className="map-list">
            {["Disponível", "Alugado", "Manutenção", "Sem comunicação"].map((s) => (
              <div key={s} className="row" style={{ justifyContent: "space-between" }}>
                <span>{s}</span><Badge plain>—</Badge>
              </div>
            ))}
          </div>
        </div>
      );
    case "wallet":
      return (
        <div className="stat-grid" aria-label="Carteira (sem movimentações ainda)">
          <div className="card stat stat-hero">
            <span className="muted">Saldo disponível</span>
            <strong className="gold-text">R$ —</strong>
          </div>
          {["Saldo pendente", "Total gerado", "Total sacado", "Total investido"].map((s) => (
            <div key={s} className="card stat"><span className="muted">{s}</span><strong>—</strong></div>
          ))}
        </div>
      );
    case "timeline":
    case "list":
      return (
        <ul className="card ghost-list" aria-label="Lista (sem registros ainda)">
          {[0, 1, 2].map((i) => (
            <li key={i} aria-hidden><span className="ghost ghost-dot" /><div className="stack" style={{ gap: 6, flex: 1 }}><Ghost w="55%" /><Ghost w="35%" h={12} /></div></li>
          ))}
        </ul>
      );
  }
}
