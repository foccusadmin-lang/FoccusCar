import { NextResponse, type NextRequest } from "next/server";
import { createVehicle, listVehicles } from "@foccus/services";
import { AppError, readJson, requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";
import { getCurrentCompany } from "@/server/auth";
import { listShowcase, showcaseFiltersSchema } from "@/server/services/showcase";

export const dynamic = "force-dynamic";

/** Vitrine pública em JSON (sem login). Com ?painel=1, a frota completa para a equipe. */
export const GET = route(async (req: NextRequest) => {
  if (req.nextUrl.searchParams.get("painel") === "1") {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    delete params.painel;
    return NextResponse.json(await listVehicles(deps, await requireAccess(), params));
  }
  const company = await getCurrentCompany();
  if (!company) throw new AppError("Locadora não encontrada para este endereço.", 404, "COMPANY_NOT_FOUND");
  const filters = showcaseFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return NextResponse.json(await listShowcase(company.id, filters));
});

/** Cadastro de veículo (vehicles:manage). */
export const POST = route(async (req: Request) => {
  const ctx = await requireAccess();
  return NextResponse.json(await createVehicle(deps, ctx, await readJson(req), requestMeta(req)), { status: 201 });
});
