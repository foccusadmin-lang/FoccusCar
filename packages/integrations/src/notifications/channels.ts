/**
 * Canais de notificação (seção 75). A central grava em `notifications` e um worker
 * entrega por canal. WhatsApp via provedor oficial (Cloud API da Meta ou BSP) — seção 76.
 */
export interface OutboundMessage {
  to: string;
  template: string;
  variables: Record<string, string>;
  fallbackText: string;
}

export interface NotificationChannel {
  readonly channel: "EMAIL" | "WHATSAPP" | "PUSH";
  send(message: OutboundMessage): Promise<{ providerMessageId: string }>;
}

/** Modelos iniciais de mensagens automáticas. */
export const MESSAGE_TEMPLATES = {
  reservation_confirmed: "Sua reserva {{code}} do {{vehicle}} está confirmada para {{pickup}}.",
  pickup_reminder: "Lembrete: a retirada do {{vehicle}} é amanhã, {{pickup}}, em {{location}}.",
  return_reminder: "Lembrete: a devolução do {{vehicle}} é em {{return}}.",
  payment_pending: "Há um pagamento pendente de {{amount}} referente a {{reference}}.",
  document_pending: "Precisamos de um documento seu: {{document}}. Envie pelo app.",
  vehicle_available: "O {{vehicle}} que você acompanhava está disponível novamente.",
} as const;

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
}
