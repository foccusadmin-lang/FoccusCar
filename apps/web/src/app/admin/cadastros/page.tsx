import type { Metadata } from "next";
import Link from "next/link";
import { listReviewQueue } from "@foccus/services";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { requirePagePermission } from "@/server/guard";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Análise de cadastros" };
export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const ctx = await requirePagePermission("customers:documents.review", "/admin/cadastros");
  const queue = await listReviewQueue(deps, ctx);
  return (
    <div className="container" style={{ paddingBlock: "24px", maxWidth: 960 }}>
      <div className="stack" style={{ gap: 20 }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Clientes</span>
          <h1 style={{ fontSize: "clamp(24px, 5vw, 30px)" }}>Cadastros para análise</h1>
          <p className="muted" style={{ margin: 0 }}>{queue.length ? `${queue.length} aguardando, do mais antigo para o mais novo.` : "Nenhum cadastro aguardando."}</p>
        </div>
        {queue.length === 0 ? (
          <EmptyState title="Tudo em dia" description="Quando um cliente enviar o cadastro, ele aparece aqui para análise." />
        ) : (
          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 10 }}>
            {queue.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/cadastros/${c.id}`} className="card row" style={{ padding: 16, justifyContent: "space-between" }}>
                  <div className="stack" style={{ gap: 2 }}>
                    <strong>{c.fullName}</strong>
                    <span className="muted" style={{ fontSize: 14 }}>CPF {c.cpf} · {[c.city, c.state].filter(Boolean).join("/")}</span>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    {c.submittedAt && <span className="muted" style={{ fontSize: 13 }}>Enviado em {formatDate(c.submittedAt)}</span>}
                    <Badge tone="info">Em análise</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
