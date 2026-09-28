import type { TelematicsAdapter } from "./adapter";
import { FakeTelematicsAdapter } from "./fake";

type Env = Record<string, string | undefined>;

export class TelematicsNotConfiguredError extends Error {
  constructor(readonly provider: string) {
    super(`Rastreador "${provider}" não configurado. Escolha o fornecedor e preencha as credenciais.`);
    this.name = "TelematicsNotConfiguredError";
  }
}

/**
 * Escolhe o adapter do fornecedor de rastreador (TELEMATICS_PROVIDER).
 * O fornecedor ainda não foi escolhido: cada um vira um `case` aqui, com credenciais só em secrets.
 */
export function createTelematicsAdapter(provider = process.env.TELEMATICS_PROVIDER ?? "", env: Env = process.env): TelematicsAdapter {
  switch (provider) {
    case "fake":
      if (env.NODE_ENV === "production") throw new Error("O rastreador simulado não pode ser usado em produção.");
      return new FakeTelematicsAdapter();
    default:
      throw new TelematicsNotConfiguredError(provider || "(nenhum)");
  }
}
