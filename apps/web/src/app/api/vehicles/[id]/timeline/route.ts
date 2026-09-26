import { getVehicleTimeline } from "@foccus/services";
import { NextResponse, type NextRequest } from "next/server";
import { requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

/** Vida do Veículo, paginada por cursor (?antes=ISO&tipo=...). */
export const GET = route(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAccess();
  return NextResponse.json(await getVehicleTimeline(deps, ctx, (await params).id, Object.fromEntries(req.nextUrl.searchParams)));
});
