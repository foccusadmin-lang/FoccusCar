import { listAuditLogs } from "@foccus/services";
import { NextResponse, type NextRequest } from "next/server";
import { requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const GET = route(async (req: NextRequest) => {
  return NextResponse.json(await listAuditLogs(deps, await requireAccess(), Object.fromEntries(req.nextUrl.searchParams)));
});
