import Link from "next/link";
import type { Cell, ModuleData } from "@/server/module-data";
import { Badge } from "../ui/Badge";
import { Icon } from "./Icon";

function CellView({ cell }: { cell: Cell }) {
  if (typeof cell === "string") return <>{cell}</>;
  const main = cell.tone ? <Badge tone={cell.tone}>{cell.text}</Badge> : <span>{cell.text}</span>;
  return (
    <div className="stack" style={{ gap: 2 }}>
      {cell.href ? <Link href={cell.href}>{main}</Link> : main}
      {cell.sub && <span className="muted" style={{ fontSize: 12 }}>{cell.sub}</span>}
    </div>
  );
}

/** Registros reais de um módulo em modo consulta (ver server/module-data.ts). */
export function LiveData({ data }: { data: ModuleData }) {
  const nothing = !data.stats?.length && !data.bars && !data.table?.rows.length && !data.cards?.length && !data.list?.length && !data.map?.points.length;
  if (nothing) return <p className="card card-pad muted" style={{ margin: 0 }}>{data.empty ?? "Nenhum registro ainda."}</p>;
  const max = Math.max(1, ...(data.bars?.items.map((b) => Math.abs(b.value)) ?? [1]));
  return (
    <>
      {!!data.stats?.length && (
        <div className="stat-grid">
          {data.stats.map((s) => (
            <div key={s.label} className="card stat">
              <span className="muted">{s.label}</span>
              <strong className={s.gold ? "gold-text" : undefined}>{s.value}</strong>
              {s.hint && <span className="muted" style={{ fontSize: 12 }}>{s.hint}</span>}
            </div>
          ))}
        </div>
      )}
      {data.bars && (
        <section className="card stat-wide" aria-label={data.bars.title}>
          <span className="muted" style={{ fontSize: 13 }}>{data.bars.title}</span>
          <div className="live-bars">
            {data.bars.items.map((b) => (
              <div key={b.label} className="live-bar" title={`${b.label}: ${b.display}`}>
                <span className="live-bar-value">{b.display}</span>
                <span className={b.value < 0 ? "live-bar-fill negative" : "live-bar-fill"} style={{ height: `${Math.max(3, (Math.abs(b.value) / max) * 100)}%` }} />
                <span className="live-bar-label">{b.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {data.map && <FleetMap points={data.map.points} />}
      {data.table && (
        <section className="card table-ghost" aria-label={data.table.title ?? "Registros"}>
          {data.table.title && <div className="table-toolbar"><strong>{data.table.title}</strong><span className="badge plain">{data.table.rows.length}</span></div>}
          {data.table.rows.length ? (
            <div className="table-scroll">
              <table>
                <thead><tr>{data.table.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
                <tbody>
                  {data.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><CellView cell={c} /></td>)}</tr>)}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted table-empty">{data.empty ?? "Nenhum registro ainda."}</p>
          )}
        </section>
      )}
      {!!data.cards?.length && (
        <div className="ghost-cards">
          {data.cards.map((c, i) => {
            const body = (
              <>
                {c.image && <img src={c.image} alt="" className="live-card-img" loading="lazy" />}
                <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <strong>{c.title}</strong>
                    {c.subtitle && <span className="muted" style={{ fontSize: 13 }}>{c.subtitle}</span>}
                  </div>
                  {c.badge && <Badge tone={c.badge.tone}>{c.badge.text}</Badge>}
                </div>
                {c.lines.map((l) => <span key={l} style={{ fontSize: 14 }}>{l}</span>)}
              </>
            );
            return c.href ? <Link key={i} href={c.href} className="card ghost-card">{body}</Link> : <div key={i} className="card ghost-card">{body}</div>;
          })}
        </div>
      )}
      {!!data.list?.length && (
        <ul className="card ghost-list">
          {data.list.map((l, i) => {
            const inner = (
              <>
                <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 15 }}>{l.title}</strong>
                  {l.subtitle && <span className="muted" style={{ fontSize: 13 }}>{l.subtitle}</span>}
                </div>
                {l.badge && <Badge tone={l.badge.tone}>{l.badge.text}</Badge>}
              </>
            );
            return <li key={i}>{l.href ? <Link href={l.href} className="row" style={{ flex: 1, gap: 14 }}>{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </>
  );
}

/** Mapa esquemático (sem serviço de mapas externo): posição relativa da última leitura de cada rastreador. */
function FleetMap({ points }: { points: NonNullable<ModuleData["map"]>["points"] }) {
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const x = (lng: number) => 6 + ((lng - minLng) / (maxLng - minLng || 1)) * 88;
  const y = (lat: number) => 8 + ((maxLat - lat) / (maxLat - minLat || 1)) * 84;
  const counts = points.reduce<Record<string, number>>((acc, p) => ((acc[p.status] = (acc[p.status] ?? 0) + 1), acc), {});
  return (
    <div className="map-ghost card">
      <div className="map-area live-map" aria-label="Posição da frota">
        {points.map((p) => (
          <span key={p.label} className={`live-pin ${p.tone}`} style={{ left: `${x(p.lng)}%`, top: `${y(p.lat)}%` }} title={`${p.label} · ${p.status} · ${p.seen}`} />
        ))}
        <span className="live-map-note"><Icon name="map" size={16} /> Mapa esquemático · o mapa real chega com o rastreador (etapa 9)</span>
      </div>
      <div className="map-list">
        {Object.entries(counts).map(([s, c]) => <div key={s} className="row" style={{ justifyContent: "space-between" }}><span>{s}</span><Badge plain>{c}</Badge></div>)}
        <hr style={{ border: 0, borderTop: "1px solid var(--fc-border)", width: "100%", margin: "4px 0" }} />
        {points.map((p) => (
          <div key={p.label} className="stack" style={{ gap: 2 }}>
            <span style={{ fontSize: 14 }}>{p.label}</span>
            <span className="muted" style={{ fontSize: 12 }}>{p.status} · {p.seen}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
