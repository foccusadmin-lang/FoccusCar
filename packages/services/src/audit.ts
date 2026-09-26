import { auditLogs, notifications, type Tx } from "@foccus/db";
import type { RequestMeta } from "./deps";

export async function audit(
  tx: Tx,
  entry: {
    companyId: string;
    actorUserId: string | null;
    action: string;
    entity: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    meta?: RequestMeta;
  },
) {
  const ip = entry.meta?.ip && /^[0-9a-f.:]+$/i.test(entry.meta.ip) ? entry.meta.ip : null;
  await tx.insert(auditLogs).values({
    companyId: entry.companyId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    origin: "web",
    ip,
    userAgent: entry.meta?.userAgent?.slice(0, 300) ?? null,
  });
}

/** Notificação na central do usuário (seção 75). E-mail/WhatsApp saem pelo worker de canais. */
export async function notify(
  tx: Tx,
  n: { companyId: string; userId: string; topic: string; title: string; body: string; link?: string },
) {
  await tx.insert(notifications).values({ ...n, channel: "IN_APP", status: "DELIVERED", sentAt: new Date() });
}
