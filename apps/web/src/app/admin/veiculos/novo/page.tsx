import type { Metadata } from "next";
import { getFleetOptions } from "@foccus/services";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { ButtonLink } from "@/components/ui/Button";
import { requirePagePermission } from "@/server/guard";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Cadastrar veículo" };

export default async function NewVehiclePage() {
  const ctx = await requirePagePermission("vehicles:manage", "/admin/veiculos/novo");
  const options = await getFleetOptions(deps, ctx);
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 900 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Frota</span>
          <h1>Cadastrar veículo</h1>
        </div>
        <ButtonLink href="/admin/veiculos" variant="ghost">Voltar</ButtonLink>
      </div>
      <VehicleForm categories={options.categories} locations={options.locations} />
    </div>
  );
}
