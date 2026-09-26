export function Stepper({ steps, current, onSelect }: { steps: { label: string; done: boolean }[]; current: number; onSelect?: (i: number) => void }) {
  return (
    <ol className="stepper" aria-label="Etapas do cadastro">
      {steps.map((s, i) => (
        <li key={s.label} className={["step", i === current && "current", s.done && "done"].filter(Boolean).join(" ")} aria-current={i === current ? "step" : undefined}>
          <button type="button" onClick={() => onSelect?.(i)} disabled={!onSelect}>
            <span className="dot" aria-hidden>{s.done ? "✓" : i + 1}</span>
            <span className="label">{s.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
