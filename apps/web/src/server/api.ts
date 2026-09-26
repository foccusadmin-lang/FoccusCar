import "server-only";
import { AccessDeniedError } from "@foccus/core";
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
      if (err instanceof AccessDeniedError)
        return NextResponse.json({ error: { code: err.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", message: err.message } }, { status: err.status });
      if (err instanceof ZodError)
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "Alguns dados precisam de ajuste.", fields: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } },
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
