import { NextResponse, type NextRequest } from "next/server";
import { AppError, route } from "@/server/api";
import { getCurrentCompany } from "@/server/auth";
import { listShowcase, showcaseFiltersSchema } from "@/server/services/showcase";

export const dynamic = "force-dynamic";

/** Vitrine pública em JSON (sem login). */
export const GET = route(async (req: NextRequest) => {
  const company = await getCurrentCompany();
  if (!company) throw new AppError("Locadora não encontrada para este endereço.", 404, "COMPANY_NOT_FOUND");
  const filters = showcaseFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return NextResponse.json(await listShowcase(company.id, filters));
});
