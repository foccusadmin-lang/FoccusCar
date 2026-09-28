import { acceptTrackingConsent, getMyTracking, revokeTrackingConsent } from "@foccus/services";
import { NextResponse } from "next/server";
import { requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const dynamic = "force-dynamic";

/** Texto da autorização, situação do aceite e se o app deve enviar a localização agora. */
export const GET = route(async () => NextResponse.json(await getMyTracking(deps, await requireAccess())));

/** Aceite LGPD no fim do cadastro, com a posição que prova a permissão do aparelho. */
export const POST = route(async (req: Request) => {
  const ctx = await requireAccess();
  await acceptTrackingConsent(deps, ctx, await req.json(), requestMeta(req));
  return NextResponse.json(await getMyTracking(deps, ctx));
});

/** Retirada da autorização (direito do titular). */
export const DELETE = route(async (req: Request) =>
  NextResponse.json(await revokeTrackingConsent(deps, await requireAccess(), requestMeta(req))));
