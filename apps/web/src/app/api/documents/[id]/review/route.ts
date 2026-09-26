import { reviewDocument } from "@foccus/services";
import { NextResponse } from "next/server";
import { requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return NextResponse.json(await reviewDocument(deps, await requireAccess(), id, await req.json(), requestMeta(req)));
});
