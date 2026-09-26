/** Carregamento dentro do painel: mantém o menu e mostra o esqueleto do conteúdo (seção 102). */
export default function AdminLoading() {
  return (
    <div className="stack" style={{ gap: 16 }} aria-busy="true" aria-label="Carregando">
      <div className="skeleton" style={{ height: 36, width: "min(360px, 70%)" }} />
      <div className="kpi-grid">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton" style={{ height: 96 }} />)}
      </div>
      <div className="skeleton" style={{ height: 240 }} />
    </div>
  );
}
