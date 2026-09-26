import type { Database } from "@foccus/db";
import type { StorageProvider } from "@foccus/integrations";

export interface Mailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

/** Dependências injetadas: facilita testes e troca de provedores sem mexer nas regras. */
export interface ServiceDeps {
  db: Database;
  storage: StorageProvider;
  mailer: Mailer;
}

/** Metadados da requisição para auditoria (seção 80). */
export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

/** Erro de negócio com mensagem pronta para o usuário (seção 103). */
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "BAD_REQUEST",
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
