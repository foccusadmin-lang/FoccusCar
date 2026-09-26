import { getReviewDetail } from "@foccus/services";
import { NextResponse } from "next/server";
import { requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const dynamic = "force-dynamic";
export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return NextResponse.json(await getReviewDetail(deps, await requireAccess(), id));
});
