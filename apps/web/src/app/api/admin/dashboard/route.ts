import { getAdminDashboard } from "@foccus/services";
import { NextResponse } from "next/server";
import { requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const GET = route(async () => NextResponse.json(await getAdminDashboard(deps, await requireAccess())));
