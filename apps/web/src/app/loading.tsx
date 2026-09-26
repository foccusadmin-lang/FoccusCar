export default function Loading() {
  return (
    <div className="container" style={{ paddingBlock: "32px" }} aria-busy="true" aria-label="Carregando">
      <div className="vehicle-grid">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 320 }} />)}
      </div>
    </div>
  );
}
