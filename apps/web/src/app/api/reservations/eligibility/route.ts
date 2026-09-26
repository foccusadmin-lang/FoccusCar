import { authorize, checkServiceAccess } from "@foccus/core";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AppError, route } from "@/server/api";
import { getAccess, getCurrentCompany } from "@/server/auth";
import { getShowcaseVehicle } from "@/server/services/showcase";

const bodySchema = z.object({ vehicleId: z.uuid() });

/**
 * Primeiro passo da reserva: verifica no servidor se a pessoa pode reservar (seções 18, 20 e 95).
 * Sem login → 401. Cadastro incompleto → 403 PROFILE_REQUIRED com o botão COMPLETAR CADASTRO.
 */
export const POST = route(async (req: NextRequest) => {
  const company = await getCurrentCompany();
  if (!company) throw new AppError("Locadora não encontrada para este endereço.", 404, "COMPANY_NOT_FOUND");
  const ctx = authorize(await getAccess(), { permission: "self:reservations.manage", companyId: company.id });

  const gate = checkServiceAccess(ctx.accountStatus);
  if (!gate.allowed) throw new AppError(gate.message, 403, gate.code, gate.action);

  const { vehicleId } = bodySchema.parse(await req.json());
  const vehicle = await getShowcaseVehicle(company.id, vehicleId);
  if (!vehicle) throw new AppError("Este veículo não está mais disponível na vitrine.", 404, "VEHICLE_NOT_FOUND");

  return NextResponse.json({ allowed: true, next: `/reservas/nova?veiculo=${vehicle.id}` });
});
