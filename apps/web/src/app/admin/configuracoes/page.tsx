import type { Metadata } from "next";
import { getFleetOptions } from "@foccus/services";
import { FleetSettings } from "@/components/admin/FleetSettings";
import { requirePagePermission } from "@/server/guard";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const ctx = await requirePagePermission("vehicles:manage", "/admin/configuracoes");
  const options = await getFleetOptions(deps, ctx);
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 900 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Configurações</span>
          <h1>Categorias e localizações</h1>
          <p className="muted" style={{ margin: 0 }}>Usadas no cadastro dos veículos e nos filtros da vitrine.</p>
        </div>
      </div>
      <FleetSettings categories={options.categories} locations={options.locations} />
    </div>
  );
}
