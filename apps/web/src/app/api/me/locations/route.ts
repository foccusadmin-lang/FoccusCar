import { recordMyLocations } from "@foccus/services";
import { NextResponse } from "next/server";
import { requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

/** Lotes de posições do celular durante a locação. A resposta diz ao app se continua enviando. */
export const POST = route(async (req: Request) => NextResponse.json(await recordMyLocations(deps, await requireAccess(), await req.json())));
