import "server-only";
import { AccessDeniedError } from "@foccus/core";
import { ServiceError } from "@foccus/services";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Erro de negócio com mensagem humana (seção 103). */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "BAD_REQUEST",
    readonly action?: { label: string; href: string },
  ) {
    super(message);
  }
}

/** Envolve rotas de API: converte erros em respostas claras, sem vazar detalhes internos. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AppError)
        return NextResponse.json({ error: { code: err.code, message: err.message, action: err.action } }, { status: err.status });
      if (err instanceof ServiceError)
        return NextResponse.json({ error: { code: err.code, message: err.message, fields: err.fields } }, { status: err.status });
      if (err instanceof AccessDeniedError)
        return NextResponse.json({ error: { code: err.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", message: err.message } }, { status: err.status });
      if (err instanceof ZodError)
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "Alguns dados precisam de ajuste.", fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])) } },
          { status: 422 },
        );
      console.error("[api] erro inesperado", err);
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Não foi possível concluir esta operação. Tente novamente." } },
        { status: 500 },
      );
    }
  };
}

/** IP e navegador para a auditoria. */
export function requestMeta(req: Request) {
  return {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip"),
    userAgent: req.headers.get("user-agent"),
  };
}

/** Exige login: devolve o contexto ou 401 com mensagem humana. */
export async function requireAccess() {
  const { getAccess } = await import("./auth");
  const ctx = await getAccess();
  if (!ctx) throw new AccessDeniedError("Entre na sua conta para continuar.", 401);
  return ctx;
}
