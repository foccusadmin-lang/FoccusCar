"use client";

import { EmptyState } from "@/components/ui/EmptyState";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container" style={{ paddingBlock: "48px" }}>
      <EmptyState
        title="Não foi possível carregar esta página"
        description="Houve uma falha temporária. Tente novamente em instantes."
        action={<button className="btn btn-primary" onClick={reset}>Tentar novamente</button>}
      />
    </div>
  );
}
