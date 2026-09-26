import { listReviewQueue } from "@foccus/services";
import { NextResponse } from "next/server";
import { requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const dynamic = "force-dynamic";
export const GET = route(async () => NextResponse.json(await listReviewQueue(deps, await requireAccess())));
