import { AsaasGateway } from "./asaas";
import { FakeGateway } from "./fake";
import { GatewayNotConfiguredError, type PaymentGateway } from "./gateway";
import { MercadoPagoGateway } from "./mercadopago";

type Env = Record<string, string | undefined>;

/** Escolhe o adapter pelo nome; credenciais vêm só de variáveis de ambiente/secrets. */
export function createPaymentGateway(provider: string, env: Env = process.env): PaymentGateway {
  switch (provider) {
    case "mercadopago":
      if (!env.MERCADOPAGO_ACCESS_TOKEN || !env.MERCADOPAGO_WEBHOOK_SECRET) throw new GatewayNotConfiguredError(provider);
      return new MercadoPagoGateway({ accessToken: env.MERCADOPAGO_ACCESS_TOKEN, webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET });
    case "asaas":
      if (!env.ASAAS_API_KEY || !env.ASAAS_WEBHOOK_TOKEN) throw new GatewayNotConfiguredError(provider);
      return new AsaasGateway({ apiKey: env.ASAAS_API_KEY, webhookToken: env.ASAAS_WEBHOOK_TOKEN, sandbox: env.ASAAS_SANDBOX === "true" });
    case "fake":
      if (env.NODE_ENV === "production") throw new Error("O gateway simulado não pode ser usado em produção.");
      return new FakeGateway();
    default:
      throw new GatewayNotConfiguredError(provider);
  }
}
