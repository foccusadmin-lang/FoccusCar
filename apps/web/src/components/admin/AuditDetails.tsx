/** Valor anterior × novo de um registro de auditoria, recolhido por padrão. */
export function AuditDetails({ oldValue, newValue, ip, entityId }: { oldValue: unknown; newValue: unknown; ip: string | null; entityId: string }) {
  const show = (v: unknown) => (v == null ? "—" : JSON.stringify(v, null, 2));
  return (
    <details>
      <summary style={{ cursor: "pointer", color: "var(--fc-accent)", fontSize: 14 }}>Ver</summary>
      <div className="stack" style={{ gap: 6, marginTop: 8, fontSize: 13 }}>
        <span className="muted">Registro: {entityId}{ip ? ` · IP ${ip}` : ""}</span>
        <span className="muted">Antes</span>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: 480 }}>{show(oldValue)}</pre>
        <span className="muted">Depois</span>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: 480 }}>{show(newValue)}</pre>
      </div>
    </details>
  );
}
